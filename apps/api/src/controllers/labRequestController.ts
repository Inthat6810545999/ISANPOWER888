import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { APPROVAL_STATUSES, REQUEST_PRIORITIES, REQUEST_STATUSES, REQUEST_TYPES } from "../models/LabRequest.js";
import { HttpError } from "../middleware/errorHandler.js";
import { actor } from "../auth/session.js";

const includeDecision = { decision: true } as const;
const createSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().max(5000).optional(),
  type: z.enum(REQUEST_TYPES), neededBy: z.coerce.date().optional(),
  priority: z.enum(REQUEST_PRIORITIES).default("medium"),
  location: z.string().trim().max(200).default(""), requiresApproval: z.boolean().default(false),
}).strict();
const listQuerySchema = z.object({
  requesterEmail: z.email().transform((v) => v.toLowerCase()).optional(),
  status: z.enum(REQUEST_STATUSES).optional(), approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
}).strict();

export async function listLabRequests(req: Request, res: Response): Promise<void> {
  const filter = listQuerySchema.parse(req.query);
  const user = actor(res);
  if (user.role === "member" && filter.requesterEmail && filter.requesterEmail !== user.email) {
    throw new HttpError(403, "Members can only view their own requests.");
  }
  res.json({ data: await prisma.labRequest.findMany({
    where: { ...filter, ...(user.role === "member" ? { requesterEmail: user.email } : {}) },
    include: includeDecision, orderBy: { createdAt: "desc" },
  }) });
}

export async function getLabRequest(req: Request<{ id: string }>, res: Response): Promise<void> {
  const found = await prisma.labRequest.findUnique({ where: { id: req.params.id }, include: includeDecision });
  if (!found || (actor(res).role === "member" && found.requesterEmail !== actor(res).email)) {
    throw new HttpError(404, "Lab request not found");
  }
  res.json({ data: found });
}

export async function createLabRequest(req: Request, res: Response): Promise<void> {
  const payload = createSchema.parse(req.body);
  const created = await prisma.labRequest.create({ data: {
    ...payload, requesterEmail: actor(res).email, status: "pending",
    approvalStatus: payload.requiresApproval ? "submitted" : "not_required",
  }, include: includeDecision });
  res.status(201).json({ data: created });
}

const reviewSchema = z.object({ approvalStatus: z.enum(["approved", "rejected"]), reason: z.string().trim().min(1).max(2000) }).strict();
/** A final decision is immutable; the work status is never changed by review. */
export async function updateLabRequestApprovalStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { approvalStatus, reason } = reviewSchema.parse(req.body);
  const reviewer = actor(res);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.labRequest.updateMany({
      where: { id: req.params.id, requiresApproval: true, approvalStatus: { in: ["submitted", "under_review"] }, status: { notIn: ["closed", "cancelled"] } },
      data: { approvalStatus },
    });
    if (!result.count) {
      if (!await tx.labRequest.findUnique({ where: { id: req.params.id } })) throw new HttpError(404, "Lab request not found");
      throw new HttpError(409, "This request does not need review, is no longer active, or has already been reviewed.");
    }
    await tx.approvalDecision.create({ data: {
      requestId: req.params.id, outcome: approvalStatus, reason, reviewerId: reviewer.id,
      reviewerName: reviewer.name, reviewerEmail: reviewer.email,
    } });
    return tx.labRequest.findUniqueOrThrow({ where: { id: req.params.id }, include: includeDecision });
  });
  res.json({ data: updated });
}

const taSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }).strict(),
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("close") }).strict(),
  z.object({ action: z.literal("assign"), assigneeId: z.uuid(), expectedUpdatedAt: z.iso.datetime() }).strict(),
]);
type TaAction = z.infer<typeof taSchema>;

async function executeTa(id: string, payload: TaAction, res: Response) {
  const user = actor(res);
  return prisma.$transaction(async (tx) => {
    let assigneeEmail = user.email;
    if (payload.action === "assign") {
      const target = await tx.user.findFirst({ where: { id: payload.assigneeId, role: "ta", active: true } });
      if (!target) throw new HttpError(400, "Choose an active Teaching Assistant.");
      assigneeEmail = target.email;
    }
    const result = payload.action === "assign"
      ? await tx.labRequest.updateMany({
        where: { id, status: { in: ["pending", "assigned"] }, updatedAt: new Date(payload.expectedUpdatedAt) },
        data: { status: "assigned", assigneeEmail },
      })
      : await tx.labRequest.updateMany({
        where: {
          id,
          status: payload.action === "claim" ? "pending" : payload.action === "start" ? "assigned" : "in_progress",
          assigneeEmail: payload.action === "claim" ? null : user.email,
          ...(payload.action === "claim" ? {} : { OR: [
            { requiresApproval: false, approvalStatus: "not_required" as const },
            { requiresApproval: true, approvalStatus: "approved" as const },
          ] }),
        },
        data: { status: payload.action === "claim" ? "assigned" : payload.action === "start" ? "in_progress" : "closed", assigneeEmail },
      });
    const current = await tx.labRequest.findUnique({ where: { id }, include: includeDecision });
    if (!current) throw new HttpError(404, "Lab request not found");
    if (result.count !== 1) throw new HttpError(409, "Action blocked: check approval, assignment, and current work status, then refresh.");
    return current;
  });
}

export async function performTaAction(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json({ data: await executeTa(req.params.id, taSchema.parse(req.body), res) });
}

/** Compatibility endpoint: same TA ownership and approval gates, no direct bypass. */
export async function updateLabRequestStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { status } = z.object({ status: z.enum(["in_progress", "closed"]) }).strict().parse(req.body);
  res.json({ data: await executeTa(req.params.id, { action: status === "in_progress" ? "start" : "close" }, res) });
}

export async function requestReports(req: Request, res: Response): Promise<void> {
  const filter = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }).strict().parse(req.query);
  if (filter.from && filter.to && filter.from > filter.to) throw new HttpError(400, "Start date must be before end date.");
  const where = { createdAt: {
    ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
    ...(filter.to ? { lt: new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + 86400000) } : {}),
  } };
  const data = await prisma.$transaction(async (tx) => {
    const total = await tx.labRequest.count({ where });
    const byStatus = await tx.labRequest.groupBy({ by: ["status"], where, _count: { _all: true } });
    const byApproval = await tx.labRequest.groupBy({ by: ["approvalStatus"], where, _count: { _all: true } });
    const byType = await tx.labRequest.groupBy({ by: ["type"], where, _count: { _all: true } });
    return { total, generatedAt: new Date().toISOString(),
    byStatus: byStatus.map((r) => ({ label: r.status, count: r._count._all })),
    byApproval: byApproval.map((r) => ({ label: r.approvalStatus, count: r._count._all })),
    byType: byType.map((r) => ({ label: r.type, count: r._count._all })),
    };
  }, { isolationLevel: "RepeatableRead" });
  res.json({ data });
}

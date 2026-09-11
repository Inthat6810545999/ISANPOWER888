import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { APPROVAL_STATUSES, REQUEST_PRIORITIES, REQUEST_STATUSES, REQUEST_TYPES } from "../models/LabRequest.js";
import { HttpError } from "../middleware/errorHandler.js";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(REQUEST_TYPES),
  requesterEmail: z.email().transform((value) => value.toLowerCase()),
  neededBy: z.coerce.date().optional(),
  priority: z.enum(REQUEST_PRIORITIES).default("medium"),
  location: z.string().trim().max(200).default(""),
  requiresApproval: z.boolean().default(false),
}).strict();

const updateStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
}).strict();

const updateApprovalSchema = z.object({
  approvalStatus: z.enum(APPROVAL_STATUSES),
}).strict();

const listQuerySchema = z.object({
  requesterEmail: z.email().transform((value) => value.toLowerCase()).optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
});

export async function listLabRequests(req: Request, res: Response): Promise<void> {
  const filter = listQuerySchema.parse(req.query);
  const requests = await prisma.labRequest.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: requests });
}

export async function getLabRequest(req: Request<{ id: string }>, res: Response): Promise<void> {
  const found = await prisma.labRequest.findUnique({ where: { id: req.params.id } });
  if (!found) throw new HttpError(404, "Lab request not found");
  res.json({ data: found });
}

export async function createLabRequest(req: Request, res: Response): Promise<void> {
  const payload = createSchema.parse(req.body);
  const created = await prisma.labRequest.create({ data: {
    ...payload,
    status: "pending",
    approvalStatus: payload.requiresApproval ? "submitted" : "not_required",
  } });
  res.status(201).json({ data: created });
}

/** Approval changes never imply a work-status change. */
export async function updateLabRequestApprovalStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { approvalStatus } = updateApprovalSchema.parse(req.body);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.labRequest.findUnique({ where: { id: req.params.id } });
      if (!current) throw new HttpError(404, "Lab request not found");
      if ((current.requiresApproval && approvalStatus === "not_required") ||
          (!current.requiresApproval && approvalStatus !== "not_required")) {
        throw new HttpError(400, "Approval status must match requiresApproval");
      }
      return tx.labRequest.update({ where: { id: current.id }, data: { approvalStatus } });
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new HttpError(404, "Lab request not found");
    }
    throw err;
  }
}

export async function updateLabRequestStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { status } = updateStatusSchema.parse(req.body);

  try {
    const updated = await prisma.labRequest.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new HttpError(404, "Lab request not found");
    }
    throw err;
  }
}

// Local demo actors are supplied by the Next server. Replace with authenticated
// session identity before deploying this API outside local development.
const taActionSchema = z.object({
  assigneeEmail: z.email().transform((value) => value.toLowerCase()),
  action: z.enum(["claim", "start", "close"]),
}).strict();

export async function performTaAction(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { assigneeEmail, action } = taActionSchema.parse(req.body);
  const expected = action === "claim" ? "pending" : action === "start" ? "assigned" : "in_progress";
  const status = action === "claim" ? "assigned" : action === "start" ? "in_progress" : "closed";
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.labRequest.updateMany({
      where: { id: req.params.id, status: expected, assigneeEmail: action === "claim" ? null : assigneeEmail },
      data: { status, assigneeEmail },
    });
    const current = await tx.labRequest.findUnique({ where: { id: req.params.id } });
    if (!current) throw new HttpError(404, "Lab request not found");
    if (result.count !== 1) throw new HttpError(409, "This request has changed or belongs to another TA. Refresh the queue and try again.");
    return current;
  });
  res.json({ data: updated });
}

import { Router } from "express";
import { z } from "zod";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "../db/connect.js";
import { actor, publicUser, requireRole, requireSession } from "../auth/session.js";
import { HttpError } from "../middleware/errorHandler.js";

const managedUser = { ...publicUser, active: true, membershipVersion: true } as const;
const roleSchema = z.enum(["member", "ta", "lab_manager"]);
const changeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: roleSchema, expectedVersion: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("active"), active: z.boolean(), expectedVersion: z.number().int().nonnegative() }).strict(),
]);

// All membership writes serialize, then recheck the actor inside the transaction.
// This prevents two managers from concurrently removing the last manager.
async function reviewer(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
  const user = await tx.user.findUnique({ where: { id } });
  if (!user?.active || user.role !== "lab_manager" || user.membershipStatus !== "APPROVED") {
    throw new HttpError(403, "Approved Lab Manager access required.");
  }
  return user;
}
async function audit(tx: Prisma.TransactionClient, by: User, before: User, after: User, action: string) {
  await tx.membershipAudit.create({ data: {
    targetId: before.id, targetName: before.name, targetEmail: before.email,
    actorId: by.id, actorName: by.name, actorEmail: by.email, action,
    previousRole: before.role, nextRole: after.role, previousActive: before.active, nextActive: after.active,
    previousMembership: before.membershipStatus, nextMembership: after.membershipStatus,
  } });
}
export const membershipRouter = Router();
membershipRouter.use(requireSession, requireRole("lab_manager"));
membershipRouter.get("/", async (req, res) => {
  const scope = z.enum(["pending", "all"]).default("pending").parse(req.query.scope);
  res.json({ data: await prisma.user.findMany({
    where: scope === "pending" ? { active: true, membershipStatus: "PENDING", role: "unassigned" } : {},
    select: managedUser, orderBy: [{ name: "asc" }, { id: "asc" }],
  }) });
});
membershipRouter.get("/:id/history", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const cursor = z.coerce.number().int().positive().optional().parse(req.query.before);
  if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, "Member not found.");
  const rows = await prisma.membershipAudit.findMany({
    where: { targetId: id, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: "desc" }, take: 51,
  });
  res.json({ data: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49]!.id : null });
});
membershipRouter.post("/:id/approve", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { role } = z.object({ role: roleSchema }).strict().parse(req.body);
  const user = await prisma.$transaction(async (tx) => {
    const by = await reviewer(tx, actor(res).id);
    const before = await tx.user.findUnique({ where: { id } });
    if (!before?.active || before.role !== "unassigned" || before.membershipStatus !== "PENDING") {
      throw new HttpError(409, "This registration is no longer pending. Refresh the list.");
    }
    const after = await tx.user.update({ where: { id }, data: {
      role, membershipStatus: "APPROVED", membershipApprovedBy: by.id, membershipApprovedAt: new Date(),
      membershipVersion: { increment: 1 },
    } });
    await audit(tx, by, before, after, "approved");
    return tx.user.findUniqueOrThrow({ where: { id }, select: managedUser });
  });
  res.json({ data: user });
});
membershipRouter.patch("/:id", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = changeSchema.parse(req.body);
  const user = await prisma.$transaction(async (tx) => {
    const by = await reviewer(tx, actor(res).id);
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Member not found.");
    if (before.membershipVersion !== input.expectedVersion) throw new HttpError(409, "This member changed. Refresh the list before trying again.");
    if (input.action === "role" && before.membershipStatus !== "APPROVED") throw new HttpError(409, "Approve this registration before changing its role.");
    const role = input.action === "role" ? input.role : before.role;
    const active = input.action === "active" ? input.active : before.active;
    if (role === before.role && active === before.active) throw new HttpError(409, "No changes to save. Refresh the list.");
    if (before.active && before.role === "lab_manager" && before.membershipStatus === "APPROVED" && (!active || role !== "lab_manager")) {
      const count = await tx.user.count({ where: { active: true, role: "lab_manager", membershipStatus: "APPROVED" } });
      if (count <= 1) throw new HttpError(409, "Keep at least one active, approved Lab Manager.");
    }
    const after = await tx.user.update({ where: { id }, data: { role, active, membershipVersion: { increment: 1 } } });
    // Old sessions must not become usable again when an account is reactivated.
    if (!active) await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, by, before, after, input.action === "role" ? "role_changed" : active ? "reactivated" : "deactivated");
    return tx.user.findUniqueOrThrow({ where: { id }, select: managedUser });
  });
  res.json({ data: user });
});

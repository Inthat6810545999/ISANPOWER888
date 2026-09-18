import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { actor, publicUser, requireRole, requireSession } from "../auth/session.js";
import { HttpError } from "../middleware/errorHandler.js";

export const membershipRouter = Router();
membershipRouter.use(requireSession, requireRole("lab_manager"));
membershipRouter.get("/", async (_req, res) => {
  res.json({ data: await prisma.user.findMany({
    where: { active: true, membershipStatus: "PENDING", role: "unassigned" },
    select: publicUser, orderBy: [{ name: "asc" }, { id: "asc" }],
  }) });
});
membershipRouter.post("/:id/approve", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { role } = z.object({ role: z.enum(["member", "ta", "lab_manager"]) }).strict().parse(req.body);
  const user = await prisma.$transaction(async (tx) => {
    // Coordinate with admin account changes and recheck the reviewer's current access.
    await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
    const reviewer = await tx.user.findUnique({ where: { id: actor(res).id } });
    if (!reviewer?.active || reviewer.role !== "lab_manager" || reviewer.membershipStatus !== "APPROVED") {
      throw new HttpError(403, "Approved Lab Manager access required.");
    }
    const result = await tx.user.updateMany({
      where: { id, active: true, role: "unassigned", membershipStatus: "PENDING" },
      data: { role, membershipStatus: "APPROVED", membershipApprovedBy: reviewer.id, membershipApprovedAt: new Date() },
    });
    if (!result.count) throw new HttpError(409, "This registration is no longer pending. Refresh the list.");
    return tx.user.findUniqueOrThrow({ where: { id }, select: publicUser });
  });
  res.json({ data: user });
});

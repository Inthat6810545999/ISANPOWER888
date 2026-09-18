import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { actor, publicUser, requireRole, requireSession } from "../auth/session.js";
import { hashPassword } from "../auth/password.js";
import { HttpError } from "../middleware/errorHandler.js";

export const adminRouter = Router();
adminRouter.use(requireSession, requireRole("admin"));
const select = { ...publicUser, active: true };
const role = z.enum(["member", "ta", "lab_manager", "admin"]);
const name = z.string().trim().min(1).max(100);
const createSchema = z.object({ name, email: z.email().trim().toLowerCase(), role,
  password: z.string().min(12).max(256) }).strict();
// Email is immutable because existing requests identify their owner by email.
const updateSchema = z.object({ name, role, active: z.boolean() }).strict();

adminRouter.get("/users", async (_req, res) => {
  res.json({ data: await prisma.user.findMany({ select, orderBy: { name: "asc" } }) });
});
adminRouter.post("/users", async (req, res) => {
  const { password, ...data } = createSchema.parse(req.body);
  try {
    const user = await prisma.user.create({ data: { ...data, membershipStatus: "APPROVED", passwordHash: await hashPassword(password) }, select });
    res.status(201).json({ data: user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "An account with this email already exists.");
    }
    throw error;
  }
});
adminRouter.patch("/users/:id", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const data = updateSchema.parse(req.body);
  const user = await prisma.$transaction(async (tx) => {
    // Serialize account changes and recheck the actor after acquiring the lock.
    await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
    const current = await tx.user.findUnique({ where: { id: actor(res).id } });
    if (!current?.active || current.role !== "admin" || current.membershipStatus !== "APPROVED") throw new HttpError(403, "Administrator access required.");
    if (id === current.id && (!data.active || data.role !== "admin")) {
      throw new HttpError(409, "You cannot deactivate or remove your own administrator role.");
    }
    const previous = await tx.user.findUnique({ where: { id } });
    if (!previous) throw new HttpError(404, "User not found.");
    if (previous.membershipStatus !== "APPROVED") throw new HttpError(409, "A Lab Manager must approve this registration first.");
    const updated = await tx.user.update({ where: { id }, data, select });
    if (!data.active || data.role !== previous.role) await tx.session.deleteMany({ where: { userId: id } });
    return updated;
  });
  res.json({ data: user });
});

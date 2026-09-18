import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { UserRole, MembershipStatus } from "@prisma/client";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";

export const publicUser = { id: true, email: true, name: true, role: true, membershipStatus: true } as const;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export type Actor = { id: string; email: string; name: string; role: UserRole; membershipStatus: MembershipStatus };

export async function issueSession(user: Actor) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt } });
  return { token, expiresAt, user: { id: user.id, email: user.email, name: user.name, role: user.role, membershipStatus: user.membershipStatus } };
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") ?? "");
  if (!match?.[1]) throw new HttpError(401, "Sign in to continue.");
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(match[1]) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.active) throw new HttpError(401, "Session expired. Sign in again.");
  const { id, email, name, role, membershipStatus } = session.user;
  res.locals.actor = { id, email, name, role, membershipStatus } satisfies Actor;
  res.locals.sessionId = session.id;
  res.set("Cache-Control", "no-store");
  next();
}

export function actor(res: Response): Actor { return res.locals.actor as Actor; }
export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (actor(res).membershipStatus !== "APPROVED" || actor(res).role === "unassigned") throw new HttpError(403, "Your membership is pending approval.");
    if (!roles.includes(actor(res).role)) throw new HttpError(403, "Your role cannot perform this action.");
    next();
  };
}

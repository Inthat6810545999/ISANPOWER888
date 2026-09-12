import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";

export const publicUser = { id: true, email: true, name: true, role: true } as const;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export type Actor = { id: string; email: string; name: string; role: UserRole };

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") ?? "");
  if (!match?.[1]) throw new HttpError(401, "Sign in to continue.");
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(match[1]) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.active) throw new HttpError(401, "Session expired. Sign in again.");
  const { id, email, name, role } = session.user;
  res.locals.actor = { id, email, name, role } satisfies Actor;
  res.locals.sessionId = session.id;
  res.set("Cache-Control", "no-store");
  next();
}

export function actor(res: Response): Actor { return res.locals.actor as Actor; }
export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(actor(res).role)) throw new HttpError(403, "Your role cannot perform this action.");
    next();
  };
}

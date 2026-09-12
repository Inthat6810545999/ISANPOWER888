import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { actor, publicUser, requireRole, requireSession, tokenHash } from "../auth/session.js";
import { verifyPassword } from "../auth/password.js";
import { HttpError } from "../middleware/errorHandler.js";

export const authRouter = Router();
const credentials = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1).max(256) }).strict();
// Local single-process throttling. A distributed deployment needs a shared limiter.
const attempts = new Map<string, { count: number; until: number }>();
authRouter.post("/login", async (req, res) => {
  const payload = credentials.parse(req.body);
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip ?? "local";
  const attempt = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  if (attempt.count >= 30) throw new HttpError(429, "Too many sign-in attempts. Try again in a minute.");
  attempt.count += 1;
  attempts.set(key, attempt);
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  // Still derive a key when the account is unknown.
  const valid = await verifyPassword(payload.password, user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`);
  if (!user?.active || !valid) throw new HttpError(401, "Invalid email or password.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now + 8 * 60 * 60 * 1000);
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt } });
  res.set("Cache-Control", "no-store");
  res.json({ token, expiresAt, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
authRouter.get("/me", requireSession, (_req, res) => { res.json({ user: actor(res) }); });
authRouter.post("/logout", requireSession, async (_req, res) => {
  await prisma.session.deleteMany({ where: { id: res.locals.sessionId as string } });
  res.json({ ok: true });
});
authRouter.get("/assignees", requireSession, requireRole("ta"), async (_req, res) => {
  res.json({ data: await prisma.user.findMany({ where: { role: "ta", active: true }, select: publicUser, orderBy: { name: "asc" } }) });
});

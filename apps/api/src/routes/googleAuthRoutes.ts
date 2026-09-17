import { createHash, randomBytes } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";
import { tokenHash, issueSession } from "../auth/session.js";
import { googleConfig, exchangeGoogleCode } from "../auth/google.js";
import { resolveGoogleAccount } from "../auth/google-account.js";

export const googleAuthRouter = Router();
const secret = z.string().regex(/^[a-f0-9]{64}$/);
const attempts = new Map<string, { count: number; until: number }>();
const limit: RequestHandler = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = `${req.ip}:${req.path}`;
  const bucket = attempts.get(key) ?? { count: 0, until: now + 60000 };
  if (bucket.count >= 30) throw new HttpError(429, "Too many sign-in attempts. Try again later.");
  bucket.count += 1; attempts.set(key, bucket); next();
};

googleAuthRouter.post("/start", limit, async (req, res) => {
  const { binding } = z.object({ binding: secret }).strict().parse(req.body);
  const config = googleConfig();
  const state = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  await prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.oAuthAttempt.create({ data: { stateHash: tokenHash(state), bindingHash: tokenHash(binding), nonce, codeVerifier, expiresAt: new Date(Date.now() + 10 * 60000) } });
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: "openid email profile", state, nonce, prompt: "select_account",
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  res.json({ authorizationUrl: authorizationUrl.toString() });
});

googleAuthRouter.post("/callback", limit, async (req, res) => {
  const { code, state, binding } = z.object({ code: z.string().min(1).max(4096), state: secret, binding: secret }).strict().parse(req.body);
  const where = { stateHash: tokenHash(state), bindingHash: tokenHash(binding), expiresAt: { gt: new Date() } };
  const attempt = await prisma.oAuthAttempt.findFirst({ where });
  if (!attempt || !(await prisma.oAuthAttempt.deleteMany({ where })).count) throw new HttpError(400, "Google sign-in expired or was already used. Start again.");
  let identity;
  try { identity = await exchangeGoogleCode(code, attempt.codeVerifier, attempt.nonce); }
  catch { throw new HttpError(401, "Unable to verify Google sign-in. Start again."); }
  const user = await resolveGoogleAccount(identity);
  res.json(await issueSession(user));
});

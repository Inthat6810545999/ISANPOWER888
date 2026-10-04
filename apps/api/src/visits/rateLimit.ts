import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";

/** Database-backed fixed windows shared by all API processes. Never trust arbitrary forwarded headers. */
export function publicRateLimit(scope: string, limit: number, windowMs: number): RequestHandler {
  return async (req, res, next) => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = new Date(windowStart + windowMs);
    const ipHash = createHash("sha256").update(req.ip ?? req.socket.remoteAddress ?? "unknown").digest("hex");
    const key = `${scope}:${windowStart}:${ipHash}`;
    try {
      const bucket = await prisma.publicRateLimit.upsert({
        where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } },
      });
      await prisma.publicRateLimit.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });
      if (bucket.count > limit) {
        res.setHeader("Retry-After", Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)));
        next(new HttpError(429, "Too many requests. Please try again later."));
        return;
      }
      next();
    } catch {
      // Do not log database arguments containing credentials/contact data.
      next(new HttpError(503, "Visitor service is temporarily unavailable."));
    }
  };
}

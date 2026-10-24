import cors from "cors";
import type { RequestHandler } from "express";

export type RuntimeMode = "development" | "test" | "production";
const developmentOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

function configuredOrigin(value: string | undefined, mode: RuntimeMode): string {
  if (!value && mode === "production") throw new Error("CORS_ORIGIN is required in production.");
  const url = new URL(value ?? "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("CORS_ORIGIN must be one HTTP(S) origin without credentials, a path, query or fragment.");
  }
  return url.origin;
}

/** Exact origin allowlist shared by tracking and all existing API routes. */
export function createCorsMiddleware(value: string | undefined, mode: RuntimeMode, tracking = false): RequestHandler {
  const allowed = new Set<string>(mode === "development" ? developmentOrigins : [configuredOrigin(value, mode)]);
  const handleCors = cors({
    // Returning true reflects only an origin already matched against this set.
    origin: (origin, done) => done(null, origin !== undefined && allowed.has(origin)),
    ...(tracking ? { methods: ["POST", "OPTIONS"], exposedHeaders: ["Retry-After"] } : {}),
  });
  return (req, res, next) => {
    res.vary("Origin");
    const origin = req.get("Origin");
    if (origin !== undefined && !allowed.has(origin)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    handleCors(req, res, next);
  };
}

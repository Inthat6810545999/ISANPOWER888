import express, { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { HttpError } from "../middleware/errorHandler.js";
import { findPublicVisit } from "../visits/contract.js";
import { publicRateLimit } from "../visits/rateLimit.js";

/** Mounted before global parsers/logging: every response is private and sanitized. */
export function createVisitTrackRouter(corsMiddleware: RequestHandler) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use(corsMiddleware);
  router.use((req, res, next) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      res.status(405).json({ error: "Method not allowed." });
      return;
    }
    next();
  });
  // Count invalid bodies too, before content-type checks and JSON parsing.
  router.use(publicRateLimit("visit-track", 10, 60_000));
  router.use((req, res, next) => {
    if (!req.is("application/json")) {
      res.status(415).json({ error: "Expected application/json." });
      return;
    }
    next();
  });
  router.use(express.json());
  router.use(async (req, res) => {
    const body: unknown = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "code")) {
      res.status(400).json({ error: "Invalid tracking request." });
      return;
    }
    const found = await findPublicVisit("code" in body ? body.code : undefined);
    if (!found) {
      res.status(404).json({ error: "Visit request not found." });
      return;
    }
    res.json({ data: {
      status: found.status, approvalStatus: found.approvalStatus,
      publicMessage: found.publicMessage, visitDate: found.visitDate, timeSlot: found.timeSlot,
    } });
  });
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    // Never forward raw parser/Prisma errors to the generic logging handler.
    if (error && typeof error === "object" && "type" in error) {
      if (error.type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid tracking request." }); return;
      }
      if (error.type === "entity.too.large") {
        res.status(413).json({ error: "Request body too large" }); return;
      }
    }
    if (error instanceof HttpError && error.status === 429) {
      res.status(429).json({ error: "Too many requests. Please try again later." }); return;
    }
    res.status(503).json({ error: "Visitor service is temporarily unavailable." });
  };
  router.use(handleError);
  return router;
}

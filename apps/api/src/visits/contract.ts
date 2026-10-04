import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/connect.js";

export function bangkokDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const optionalText = (max: number) => z.string().trim().max(max).default("");
export const visitSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).pipe(z.email()),
  phone: optionalText(40), organization: optionalText(200),
  purpose: z.enum(["tour", "study", "collaboration", "other"]),
  details: z.string().trim().min(1).max(4000),
  visitDate: z.iso.date().refine(date => date >= bangkokDate(), "Choose today or a future date in Bangkok."),
  timeSlot: z.enum(["morning", "afternoon"]),
  visitorCount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  requestedHost: optionalText(200), arrangements: optionalText(1000),
}).strict();

// The credential is case-sensitive; do not lowercase or normalize it.
export const trackingCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export function hashTrackingCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}
export function generateTrackingCode(): string {
  return randomBytes(32).toString("base64url");
}

/** For the tracking API owner: explicit public allowlist, never return a LabRequest. */
export async function findPublicVisit(code: unknown) {
  const parsed = trackingCodeSchema.safeParse(code);
  if (!parsed.success) return null;
  const credential = await prisma.visitTrackingCredential.findUnique({
    where: { codeHash: hashTrackingCode(parsed.data) },
    select: { request: { select: {
      source: true, status: true, approvalStatus: true, publicMessage: true,
      visit: { select: { visitDate: true, timeSlot: true } },
    } } },
  });
  const found = credential?.request;
  if (!found || found.source !== "visitor" || !found.visit) return null;
  return { status: found.status, approvalStatus: found.approvalStatus,
    publicMessage: found.publicMessage, visitDate: found.visit.visitDate, timeSlot: found.visit.timeSlot };
}

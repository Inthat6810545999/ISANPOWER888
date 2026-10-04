import { Router } from "express";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";
import { generateTrackingCode, hashTrackingCode, visitSchema } from "../visits/contract.js";
import { publicRateLimit } from "../visits/rateLimit.js";

export const visitRouter = Router();
visitRouter.post("/", publicRateLimit("visit-submit", 10, 60_000), async (req, res) => {
  const visit = visitSchema.parse(req.body);
  const trackingCode = generateTrackingCode();
  try {
    // A nested write commits all three records atomically before the receipt is sent.
    const created = await prisma.labRequest.create({
      data: {
        title: `Visitor request: ${visit.purpose}`, description: visit.details,
        type: "visitor", source: "visitor", requesterEmail: "",
        status: "pending", approvalStatus: "submitted", requiresApproval: true, priority: "medium",
        neededBy: new Date(`${visit.visitDate}T${visit.timeSlot === "morning" ? "09" : "13"}:00:00+07:00`),
        visit: { create: visit }, tracking: { create: { codeHash: hashTrackingCode(trackingCode) } },
      },
      select: { id: true },
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ data: { requestId: created.id, trackingCode } });
  } catch {
    throw new HttpError(503, "Visitor service is temporarily unavailable.");
  }
});

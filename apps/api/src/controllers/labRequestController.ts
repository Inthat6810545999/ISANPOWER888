import type { Request, Response } from "express";
import { z } from "zod";
import { LabRequest, REQUEST_STATUSES, REQUEST_TYPES } from "../models/LabRequest.js";
import { HttpError } from "../middleware/errorHandler.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(REQUEST_TYPES),
  requesterEmail: z.email(),
  neededBy: z.coerce.date().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
});

const listQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
});

export async function listLabRequests(req: Request, res: Response): Promise<void> {
  const filter = listQuerySchema.parse(req.query);
  const requests = await LabRequest.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ data: requests });
}

export async function getLabRequest(req: Request, res: Response): Promise<void> {
  const found = await LabRequest.findById(req.params.id).lean();
  if (!found) throw new HttpError(404, "Lab request not found");
  res.json({ data: found });
}

export async function createLabRequest(req: Request, res: Response): Promise<void> {
  const payload = createSchema.parse(req.body);
  const created = await LabRequest.create(payload);
  res.status(201).json({ data: created.toObject() });
}

export async function updateLabRequestStatus(req: Request, res: Response): Promise<void> {
  const { status } = updateStatusSchema.parse(req.body);
  const updated = await LabRequest.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true },
  ).lean();
  if (!updated) throw new HttpError(404, "Lab request not found");
  res.json({ data: updated });
}

import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/connect.js";
import { REQUEST_STATUSES, REQUEST_TYPES } from "../models/LabRequest.js";
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
  const requests = await prisma.labRequest.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: requests });
}

export async function getLabRequest(req: Request, res: Response): Promise<void> {
  const found = await prisma.labRequest.findUnique({ where: { id: req.params.id } });
  if (!found) throw new HttpError(404, "Lab request not found");
  res.json({ data: found });
}

export async function createLabRequest(req: Request, res: Response): Promise<void> {
  const payload = createSchema.parse(req.body);
  const created = await prisma.labRequest.create({ data: payload });
  res.status(201).json({ data: created });
}

export async function updateLabRequestStatus(req: Request, res: Response): Promise<void> {
  const { status } = updateStatusSchema.parse(req.body);

  try {
    const updated = await prisma.labRequest.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new HttpError(404, "Lab request not found");
    }
    throw err;
  }
}
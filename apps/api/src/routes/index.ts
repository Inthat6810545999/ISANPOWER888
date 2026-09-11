import { Router } from "express";
import { prisma } from "../db/connect.js";
import { labRequestRouter } from "./labRequestRoutes.js";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  let database: "connected" | "disconnected" = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "disconnected";
  }
  res.json({ status: "ok", database, uptime: process.uptime() });
});

apiRouter.use("/requests", labRequestRouter);
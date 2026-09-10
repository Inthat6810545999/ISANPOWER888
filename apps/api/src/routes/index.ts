import { Router } from "express";
import mongoose from "mongoose";
import { labRequestRouter } from "./labRequestRoutes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

apiRouter.use("/requests", labRequestRouter);

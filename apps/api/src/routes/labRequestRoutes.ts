import { Router } from "express";
import {
  createLabRequest,
  getLabRequest,
  listLabRequests,
  updateLabRequestStatus,
} from "../controllers/labRequestController.js";

export const labRequestRouter = Router();

labRequestRouter.get("/", listLabRequests);
labRequestRouter.post("/", createLabRequest);
labRequestRouter.get("/:id", getLabRequest);
labRequestRouter.patch("/:id/status", updateLabRequestStatus);

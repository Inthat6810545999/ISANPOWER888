import { Router } from "express";
import {
  createLabRequest,
  performTaAction,
  getLabRequest,
  listLabRequests,
  updateLabRequestStatus,
  updateLabRequestApprovalStatus,
} from "../controllers/labRequestController.js";

export const labRequestRouter = Router();

labRequestRouter.get("/", listLabRequests);
labRequestRouter.post("/", createLabRequest);
labRequestRouter.patch("/:id/ta-action", performTaAction);
labRequestRouter.get("/:id", getLabRequest);
labRequestRouter.patch("/:id/status", updateLabRequestStatus);
labRequestRouter.patch("/:id/approval-status", updateLabRequestApprovalStatus);

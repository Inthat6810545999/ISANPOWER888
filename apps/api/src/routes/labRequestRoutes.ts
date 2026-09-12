import { Router } from "express";
import { requireRole, requireSession } from "../auth/session.js";
import { createLabRequest, performTaAction, getLabRequest, listLabRequests, updateLabRequestStatus,
  updateLabRequestApprovalStatus, requestReports } from "../controllers/labRequestController.js";

export const labRequestRouter = Router();
labRequestRouter.use(requireSession);
labRequestRouter.get("/reports", requireRole("lab_manager"), requestReports);
labRequestRouter.get("/", requireRole("member", "ta", "lab_manager"), listLabRequests);
labRequestRouter.post("/", requireRole("member"), createLabRequest);
labRequestRouter.get("/:id", requireRole("member", "ta", "lab_manager"), getLabRequest);
labRequestRouter.patch("/:id/ta-action", requireRole("ta"), performTaAction);
labRequestRouter.patch("/:id/status", requireRole("ta"), updateLabRequestStatus);
labRequestRouter.patch("/:id/approval-status", requireRole("lab_manager"), updateLabRequestApprovalStatus);

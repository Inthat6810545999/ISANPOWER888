"use server";

import { createLabRequest, listLabRequests, performLabRequestTaAction, type LabRequest } from "@/lib/api";
import { DEMO_MEMBER, DEMO_TA, personFromEmail } from "./demo-identity";
import { CATEGORIES, PRIORITIES, type RequestDraft, type WorkspaceRequest } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toWorkspace(request: LabRequest): WorkspaceRequest {
  return { id: request.id, title: request.title, description: request.description,
    category: request.type, priority: request.priority, location: request.location,
    neededBy: request.neededBy?.slice(0, 10) ?? "", requiresApproval: request.requiresApproval,
    status: request.status, approvalStatus: request.approvalStatus,
    requester: personFromEmail(request.requesterEmail),
    assignee: request.assigneeEmail ? personFromEmail(request.assigneeEmail) : null,
    createdAt: request.createdAt };
}

function failure(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : "Unable to save or load requests.";
  return { ok: false, error: /fetch failed|abort|timeout/i.test(message)
    ? "Cannot connect to the local API. Check that the backend and database are running, then retry."
    : message };
}

export async function loadRequests(scope: "member" | "ta"): Promise<Result<WorkspaceRequest[]>> {
  try {
    if (scope !== "member" && scope !== "ta") throw new Error("Invalid workspace.");
    return { ok: true, data: (await listLabRequests(scope === "member" ? DEMO_MEMBER.id : undefined)).map(toWorkspace) };
  } catch (error) { return failure(error); }
}

export async function submitRequest(draft: RequestDraft): Promise<Result<WorkspaceRequest>> {
  try {
    if (!draft || typeof draft.title !== "string" || !draft.title.trim() || draft.title.length > 200 ||
        typeof draft.description !== "string" || !draft.description.trim() || draft.description.length > 4000 ||
        !Object.hasOwn(CATEGORIES, draft.category) || !PRIORITIES.includes(draft.priority) ||
        typeof draft.location !== "string" || draft.location.length > 200 ||
        typeof draft.requiresApproval !== "boolean" || typeof draft.neededBy !== "string") {
      throw new Error("Please check the request fields and try again.");
    }
    if (draft.neededBy && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.neededBy) ||
        !Number.isFinite(Date.parse(draft.neededBy)) || new Date(draft.neededBy).toISOString().slice(0, 10) !== draft.neededBy)) {
      throw new Error("Please choose a valid date.");
    }
    const saved = await createLabRequest({ title: draft.title.trim(), description: draft.description.trim(),
      type: draft.category, priority: draft.priority, location: draft.location.trim(),
      requiresApproval: draft.requiresApproval, neededBy: draft.neededBy ? `${draft.neededBy}T00:00:00.000Z` : undefined,
      requesterEmail: DEMO_MEMBER.id });
    return { ok: true, data: toWorkspace(saved) };
  } catch (error) { return failure(error); }
}

export async function changeTaRequest(id: string, action: "claim" | "start" | "close"): Promise<Result<WorkspaceRequest>> {
  try {
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id) || !["claim", "start", "close"].includes(action)) {
      throw new Error("Invalid request action.");
    }
    return { ok: true, data: toWorkspace(await performLabRequestTaAction(id, action, DEMO_TA.id)) };
  } catch (error) { return failure(error); }
}

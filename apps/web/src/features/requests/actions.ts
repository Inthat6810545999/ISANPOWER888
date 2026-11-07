"use server";

import { apiFetch, createLabRequest, listLabRequests, performLabRequestTaAction, reviewLabRequest, getReport, type TaAction, type LabRequest } from "@/lib/api";
import { personFromEmail } from "./demo-identity";
import { MEMBER_CATEGORIES, PRIORITIES, type RequestDraft, type WorkspaceRequest } from "./types";
import { validateCollaboration } from "@/features/industry-collaboration/validation";

import { requireActionRole } from "@/lib/session";
import type { Role } from "@/lib/session-types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "V";
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

/** Visitors have no lab account, so requesterEmail is empty by design.
 *  Identity comes from the staff-only visit record instead. */
function requesterOf(request: LabRequest) {
  if (request.source === "industry_collaboration" && request.collaboration) {
    const sender = request.collaboration;
    return { id: sender.submittedById, name: sender.submittedByName, initials: initialsOf(sender.submittedByName) };
  }
  const visit = request.visit;
  if (request.source === "visitor" && visit) {
    return { id: visit.email, name: visit.contactName, initials: initialsOf(visit.contactName) };
  }
  return personFromEmail(request.requesterEmail);
}

function toWorkspace(request: LabRequest): WorkspaceRequest {
  return { id: request.id, title: request.title, description: request.description,
    category: request.type, priority: request.priority, location: request.location,
    neededBy: request.neededBy?.slice(0, 10) ?? "", requiresApproval: request.requiresApproval,
    status: request.status, approvalStatus: request.approvalStatus,
    requester: requesterOf(request),
    assignee: request.assigneeEmail ? personFromEmail(request.assigneeEmail) : null,
    history: request.history,
    createdAt: request.createdAt, updatedAt: request.updatedAt, decision: request.decision, decisionHistory: request.decisionHistory,
    publicMessageUpdatedById: request.publicMessageUpdatedById ?? null,
    publicMessageUpdatedByName: request.publicMessageUpdatedByName ?? null,
    publicMessageUpdatedByEmail: request.publicMessageUpdatedByEmail ?? null,
    publicMessageUpdatedAt: request.publicMessageUpdatedAt ?? null,
    collaboration: request.collaboration ?? null,
    source: request.source ?? "member", publicMessage: request.publicMessage ?? "", visit: request.visit ?? null };
}

function failure(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : "Unable to save or load requests.";
  return { ok: false, error: /fetch failed|abort|timeout/i.test(message)
    ? "Cannot connect to the local API. Check that the backend and database are running, then retry."
    : message };
}

export async function loadRequests(scope: Role): Promise<Result<WorkspaceRequest[]>> {
  try {
    if (scope !== "member" && scope !== "ta" && scope !== "lab_manager") throw new Error("Invalid workspace.");
    await requireActionRole(scope);
    return { ok: true, data: (await listLabRequests()).map(toWorkspace) };
  } catch (error) { return failure(error); }
}

export async function submitRequest(draft: RequestDraft): Promise<Result<WorkspaceRequest>> {
  try {
    if (!draft || typeof draft.title !== "string" || !draft.title.trim() || draft.title.trim().length > 200 ||
        typeof draft.description !== "string" || !draft.description.trim() || draft.description.trim().length > 4000 ||
        !Object.hasOwn(MEMBER_CATEGORIES, draft.category) || !PRIORITIES.includes(draft.priority) ||
        typeof draft.location !== "string" || draft.location.trim().length > 200 ||
        typeof draft.neededBy !== "string") {
      throw new Error("Please check the request fields and try again.");
    }
    if (draft.neededBy && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.neededBy) ||
        !Number.isFinite(Date.parse(draft.neededBy)) || new Date(draft.neededBy).toISOString().slice(0, 10) !== draft.neededBy)) {
      throw new Error("Please choose a valid date.");
    }
    await requireActionRole("member");
    const saved = await createLabRequest({ title: draft.title.trim(), description: draft.description.trim(),
      type: draft.category, priority: draft.priority, location: draft.location.trim(),
      neededBy: draft.neededBy ? `${draft.neededBy}T00:00:00.000Z` : undefined,
 });
    return { ok: true, data: toWorkspace(saved) };
  } catch (error) { return failure(error); }
}

export async function changeTaRequest(id: string, payload: TaAction): Promise<Result<WorkspaceRequest>> {
  try {
    await requireActionRole("ta");
    return { ok: true, data: toWorkspace(await performLabRequestTaAction(id, payload)) };
  } catch (error) { return failure(error); }
}

/** `reason` stays internal. `publicMessage` is the only text sent to the requester,
 *  so it is passed through separately and never derived from the reason. */
export async function reviewRequest(id: string, decision: "approved" | "rejected", reason: string, publicMessage?: string): Promise<Result<WorkspaceRequest>> {
  try {
    if (publicMessage !== undefined && (typeof publicMessage !== "string" || publicMessage.trim().length > 2000)) {
      throw new Error("The message to the requester must be 2000 characters or fewer.");
    }
    await requireActionRole("lab_manager");
    return { ok: true, data: toWorkspace(await reviewLabRequest(id, decision, reason, publicMessage?.trim())) };
  } catch (error) { return failure(error); }
}

export async function loadReport(from = "", to = "") {
  await requireActionRole("lab_manager");
  return getReport(from, to);
}

export async function submitCollaboration(input: unknown): Promise<Result<WorkspaceRequest & { trackingCode: string }>> {
  try {
    await requireActionRole("ta");
    const { values, errors } = validateCollaboration(input);
    if (Object.keys(errors).length) throw new Error("Please check the collaboration fields and try again.");
    const receipt = await apiFetch<{ data: LabRequest; trackingCode: string }>("/requests/industry-collaboration", {
      method: "POST", body: JSON.stringify(values),
    });
    return { ok: true, data: { ...toWorkspace(receipt.data), trackingCode: receipt.trackingCode } };
  } catch (error) { return failure(error); }
}

export async function loadCollaboration(id: string): Promise<Result<WorkspaceRequest>> {
  try {
    await requireActionRole("ta");
    const { data } = await apiFetch<{ data: LabRequest }>(`/requests/${encodeURIComponent(id)}`);
    if (data.source !== "industry_collaboration") throw new Error("Industry collaboration request not found.");
    return { ok: true, data: toWorkspace(data) };
  } catch (error) { return failure(error); }
}

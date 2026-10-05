import "server-only";
import { apiBaseUrl, sessionToken } from "./session";
import type { ApprovalStatus, RequestStatus } from "./request-status";
export { REQUEST_STATUSES, APPROVAL_STATUSES, type RequestStatus, type ApprovalStatus } from "./request-status";
export const REQUEST_TYPES = ["equipment", "space", "consumable", "access", "visitor", "general"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export type ApprovalDecision = { id: string; outcome: ApprovalStatus; reason: string; reviewerName: string; reviewerEmail: string; reviewedAt: string; supersededAt?: string | null };
/** Staff-only contact and scheduling detail for Visitor requests. Never shown publicly. */
export type VisitDetails = {
  contactName: string; email: string; phone: string; organization: string;
  purpose: "tour" | "study" | "collaboration" | "other"; details: string;
  visitDate: string; timeSlot: "morning" | "afternoon";
  visitorCount: number; requestedHost: string; arrangements: string;
};
export const REQUEST_SOURCES = ["member", "visitor"] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];
export type LabRequest = {
  id: string; title: string; description: string; type: RequestType; status: RequestStatus;
  approvalStatus: ApprovalStatus; requiresApproval: boolean; priority: "low" | "medium" | "high";
  location: string; requesterEmail: string; neededBy: string | null; assigneeEmail: string | null;
  createdAt: string; updatedAt: string; decision: ApprovalDecision | null; decisionHistory: ApprovalDecision[];
  source?: RequestSource; publicMessage?: string | null; visit?: VisitDetails | null;
};
export type Report = { total: number; generatedAt: string; byStatus: { label: string; count: number }[]; byApproval: { label: string; count: number }[]; byType: { label: string; count: number }[] };
export type TaAction = { action: "claim" | "start" | "close" };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await sessionToken();
  if (!token) throw new Error("Sign in to continue.");
  const res = await fetch(`${apiBaseUrl}/api${path}`, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers, Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `API request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
export async function listLabRequests(): Promise<LabRequest[]> {
  return (await apiFetch<{ data: LabRequest[] }>("/requests")).data;
}
export async function createLabRequest(input: { title: string; description?: string; type: RequestType; priority?: LabRequest["priority"]; location?: string; neededBy?: string }): Promise<LabRequest> {
  return (await apiFetch<{ data: LabRequest }>("/requests", { method: "POST", body: JSON.stringify(input) })).data;
}
export async function performLabRequestTaAction(id: string, payload: TaAction): Promise<LabRequest> {
  return (await apiFetch<{ data: LabRequest }>(`/requests/${encodeURIComponent(id)}/ta-action`, { method: "PATCH", body: JSON.stringify(payload) })).data;
}
/** `reason` is the internal record; `publicMessage` is the only text a Visitor can read.
 *  Omitting publicMessage preserves the stored one; an empty string clears it. */
export async function reviewLabRequest(id: string, approvalStatus: "approved" | "rejected", reason: string, publicMessage?: string): Promise<LabRequest> {
  return (await apiFetch<{ data: LabRequest }>(`/requests/${encodeURIComponent(id)}/approval-status`, {
    method: "PATCH",
    body: JSON.stringify({ approvalStatus, reason, ...(publicMessage !== undefined ? { publicMessage } : {}) }),
  })).data;
}
export async function getReport(from: string, to: string): Promise<Report> {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return (await apiFetch<{ data: Report }>(`/requests/reports?${query}`)).data;
}

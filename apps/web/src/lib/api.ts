import "server-only";
import type { ApprovalStatus, RequestStatus } from "./request-status";
export { REQUEST_STATUSES, APPROVAL_STATUSES, type RequestStatus, type ApprovalStatus } from "./request-status";

export const REQUEST_TYPES = [
  "equipment",
  "space",
  "consumable",
  "access",
  "visitor",
  "general",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export type LabRequest = {
  id: string;
  title: string;
  description: string;
  type: RequestType;
  status: RequestStatus;
  approvalStatus: ApprovalStatus;
  requiresApproval: boolean;
  priority: "low" | "medium" | "high";
  location: string;
  requesterEmail: string;
  neededBy: string | null;
  assigneeEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function listLabRequests(requesterEmail?: string): Promise<LabRequest[]> {
  const query = requesterEmail ? `?requesterEmail=${encodeURIComponent(requesterEmail)}` : "";
  const { data } = await apiFetch<{ data: LabRequest[] }>(`/requests${query}`);
  return data;
}

export async function createLabRequest(input: {
  title: string;
  description?: string;
  type: RequestType;
  requesterEmail: string;
  priority?: LabRequest["priority"];
  location?: string;
  requiresApproval?: boolean;
  neededBy?: string;
}): Promise<LabRequest> {
  const { data } = await apiFetch<{ data: LabRequest }>("/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

export async function updateLabRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<LabRequest> {
  const { data } = await apiFetch<{ data: LabRequest }>(`/requests/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data;
}

export async function updateLabRequestApprovalStatus(id: string, approvalStatus: ApprovalStatus): Promise<LabRequest> {
  const { data } = await apiFetch<{ data: LabRequest }>(`/requests/${id}/approval-status`, {
    method: "PATCH",
    body: JSON.stringify({ approvalStatus }),
  });
  return data;
}

export async function performLabRequestTaAction(id: string, action: "claim" | "start" | "close", assigneeEmail: string): Promise<LabRequest> {
  const { data } = await apiFetch<{ data: LabRequest }>(`/requests/${encodeURIComponent(id)}/ta-action`, {
    method: "PATCH", body: JSON.stringify({ action, assigneeEmail }),
  });
  return data;
}

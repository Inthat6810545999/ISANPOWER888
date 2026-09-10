import "server-only";

export const REQUEST_TYPES = [
  "equipment",
  "space",
  "consumable",
  "access",
  "visitor",
  "general",
] as const;

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type LabRequest = {
  _id: string;
  title: string;
  description: string;
  type: RequestType;
  status: RequestStatus;
  requesterEmail: string;
  neededBy?: string;
  createdAt: string;
  updatedAt: string;
};

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function listLabRequests(): Promise<LabRequest[]> {
  const { data } = await apiFetch<{ data: LabRequest[] }>("/requests");
  return data;
}

export async function createLabRequest(input: {
  title: string;
  description?: string;
  type: RequestType;
  requesterEmail: string;
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

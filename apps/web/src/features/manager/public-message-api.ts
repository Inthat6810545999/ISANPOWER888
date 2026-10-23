import "server-only";
import { apiBaseUrl, sessionToken } from "@/lib/session";
import type { LabRequest } from "@/lib/api";

export class PublicMessageError extends Error {
  constructor(public status: number) { super(`Public message request failed (${status}).`); }
}

/** Keep the session token exclusively on the server, including conflict reloads. */
export async function publicMessageRequest(id: string, publicMessage?: string): Promise<LabRequest> {
  const token = await sessionToken();
  if (!token) throw new PublicMessageError(401);
  const updating = publicMessage !== undefined;
  const response = await fetch(`${apiBaseUrl}/api/requests/${encodeURIComponent(id)}${updating ? "/public-message" : ""}`, {
    method: updating ? "PATCH" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(updating ? { body: JSON.stringify({ publicMessage }) } : {}),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new PublicMessageError(response.status);
  return (await response.json()).data;
}

"use server";

import { sessionUser } from "@/lib/session";
import { hasInternalAccess } from "@/lib/session-types";
import type { LabRequest } from "@/lib/api";
import { PublicMessageError, publicMessageRequest } from "./public-message-api";

type Result = { ok: true; data: LabRequest } | { ok: false; status: number; error: string };
const messages: Record<number, string> = {
  400: "Please check your message. Use no more than 2,000 characters.",
  401: "Your session has expired. Sign in again, then retry. Your draft is still here.",
  403: "Your current role or membership does not allow editing this message.",
  404: "This request is no longer available.",
  409: "This request is no longer eligible for message editing. Reloading its details; your draft is kept. Nothing was saved.",
  413: "The message is too large. Shorten it and try again.",
};
async function authorize() {
  const user = await sessionUser();
  if (!user) throw new PublicMessageError(401);
  if (!hasInternalAccess(user) || user.role !== "lab_manager") throw new PublicMessageError(403);
}
function failure(error: unknown): Result {
  const status = error instanceof PublicMessageError ? error.status : 500;
  return { ok: false, status, error: messages[status] ?? "Unable to save or load the message. Your draft is kept. Please try again." };
}
export async function savePublicMessage(id: string, message: string): Promise<Result> {
  try {
    await authorize();
    if (typeof id !== "string" || !id || typeof message !== "string" || message.trim().length > 2000) throw new PublicMessageError(400);
    return { ok: true, data: await publicMessageRequest(id, message.trim()) };
  } catch (error) { return failure(error); }
}
export async function reloadPublicMessageRequest(id: string): Promise<Result> {
  try {
    await authorize();
    if (typeof id !== "string" || !id) throw new PublicMessageError(400);
    return { ok: true, data: await publicMessageRequest(id) };
  } catch (error) { return failure(error); }
}

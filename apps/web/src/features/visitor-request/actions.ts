"use server";

import { apiBaseUrl } from "@/lib/session";
import { isVisitReceipt, validateVisit, type SubmitResult } from "./validation";

// Intentionally public: this action never forwards an internal user's session.
export async function submitVisit(input: unknown): Promise<SubmitResult> {
  const { values, errors } = validateVisit(input);
  if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: errors };
  try {
    const response = await fetch(`${apiBaseUrl}/api/visits`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, visitorCount: Number(values.visitorCount) }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404 || response.status === 501 || response.status === 503) {
      return { ok: false, error: "Visit requests are currently unavailable. Your form is still here; please try again later." };
    }
    if (response.status === 429) return { ok: false, error: "Too many attempts. Please wait a few minutes before trying again." };
    if (response.status === 400 || response.status === 422) return { ok: false, error: "The request could not be accepted. Check your details and try again." };
    if (response.status !== 201) return { ok: false, error: "We could not confirm your submission. Your details have been kept on this page." };
    const body: unknown = await response.json();
    const data = body && typeof body === "object" && "data" in body ? body.data : null;
    if (!isVisitReceipt(data)) return { ok: false, error: "The service did not return a valid tracking code. Your request may have been saved; please contact the lab before submitting again." };
    return { ok: true, receipt: data };
  } catch {
    return { ok: false, error: "We could not confirm whether your request was saved. Please check your connection and contact the lab before submitting again." };
  }
}

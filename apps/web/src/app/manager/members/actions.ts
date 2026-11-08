"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionRole } from "@/lib/session";
import { sessionHome } from "@/lib/session-types";
import { apiFetch } from "@/lib/api";
import type { HistoryPage, ManagedMember } from "./types";

type Result = { error: string; success?: string };
export async function approveMember(_previous: Result, form: FormData): Promise<Result> {
  try {
    await requireActionRole("lab_manager");
    await apiFetch(`/memberships/${encodeURIComponent(String(form.get("id") ?? ""))}/approve`, {
      method: "POST", body: JSON.stringify({ role: String(form.get("role") ?? "") }),
    });
    revalidatePath("/manager/members");
    return { error: "", success: "Registration approved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to approve registration." };
  }
}
export async function updateMember(_previous: Result, form: FormData): Promise<Result> {
  let destination = "";
  try {
    const actor = await requireActionRole("lab_manager");
    const action = String(form.get("action"));
    const version = form.get("version");
    if (typeof version !== "string" || !/^\d+$/.test(version)) throw new Error("Refresh members before saving.");
    if (action !== "role" && action !== "active") throw new Error("Invalid member action.");
    if (action === "active" && !["true", "false"].includes(String(form.get("active")))) throw new Error("Invalid account status.");
    const body = { action, expectedVersion: Number(version), ...(action === "role" ? { role: String(form.get("role")) } : { active: form.get("active") === "true" }) };
    const { data } = await apiFetch<{ data: ManagedMember }>(`/memberships/${encodeURIComponent(String(form.get("id") ?? ""))}`, { method: "PATCH", body: JSON.stringify(body) });
    revalidatePath("/manager/members");
    if (actor.id === data.id && (!data.active || data.role !== "lab_manager")) destination = data.active ? sessionHome(data) : "/login";
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update member." };
  }
  // Redirect outside catch: Next implements redirects by throwing.
  if (destination) redirect(destination);
  return { error: "", success: "Member updated." };
}
export async function memberHistory(id: string, before?: number): Promise<{ history?: HistoryPage; error?: string }> {
  try {
    await requireActionRole("lab_manager");
    const history = await apiFetch<HistoryPage>(`/memberships/${encodeURIComponent(id)}/history${before ? `?before=${encodeURIComponent(before)}` : ""}`);
    return { history };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load member history." };
  }
}

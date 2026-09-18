"use server";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/session";
import { apiFetch } from "@/lib/api";

export async function approveMember(_previous: { error: string }, form: FormData) {
  try {
    await requireActionRole("lab_manager");
    await apiFetch(`/memberships/${encodeURIComponent(String(form.get("id") ?? ""))}/approve`, {
      method: "POST", body: JSON.stringify({ role: String(form.get("role") ?? "") }),
    });
    revalidatePath("/manager/members");
    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to approve registration." };
  }
}

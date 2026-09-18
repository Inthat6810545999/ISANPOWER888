"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { requireActionRole } from "@/lib/session";

export async function saveUser(_previous: { message: string; ok: boolean }, form: FormData) {
  try {
    await requireActionRole("admin");
    const id = String(form.get("id") ?? "");
    const data = { name: String(form.get("name") ?? ""), role: String(form.get("role") ?? "") };
    await apiFetch(`/admin/users${id ? `/${encodeURIComponent(id)}` : ""}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(id ? { ...data, active: form.get("active") === "on" } : {
        ...data, email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""),
      }),
    });
    revalidatePath("/admin");
    return { message: id ? "Account updated." : "Account created. Share the initial password with the user securely.", ok: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save account.", ok: false };
  }
}

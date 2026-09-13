"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl, SESSION_COOKIE, sessionToken } from "@/lib/session";
import { roleHome, type SessionUser } from "@/lib/session-types";

export async function login(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
  let user: SessionUser;
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") }),
    });
    const body = await response.json();
    if (!response.ok) return { error: body.error ?? "Unable to sign in." };
    user = body.user;
    (await cookies()).set(SESSION_COOKIE, body.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(body.expiresAt) });
  } catch { return { error: "Cannot reach the API. Check that your backend and database are running." }; }
  redirect(roleHome[user.role]);
}

export async function logout(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    const res = await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok && res.status !== 401) throw new Error("Unable to sign out. Retry when the API is available.");
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

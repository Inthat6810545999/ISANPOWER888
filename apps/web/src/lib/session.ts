import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { roleHome, type Role, type SessionUser } from "./session-types";

export const SESSION_COOKIE = "isanpower_session";
export const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function sessionToken() { return (await cookies()).get(SESSION_COOKIE)?.value; }
export async function sessionUser(): Promise<SessionUser | null> {
  const token = await sessionToken();
  if (!token) return null;
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to verify your session.");
  return (await response.json()).user;
}
export async function requireUser(role: Role) {
  const user = await sessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(roleHome[user.role]);
  return user;
}
// Actions return errors rather than redirecting inside their error handlers.
export async function requireActionRole(role: Role) {
  const user = await sessionUser();
  if (!user) throw new Error("Session expired. Sign in again.");
  if (user.role !== role) throw new Error("Your role cannot perform this action.");
  return user;
}

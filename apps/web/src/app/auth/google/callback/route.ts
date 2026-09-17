import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiBaseUrl, SESSION_COOKIE } from "@/lib/session";
import { sessionHome } from "@/lib/session-types";
import { OAUTH_COOKIE, oauthCookieOptions, oauthError, webOrigin } from "@/lib/google-oauth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.has("error")) return oauthError("google_cancelled");
  const code = query.get("code"), state = query.get("state");
  const binding = (await cookies()).get(OAUTH_COOKIE)?.value;
  if (!code || !state || !binding) return oauthError("google_expired");
  try {
    const result = await fetch(`${apiBaseUrl}/api/auth/google/callback`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state, binding }), cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!result.ok) return oauthError(result.status === 409 ? "google_link" : result.status === 403 ? "account_inactive" : "google_failed");
    const body = await result.json();
    const response = NextResponse.redirect(new URL(sessionHome(body.user), webOrigin()));
    response.cookies.set(SESSION_COOKIE, body.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(body.expiresAt) });
    response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return oauthError("google_failed"); }
}

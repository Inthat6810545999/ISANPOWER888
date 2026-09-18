import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/session";
import { OAUTH_COOKIE, oauthCookieOptions, oauthError, webOrigin } from "@/lib/google-oauth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  // Next may normalize request.url to localhost. Compare the browser's Host
  // instead; redirect destinations always come from trusted server config.
  if (request.headers.get("host") !== new URL(webOrigin()).host) return NextResponse.redirect(new URL("/auth/google/start", webOrigin()));
  try {
    const binding = randomBytes(32).toString("hex");
    const result = await fetch(`${apiBaseUrl}/api/auth/google/start`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding }), cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!result.ok) return oauthError(result.status === 503 ? "google_unavailable" : "google_failed");
    const { authorizationUrl } = await result.json();
    const target = new URL(authorizationUrl);
    if (target.origin !== "https://accounts.google.com") return oauthError("google_failed");
    const response = NextResponse.redirect(target);
    response.cookies.set(OAUTH_COOKIE, binding, oauthCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return oauthError("google_unavailable"); }
}

import "server-only";
import { NextResponse } from "next/server";
export const OAUTH_COOKIE = "isanpower_google_binding";
export const oauthCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/auth/google", maxAge: 600 };
export function webOrigin() {
  const value = new URL(process.env.APP_BASE_URL ?? "http://127.0.0.1:3000");
  return value.origin;
}
export function oauthError(code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, webOrigin()));
  response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

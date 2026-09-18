import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler.js";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 10000 });
export type GoogleIdentity = { subject: string; email: string; name: string; authoritativeEmail: boolean };
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) throw new HttpError(503, "Google sign-in is not configured.");
  const uri = new URL(redirectUri);
  if (uri.pathname !== "/auth/google/callback" || uri.search || uri.hash || uri.username || uri.password ||
      (uri.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && uri.protocol === "http:" && ["localhost", "127.0.0.1"].includes(uri.hostname)))) {
    throw new HttpError(503, "Google sign-in configuration is invalid.");
  }
  return { clientId, clientSecret, redirectUri };
}

/** Only signed, issuer/audience/expiry/nonce-verified claims reach account resolution. */
export async function verifyGoogleIdToken(idToken: string, nonce: string, audience: string, keys: JWTVerifyGetKey = googleKeys): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, keys, {
    algorithms: ["RS256"], issuer: ["https://accounts.google.com", "accounts.google.com"], audience,
    requiredClaims: ["exp", "iat", "sub", "nonce", "email", "email_verified"],
    maxTokenAge: "10m", clockTolerance: 5,
  });
  if (payload.nonce !== nonce || payload.aud !== audience || (payload.azp !== undefined && payload.azp !== audience) || payload.email_verified !== true || !payload.sub) {
    throw new Error("Invalid Google identity claims");
  }
  const email = z.email().parse(payload.email).toLowerCase();
  return { subject: payload.sub, email, name: typeof payload.name === "string" && payload.name.trim() ? payload.name.slice(0, 200) : email,
    authoritativeEmail: email.endsWith("@gmail.com") || (typeof payload.hd === "string" && payload.hd.length > 0) };
}

export async function exchangeGoogleCode(code: string, codeVerifier: string, nonce: string): Promise<GoogleIdentity> {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: codeVerifier }),
  });
  if (!response.ok) throw new Error("Google code exchange failed");
  const tokens = await response.json() as { id_token?: unknown };
  if (typeof tokens.id_token !== "string") throw new Error("Google ID token missing");
  // Access and refresh tokens are not needed for authentication and are never stored.
  return verifyGoogleIdToken(tokens.id_token, nonce, config.clientId);
}

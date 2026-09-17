import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import * as google from "../auth/google.js";
import { resolveGoogleAccount } from "../auth/google-account.js";
import { issueSession, tokenHash } from "../auth/session.js";

const app = createApp("http://127.0.0.1:3000");
const identity: google.GoogleIdentity = { subject: "google-person-123", email: "new.member@gmail.com", name: "New Member", authoritativeEmail: true };
beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-only-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:3000/auth/google/callback");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function begin() {
  const binding = randomBytes(32).toString("hex");
  const response = await request(app).post("/api/auth/google/start").send({ binding }).expect(200);
  const url = new URL(response.body.authorizationUrl);
  return { binding, url, state: url.searchParams.get("state")! };
}
const finish = (flow: { binding: string; state: string }) => request(app).post("/api/auth/google/callback").send({ ...flow, code: "test-authorization-code" });

describe("Google authorization flow", () => {
  it("fails clearly before redirecting when OAuth secrets are absent", async () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    await request(app).post("/api/auth/google/start").send({ binding: "a".repeat(64) }).expect(503);
    expect(await prisma.oAuthAttempt.count()).toBe(0);
  });
  it("generates a browser-bound expiring flow with nonce and PKCE, without exposing secrets", async () => {
    const flow = await begin();
    expect(flow.url.origin).toBe("https://accounts.google.com");
    expect(flow.url.searchParams.get("scope")).toBe("openid email profile");
    expect(flow.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow.url.searchParams.get("nonce")).toMatch(/^[a-f0-9]{64}$/);
    expect(flow.url.searchParams.has("client_secret")).toBe(false);
    const attempt = await prisma.oAuthAttempt.findUniqueOrThrow({ where: { stateHash: tokenHash(flow.state) } });
    expect(attempt.bindingHash).toBe(tokenHash(flow.binding));
    expect(attempt.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it("creates exactly one unassigned pending user and allows only identity/logout", async () => {
    const exchange = vi.spyOn(google, "exchangeGoogleCode").mockResolvedValue(identity);
    const { binding, state } = await begin();
    const signedIn = await finish({ binding, state }).expect(200);
    expect(exchange).toHaveBeenCalledWith("test-authorization-code", expect.any(String), expect.any(String));
    expect(signedIn.body.user).toMatchObject({ role: "unassigned", membershipStatus: "PENDING", email: identity.email });
    expect(signedIn.body.user.passwordHash).toBeUndefined();
    const auth = { Authorization: `Bearer ${signedIn.body.token}` };
    await request(app).get("/api/auth/me").set(auth).expect(200);
    await request(app).get("/api/requests").set(auth).expect(403);
    await request(app).get("/api/requests/reports").set(auth).expect(403);
    await request(app).get("/api/auth/assignees").set(auth).expect(403);
    await request(app).post("/api/requests").set(auth).send({ title: "No access", type: "general" }).expect(403);
    for (const endpoint of ["ta-action", "approval-status", "status"]) await request(app).patch(`/api/requests/missing/${endpoint}`).set(auth).send({}).expect(403);
    await request(app).post("/api/auth/logout").set(auth).expect(200);
    await request(app).get("/api/auth/me").set(auth).expect(401);
    const again = await begin();
    await finish({ binding: again.binding, state: again.state }).expect(200);
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findFirstOrThrow()).passwordHash).toBeNull();
  });
  it("rejects state tampering, wrong browser binding, expiry and replay before exchange", async () => {
    const exchange = vi.spyOn(google, "exchangeGoogleCode").mockResolvedValue(identity);
    const { binding, state } = await begin();
    await finish({ binding: "0".repeat(64), state }).expect(400);
    await finish({ binding, state: "0".repeat(64) }).expect(400);
    expect(exchange).not.toHaveBeenCalled();
    await finish({ binding, state }).expect(200);
    await finish({ binding, state }).expect(400);
    expect(exchange).toHaveBeenCalledTimes(1);
    const expired = await begin();
    await prisma.oAuthAttempt.update({ where: { stateHash: tokenHash(expired.state) }, data: { expiresAt: new Date(0) } });
    await finish({ binding: expired.binding, state: expired.state }).expect(400);
  });
  it("consumes a failed exchange, creates no user/session, and rejects forged role fields", async () => {
    vi.spyOn(google, "exchangeGoogleCode").mockRejectedValue(new Error("Invalid signature"));
    const { binding, state } = await begin();
    await request(app).post("/api/auth/google/callback").send({ binding, state, code: "code", role: "lab_manager" }).expect(400);
    await finish({ binding, state }).expect(401);
    await finish({ binding, state }).expect(400);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });
});

describe("existing accounts and membership gates", () => {
  it.each(["member", "ta", "lab_manager"] as const)("preserves existing %s role, profile, ID and membership when linking Google", async (role) => {
    const original = await prisma.user.create({ data: { email: identity.email, name: "Original name", role, membershipStatus: "APPROVED", passwordHash: "original-hash" } });
    const linked = await resolveGoogleAccount(identity);
    expect(linked).toMatchObject({ ...original, googleSubject: identity.subject });
    const repeat = await resolveGoogleAccount({ ...identity, email: "changed-google-email@gmail.com", name: "Changed Google name" });
    expect(repeat).toEqual(linked);
    expect(await prisma.user.count()).toBe(1);
  });
  it("keeps existing PENDING status and denies internal actions regardless of assigned role", async () => {
    const existing = await prisma.user.create({ data: { email: identity.email, name: "Pending manager", role: "lab_manager", membershipStatus: "PENDING" } });
    const linked = await resolveGoogleAccount(identity);
    expect(linked.membershipStatus).toBe("PENDING");
    const session = await issueSession(linked);
    const auth = { Authorization: `Bearer ${session.token}`, "X-Role": "lab_manager", "X-Membership-Status": "APPROVED" };
    await request(app).get("/api/auth/me").set(auth).expect(200);
    await request(app).get("/api/requests/missing").set(auth).expect(403);
    await request(app).get("/api/requests/reports").set(auth).expect(403);
    await request(app).patch("/api/requests/missing/approval-status").set(auth).send({ approvalStatus: "approved", reason: "Forged" }).expect(403);
    await prisma.user.update({ where: { id: existing.id }, data: { membershipStatus: "APPROVED" } });
    await request(app).get("/api/requests/reports").set(auth).expect(200);
    await prisma.user.update({ where: { id: existing.id }, data: { role: "unassigned" } });
    await request(app).get("/api/requests/reports").set(auth).expect(403);
  });
  it("refuses inactive users, subject collisions, and unsafe third-party email linking", async () => {
    const existing = await prisma.user.create({ data: { email: identity.email, name: "Old", role: "ta", membershipStatus: "APPROVED", active: false } });
    await expect(resolveGoogleAccount(identity)).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({ where: { id: existing.id }, data: { active: true } });
    await expect(resolveGoogleAccount({ ...identity, authoritativeEmail: false })).rejects.toMatchObject({ status: 409 });
    await prisma.user.update({ where: { id: existing.id }, data: { googleSubject: "another-google-subject" } });
    await expect(resolveGoogleAccount(identity)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count()).toBe(1);
  });
  it("does not duplicate users during concurrent first sign-ins", async () => {
    const users = await Promise.all([resolveGoogleAccount(identity), resolveGoogleAccount(identity)]);
    expect(users[0]!.id).toBe(users[1]!.id);
    expect(await prisma.user.count()).toBe(1);
  });
  it("Guest cannot grant itself membership through headers or payloads", async () => {
    await request(app).get("/api/requests").set("X-Role", "guest").expect(401);
    await request(app).get("/api/requests/reports").set("X-Role", "lab_manager").expect(401);
    await request(app).post("/api/requests").send({ title: "Guest", role: "member", membershipStatus: "APPROVED" }).expect(401);
  });
});

describe("Google ID token verification with real signatures", () => {
  let pair: Awaited<ReturnType<typeof generateKeyPair>>;
  let keys: ReturnType<typeof createLocalJWKSet>;
  beforeAll(async () => {
    pair = await generateKeyPair("RS256");
    keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: "test-key", alg: "RS256", use: "sig" }] });
  });
  async function signed(overrides: JWTPayload = {}, signingKey = pair.privateKey) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ iss: "https://accounts.google.com", aud: "client", sub: "subject", iat: now, exp: now + 300, nonce: "expected-nonce",
      email: "person@gmail.com", email_verified: true, name: "Person", ...overrides }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(signingKey);
  }
  it("accepts only a verified signed Google identity", async () => {
    expect(await google.verifyGoogleIdToken(await signed(), "expected-nonce", "client", keys)).toMatchObject({ subject: "subject", email: "person@gmail.com", authoritativeEmail: true });
    const external = await signed({ email: "person@external.example" });
    expect((await google.verifyGoogleIdToken(external, "expected-nonce", "client", keys)).authoritativeEmail).toBe(false);
  });
  it.each([
    { iss: "https://attacker.example" }, { aud: "another-client" }, { exp: 1 }, { nonce: "wrong" },
    { email_verified: false }, { azp: "another-client" }, { sub: "" }, { email: "invalid" },
  ])("rejects invalid claims %j", async (claims) => {
    await expect(google.verifyGoogleIdToken(await signed(claims), "expected-nonce", "client", keys)).rejects.toThrow();
  });
  it("rejects a forged signature even with valid-looking claims", async () => {
    const attacker = await generateKeyPair("RS256");
    await expect(google.verifyGoogleIdToken(await signed({}, attacker.privateKey), "expected-nonce", "client", keys)).rejects.toThrow();
  });
});

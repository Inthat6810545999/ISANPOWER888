import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import * as contract from "../visits/contract.js";

const app = createApp("http://localhost:3000");
const input = { contactName: "PRIVATE_CONTACT", email: "private@example.test", purpose: "tour", details: "PRIVATE_DETAILS", visitDate: "2099-12-01", timeSlot: "morning", visitorCount: 2 };
const endpoint = "/api/visits/track";
const track = (code: unknown) => request(app).post(endpoint).send({ code });
const noStore = (response: { headers: Record<string, unknown> }) => expect(response.headers["cache-control"]).toBe("no-store");
async function receipt() { return (await request(app).post("/api/visits").send(input).expect(201)).body.data; }
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("public tracking HTTP contract", () => {
  it("canonicalizes configured CORS origin before preflight and uniform not-found responses", async () => {
    const origin = "http://127.0.0.1:3000";
    const local = createApp(`${origin}/`);
    const preflight = await request(local).options(endpoint).set("Origin", origin)
      .set("Access-Control-Request-Method", "POST").set("Access-Control-Request-Headers", "content-type").expect(204);
    noStore(preflight);
    expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
    for (const code of ["โค้ดผิดรูปแบบ", "Z".repeat(43)]) {
      const response = await request(local).post(endpoint).set("Origin", origin).send({ code }).expect(404);
      noStore(response);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      expect(response.body).toEqual({ error: "Visit request not found." });
    }
    const other = await request(local).options(endpoint).set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST").expect(403);
    noStore(other);
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    expect(other.body).toEqual({ error: "Origin not allowed." });
  });

  it("works without a session and explicitly allowlists the persisted result", async () => {
    const { requestId, trackingCode } = await receipt();
    const result = await track(trackingCode).expect(200);
    noStore(result);
    expect(result.body).toEqual({ data: { status: "pending", approvalStatus: "submitted", publicMessage: "", visitDate: input.visitDate, timeSlot: "morning" } });
    for (const privateValue of [requestId, trackingCode, contract.hashTrackingCode(trackingCode), input.contactName, input.email, input.details]) {
      expect(JSON.stringify(result.body)).not.toContain(privateValue);
    }
    // Additional helper fields must not become public if its implementation changes.
    const extra = { ...result.body.data, requestId, reason: "PRIVATE", decisionHistory: ["PRIVATE"], contactName: "PRIVATE", codeHash: "PRIVATE" };
    vi.spyOn(contract, "findPublicVisit").mockResolvedValueOnce(extra);
    expect((await track(trackingCode).expect(200)).body).toEqual(result.body);
  });

  it("returns identical status/body for missing, non-string, malformed and unknown codes", async () => {
    const unknown = await track("Z".repeat(43)).expect(404);
    noStore(unknown);
    for (const code of [undefined, null, 7, {}, [], "", "wrong", "A".repeat(42)]) {
      const result = await track(code).expect(unknown.status);
      noStore(result);
      expect(result.body).toEqual(unknown.body);
    }
  });

  it("passes exact case and whitespace through to the helper", async () => {
    const { trackingCode } = await receipt();
    const spy = vi.spyOn(contract, "findPublicVisit");
    await track(trackingCode).expect(200);
    const changed = trackingCode.replace(/[A-Za-z]/, (letter: string) => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase());
    expect(changed).not.toBe(trackingCode);
    await track(changed).expect(404);
    await track(` ${trackingCode} `).expect(404);
    expect(spy.mock.calls.map(call => call[0])).toEqual([trackingCode, changed, ` ${trackingCode} `]);
  });

  it.each([["closed", "approved"], ["pending", "rejected"]] as const)("finds %s / %s requests", async (status, approvalStatus) => {
    const { requestId, trackingCode } = await receipt();
    await prisma.labRequest.update({ where: { id: requestId }, data: { status, approvalStatus, publicMessage: "Public update" } });
    const result = await track(trackingCode).expect(200);
    noStore(result);
    expect(result.body.data).toEqual({ status, approvalStatus, publicMessage: "Public update", visitDate: input.visitDate, timeSlot: "morning" });
  });

  it("counts invalid attempts across API instances and separates tracking from submission", async () => {
    // Freeze Date only so this test cannot cross a fixed-window boundary.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T00:00:01Z"));
    for (let i = 0; i < 10; i++) await track("bad").expect(404);
    const response = await request(createApp("http://localhost:3000")).post(endpoint)
      .set("X-Forwarded-For", "192.0.2.123").set("Origin", "http://localhost:3000").send({ code: "bad" }).expect(429);
    noStore(response);
    expect(response.headers["retry-after"]).toBe("59");
    expect(response.headers["access-control-expose-headers"]).toBe("Retry-After");
    expect(response.body).toEqual({ error: "Too many requests. Please try again later." });
    await receipt();
    const buckets = await prisma.publicRateLimit.findMany();
    expect(buckets.map(bucket => [bucket.key.split(":")[0], bucket.count]).sort()).toEqual([["visit-submit", 1], ["visit-track", 11]]);
  });

  it("sets no-store before malformed JSON and oversized-body errors and counts both", async () => {
    const malformed = await request(app).post(endpoint).set("Content-Type", "application/json").send('{"code":').expect(400);
    noStore(malformed);
    expect(malformed.body).toEqual({ error: "Invalid tracking request." });
    const oversized = await track("x".repeat(110_000)).expect(413);
    noStore(oversized);
    expect(oversized.body).toEqual({ error: "Request body too large" });
    const buckets = await prisma.publicRateLimit.findMany();
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(2);
  });

  it("sanitizes invalid envelopes and unsupported media/methods; preflight is no-store", async () => {
    for (const body of [[], { code: "bad", extra: true }]) {
      const response = await request(app).post(endpoint).send(body).expect(400);
      noStore(response); expect(response.body).toEqual({ error: "Invalid tracking request." });
    }
    const media = await request(app).post(endpoint).type("text").send("PRIVATE_BODY").expect(415);
    noStore(media); expect(media.body).toEqual({ error: "Expected application/json." });
    const method = await request(app).get(endpoint).expect(405);
    noStore(method); expect(method.headers.allow).toBe("POST, OPTIONS");
    expect(method.body).toEqual({ error: "Method not allowed." });
    const preflight = await request(app).options(endpoint).set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST").set("Access-Control-Request-Headers", "content-type").expect(204);
    noStore(preflight);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("sanitizes helper failures without logging the error or request", async () => {
    const { trackingCode } = await receipt();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(contract, "findPublicVisit").mockRejectedValueOnce(new Error(`PRIVATE_DB ${trackingCode}`));
    const result = await track(trackingCode).expect(503);
    noStore(result);
    expect(result.body).toEqual({ error: "Visitor service is temporarily unavailable." });
    expect(errorLog).not.toHaveBeenCalled(); expect(infoLog).not.toHaveBeenCalled();
  });

  it("sanitizes rate-limit storage failure with no-store and no logging", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.publicRateLimit, "upsert").mockRejectedValueOnce(new Error("PRIVATE_DATABASE"));
    const result = await track("bad").expect(503);
    noStore(result); expect(result.body).toEqual({ error: "Visitor service is temporarily unavailable." });
    expect(errorLog).not.toHaveBeenCalled();
  });
});

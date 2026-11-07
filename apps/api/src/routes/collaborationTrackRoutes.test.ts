import request from "supertest";
import { randomBytes } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";
import * as contract from "../visits/contract.js";
const app = createApp("http://localhost:3000");
const endpoint = "/api/collaborations/track";
const track = (code: unknown) => request(app).post(endpoint).send({ code });
async function create() {
  const user = await prisma.user.create({ data: { name: "PRIVATE_TA", email: "ta@example.test", role: "ta", membershipStatus: "APPROVED" } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now()+3600000) } });
  const auth = { Authorization: `Bearer ${token}` };
  const response = await request(app).post("/api/requests/industry-collaboration").set(auth).send({ title: "PRIVATE_TITLE", organization: "PRIVATE_COMPANY", contactName: "PRIVATE_CONTACT", contactEmail: "private@example.test", phone: "+66 12345678", description: "PRIVATE_PURPOSE" }).expect(201);
  return { ...response.body, auth, headers: response.headers };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it("issues a one-time credential, stores only its hash and publicly allowlists statuses", async () => {
  const receipt = await create();
  expect(/^[A-Za-z0-9_-]{43}$/.test(receipt.trackingCode)).toBe(true);
  expect(receipt.headers["cache-control"]).toBe("no-store");
  const stored = await prisma.visitTrackingCredential.findUniqueOrThrow({ where: { requestId: receipt.data.id } });
  expect(stored.codeHash === contract.hashTrackingCode(receipt.trackingCode)).toBe(true);
  expect(JSON.stringify(stored).includes(receipt.trackingCode)).toBe(false);
  const response = await track(receipt.trackingCode).expect(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body).toEqual({ data: { kind: "industry_collaboration", status: "pending", approvalStatus: "submitted" } });
  const detail = await request(app).get(`/api/requests/${receipt.data.id}`).set(receipt.auth).expect(200);
  expect(detail.body).not.toHaveProperty("trackingCode");
  expect(detail.body.data).not.toHaveProperty("tracking");
  expect(JSON.stringify(detail.body).includes(stored.codeHash)).toBe(false);
  expect(JSON.stringify(detail.body).includes(receipt.trackingCode)).toBe(false);
  const extra = { ...response.body.data, codeHash: "PRIVATE", contactName: "PRIVATE", decisionHistory: ["PRIVATE"], publicMessage: "PRIVATE", visitDate: "2099-01-01" };
  vi.spyOn(contract, "findPublicCollaboration").mockResolvedValueOnce(extra);
  expect((await track(receipt.trackingCode).expect(200)).body).toEqual(response.body);
  await request(app).post("/api/visits/track").send({ code: receipt.trackingCode }).expect(404);
});
it("uniformly rejects invalid, missing, unknown, request-ID and Visitor codes", async () => {
  const receipt = await create();
  const visitor = await request(app).post("/api/visits").send({ contactName: "Visitor", email: "v@example.test", purpose: "tour", details: "Tour", visitDate: "2099-01-01", timeSlot: "morning", visitorCount: 1 }).expect(201);
  for (const code of [undefined, null, 12, {}, "", "invalid", "Z".repeat(43), receipt.data.id, visitor.body.data.trackingCode]) {
    const response = await track(code).expect(404);
    expect(response.body).toEqual({ error: "Collaboration request not found." });
    expect(response.headers["cache-control"]).toBe("no-store");
  }
});
it("does not backfill credentials for existing collaboration records", async () => {
  const old = await prisma.labRequest.create({ data: { title: "Legacy collaboration", source: "industry_collaboration", type: "industry_collaboration", requesterEmail: "old@example.test" } });
  await track(old.id).expect(404);
  expect(await prisma.visitTrackingCredential.count()).toBe(0);
});
it("rate limits invalid attempts across instances without trusting forwarded IP headers", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2030-01-01T00:00:01Z"));
  for (let i=0;i<10;i++) await track("bad").expect(404);
  const response = await request(createApp("http://localhost:3000")).post(endpoint).set("X-Forwarded-For","192.0.2.1").send({ code: "bad" }).expect(429);
  expect(response.headers["cache-control"]).toBe("no-store"); expect(response.headers["retry-after"]).toBe("59");
  expect(response.body).toEqual({ error: "Too many requests. Please try again later." });
});
it("sanitizes failures and enforces method/content-type/cache policy", async () => {
  const log = vi.spyOn(console,"error").mockImplementation(() => {});
  await request(app).get(endpoint).expect(405);
  await request(app).post(endpoint).set("Content-Type","text/plain").send("private").expect(415);
  const malformed = await request(app).post(endpoint).set("Content-Type","application/json").send('{"code":').expect(400);
  expect(malformed.headers["cache-control"]).toBe("no-store");
  const oversize = await track("x".repeat(110000)).expect(413); expect(oversize.headers["cache-control"]).toBe("no-store");
  vi.spyOn(contract,"findPublicCollaboration").mockRejectedValueOnce(new Error("PRIVATE credential"));
  const failed = await track("Z".repeat(43)).expect(503);
  expect(failed.body).toEqual({ error: "Collaboration tracking is temporarily unavailable." });
  expect(failed.headers["cache-control"]).toBe("no-store"); expect(log).not.toHaveBeenCalled();
});

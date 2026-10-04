import request from "supertest";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";
import { bangkokDate, findPublicVisit, hashTrackingCode, visitSchema } from "../visits/contract.js";
const app = createApp("http://localhost:3000");
const input = { contactName: " Guest ", email: "member@example.test", purpose: "tour", details: "Lab tour", visitDate: "2099-12-01", timeSlot: "morning", visitorCount: 2 };
async function account(role: "member" | "lab_manager" | "ta", email = `${role}@example.test`) {
  const user = await prisma.user.create({ data: { name: role, email, role, membershipStatus: "APPROVED" } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { Authorization: `Bearer ${token}` };
}
const submit = (body = input) => request(app).post("/api/visits").send(body);

describe("public visitor requests", () => {
  it("atomically persists the form and only a hash, returning the exact receipt", async () => {
    const result = await submit().expect(201);
    expect(Object.keys(result.body.data).sort()).toEqual(["requestId", "trackingCode"]);
    expect(result.headers["cache-control"]).toBe("no-store");
    const { requestId, trackingCode } = result.body.data;
    expect(trackingCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId }, include: { visit: true, tracking: true } });
    expect(saved).toMatchObject({ source: "visitor", type: "visitor", requesterEmail: "", status: "pending", approvalStatus: "submitted", requiresApproval: true, priority: "medium", neededBy: new Date("2099-12-01T02:00:00Z"), visit: { contactName: "Guest", phone: "", visitorCount: 2 }, tracking: { codeHash: hashTrackingCode(trackingCode) } });
    expect(JSON.stringify(saved)).not.toContain(trackingCode);
    const second = await submit().expect(201);
    expect(second.body.data.trackingCode).not.toBe(trackingCode);
  });
  it.each([
    { contactName: " " }, { contactName: "x".repeat(121) }, { details: " " }, { details: "x".repeat(4001) },
    { email: "bad" }, { phone: "x".repeat(41) }, { organization: "x".repeat(201) },
    { requestedHost: "x".repeat(201) }, { arrangements: "x".repeat(1001) },
    { purpose: "invalid" }, { visitDate: "2099-02-30" }, { visitDate: "2000-01-01" }, { timeSlot: "evening" },
    { visitorCount: 0 }, { visitorCount: -1 }, { visitorCount: 1.5 }, { visitorCount: "2" }, { visitorCount: Number.MAX_SAFE_INTEGER + 1 },
    { status: "closed" }, { approvalStatus: "approved" }, { priority: "high" }, { source: "member" }, { requesterEmail: "member@example.test" }, { role: "lab_manager" }, { publicMessage: "approved" },
  ])("rejects invalid or privileged fields %j without creating records", async patch => {
    await request(app).post("/api/visits").send({ ...input, ...patch }).expect(400);
    expect(await prisma.labRequest.count()).toBe(0);
    expect(await prisma.visitTrackingCredential.count()).toBe(0);
  });
  it("accepts safe integer counts and Bangkok date boundaries", async () => {
    expect(bangkokDate(new Date("2026-10-04T17:00:00Z"))).toBe("2026-10-05");
    const now = new Date("2026-10-04T17:00:00Z");
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      expect(visitSchema.safeParse({ ...input, visitDate: "2026-10-04" }).success).toBe(false);
      expect(visitSchema.safeParse({ ...input, visitDate: "2026-10-05" }).success).toBe(true);
    } finally { vi.useRealTimers(); }
    await submit({ ...input, visitorCount: Number.MAX_SAFE_INTEGER }).expect(201);
  });
  it("never grants a matching member access, while staff can see visit details but no hash", async () => {
    const member = await account("member");
    const manager = await account("lab_manager");
    const { requestId, trackingCode } = (await submit().expect(201)).body.data;
    await request(app).get(`/api/requests/${requestId}`).set(member).expect(404);
    expect((await request(app).get("/api/requests").set(member).expect(200)).body.data).toEqual([]);
    expect((await request(app).get(`/api/requests?requesterEmail=${input.email}`).set(member).expect(200)).body.data).toEqual([]);
    const staff = await request(app).get(`/api/requests/${requestId}`).set(manager).expect(200);
    expect(staff.body.data.visit.email).toBe(input.email);
    expect(staff.body.data.tracking).toBeUndefined();
    expect(JSON.stringify(staff.body)).not.toContain(hashTrackingCode(trackingCode));
  });
  it("uses existing approval and TA ownership gates and keeps internal reasons out of public lookup", async () => {
    const manager = await account("lab_manager"), ta = await account("ta"), otherTa = await account("ta", "other@example.test");
    const { requestId, trackingCode } = (await submit().expect(201)).body.data;
    const action = (value: string, auth = ta) => request(app).patch(`/api/requests/${requestId}/ta-action`).set(auth).send({ action: value });
    await action("claim").expect(409);
    await request(app).patch(`/api/requests/${requestId}/approval-status`).set(manager).send({ approvalStatus: "approved", reason: "Internal budget note", publicMessage: "Please arrive at reception." }).expect(200);
    await action("claim").expect(200);
    await action("start", otherTa).expect(409);
    await action("start").expect(200);
    await action("close").expect(200);
    expect(await findPublicVisit(trackingCode)).toEqual({ status: "closed", approvalStatus: "approved", publicMessage: "Please arrive at reception.", visitDate: input.visitDate, timeSlot: "morning" });
    expect(await findPublicVisit("wrong")).toBeNull();
    expect(await findPublicVisit("A".repeat(43))).toBeNull();
  });
  it("blocks rejected requests and does not automatically publish the review reason", async () => {
    const manager = await account("lab_manager"), ta = await account("ta");
    const { requestId, trackingCode } = (await submit().expect(201)).body.data;
    await request(app).patch(`/api/requests/${requestId}/approval-status`).set(manager).send({ approvalStatus: "rejected", reason: "Private reason" }).expect(200);
    await request(app).patch(`/api/requests/${requestId}/ta-action`).set(ta).send({ action: "claim" }).expect(409);
    expect(await findPublicVisit(trackingCode)).toMatchObject({ approvalStatus: "rejected", publicMessage: "" });
  });
  it("rate limits across app instances and ignores spoofed forwarded IPs", async () => {
    for (let i = 0; i < 10; i++) await request(app).post("/api/visits").send({}).expect(400);
    const other = createApp("http://localhost:3000");
    const result = await request(other).post("/api/visits").set("X-Forwarded-For", "192.0.2.42").send(input).expect(429);
    expect(Number(result.headers["retry-after"])).toBeGreaterThan(0);
    expect(await prisma.labRequest.count()).toBe(0);
  });
  it("rejects malformed and oversized JSON without creating a request", async () => {
    await request(app).post("/api/visits").set("Content-Type", "application/json").send('{"contactName":').expect(400);
    await request(app).post("/api/visits").send({ ...input, details: "x".repeat(110_000) }).expect(413);
    expect(await prisma.labRequest.count()).toBe(0);
  });
  it("does not return a receipt on storage failure", async () => {
    const spy = vi.spyOn(prisma.labRequest, "create").mockRejectedValueOnce(new Error("database unavailable"));
    try {
      const result = await submit().expect(503);
      expect(result.body.data).toBeUndefined();
      expect(await prisma.labRequest.count()).toBe(0);
    } finally { spy.mockRestore(); }
  });
});

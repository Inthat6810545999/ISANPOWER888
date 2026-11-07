import request from "supertest";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";

const app = createApp("http://localhost:3000");
const endpoint = "/api/requests/industry-collaboration";
const input = { title: "Industry research partnership", organization: "Example Industry", contactName: "External Contact",
  contactEmail: "partner@example.test", phone: "+66 123 456 789", description: "Formal joint research proposal" };
async function account(role: UserRole = "ta", options = {}) {
  const user = await prisma.user.create({ data: { name: `Staff ${role}`, email: `${randomBytes(6).toString("hex")}@example.test`, role, membershipStatus: "APPROVED", ...options } });
  const token = randomBytes(32).toString("hex");
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { user, session, headers: { Authorization: `Bearer ${token}` } };
}
const create = (headers: Record<string, string>, body: object = input) => request(app).post(endpoint).set(headers).send(body);

describe("US-8 industry collaboration", () => {
  it("persists contact and verified TA separately and routes submitted work to Manager", async () => {
    const ta = await account(); const manager = await account("lab_manager");
    const result = await create(ta.headers).expect(201);
    const saved = result.body.data;
    expect(saved).toMatchObject({ title: input.title, type: "industry_collaboration", source: "industry_collaboration",
      status: "pending", approvalStatus: "submitted", requiresApproval: true, requesterEmail: ta.user.email, assigneeEmail: null,
      collaboration: { ...Object.fromEntries(Object.entries(input).filter(([k]) => !["title", "description"].includes(k))),
        submittedById: ta.user.id, submittedByName: ta.user.name, submittedByEmail: ta.user.email }, visit: null, decision: null });
    expect(saved).not.toHaveProperty("tracking"); expect(saved).not.toHaveProperty("trackingCode");
    expect(await prisma.visitTrackingCredential.count()).toBe(1);
    expect(typeof result.body.trackingCode).toBe("string");
    const read = await request(app).get(`/api/requests/${saved.id}`).set(ta.headers).expect(200);
    expect(read.body.data).toEqual(saved);
    const queue = await request(app).get("/api/requests?approvalStatus=submitted&source=industry_collaboration&type=industry_collaboration").set(manager.headers).expect(200);
    expect(queue.body.data.map((r: { id: string }) => r.id)).toEqual([saved.id]);
    const report = await request(app).get("/api/requests/reports").set(manager.headers).expect(200);
    expect(report.body.data.byType).toContainEqual({ label: "industry_collaboration", count: 1 });
    const member = await account("member");
    await request(app).get(`/api/requests/${saved.id}`).set(member.headers).expect(404);
    expect((await request(app).get("/api/requests").set(member.headers)).body.data).toEqual([]);
    await request(app).post("/api/visits/track").send({ code: saved.id }).expect(404);
    await request(app).patch(`/api/requests/${saved.id}/public-message`).set(manager.headers).send({ publicMessage: "No public channel" }).expect(409);
  });

  it.each(["member", "lab_manager", "unassigned"] as const)("denies %s without widening general creation permissions", async role => {
    await create((await account(role)).headers).expect(403);
    expect(await prisma.labRequest.count()).toBe(0);
  });
  it("denies guest, missing/expired/revoked sessions and pending/inactive TA", async () => {
    await create({}).expect(401);
    await create({ Authorization: "Bearer guest" }).expect(401);
    await create((await account("ta", { membershipStatus: "PENDING" })).headers).expect(403);
    await create((await account("ta", { active: false })).headers).expect(401);
    const expired = await account();
    await prisma.session.update({ where: { id: expired.session.id }, data: { expiresAt: new Date(0) } });
    await create(expired.headers).expect(401);
    const revoked = await account(); await prisma.session.delete({ where: { id: revoked.session.id } });
    await create(revoked.headers).expect(401);
    const demoted = await account(); await prisma.user.update({ where: { id: demoted.user.id }, data: { role: "member" } });
    await create(demoted.headers).expect(403);
    expect(await prisma.labRequest.count()).toBe(0);
  });
  it("rejects forged fields and general-endpoint bypasses", async () => {
    const ta = await account();
    for (const [key, value] of Object.entries({ requiresApproval: false, status: "closed", approvalStatus: "approved", requesterEmail: "forged@example.test",
      role: "lab_manager", assigneeEmail: ta.user.email, submittedById: ta.user.id, collaboration: {}, source: "member", type: "general", decision: {}, publicMessage: "leak" })) {
      await create(ta.headers, { ...input, [key]: value }).expect(400);
    }
    await request(app).post("/api/requests").set(ta.headers).send({ title: "Bypass", type: "general" }).expect(403);
    await request(app).post("/api/requests").set((await account("member")).headers).send({ title: "Bypass", type: "industry_collaboration" }).expect(400);
    expect(await prisma.labRequest.count()).toBe(0);
  });
  it("validates required strings, email, phone and exact trimmed length boundaries", async () => {
    const ta = await account();
    const limits = { title: 200, organization: 200, contactName: 120, contactEmail: 254, phone: 40, description: 4000 };
    for (const [key, max] of Object.entries(limits)) {
      const atLimit = key === "contactEmail" ? "a".repeat(242) + "@example.com" : key === "phone" ? "1".repeat(max) : "x".repeat(max);
      await create(ta.headers, { ...input, [key]: `  ${atLimit}  ` }).expect(201);
      await create(ta.headers, { ...input, [key]: atLimit + "x" }).expect(400);
      await create(ta.headers, { ...input, [key]: null }).expect(400);
      if (key !== "phone") {
        await create(ta.headers, { ...input, [key]: "   " }).expect(400);
        const missing = { ...input } as Record<string, unknown>; delete missing[key]; await create(ta.headers, missing).expect(400);
      }
    }
    for (const contactEmail of ["missing-at", "a@b", "a b@example.test", "a@@example.test"]) await create(ta.headers, { ...input, contactEmail }).expect(400);
    await create(ta.headers, { ...input, phone: "letters" }).expect(400);
    const optional = { ...input } as Record<string, unknown>; delete optional.phone;
    expect((await create(ta.headers, optional).expect(201)).body.data.collaboration.phone).toBe("");
  });
  it.each(["approved", "rejected"] as const)("preserves approval-first workflow for %s", async outcome => {
    const ta = await account(); const other = await account(); const manager = await account("lab_manager");
    const id = (await create(ta.headers).expect(201)).body.data.id;
    const action = (headers: Record<string,string>, action: string) => request(app).patch(`/api/requests/${id}/ta-action`).set(headers).send({ action });
    await action(ta.headers, "claim").expect(409);
    await request(app).patch(`/api/requests/${id}/approval-status`).set(ta.headers).send({ approvalStatus: "approved", reason: "Self approve" }).expect(403);
    const decision = (await request(app).patch(`/api/requests/${id}/approval-status`).set(manager.headers).send({ approvalStatus: outcome, reason: "Manager formal decision" }).expect(200)).body.data;
    expect(decision).toMatchObject({ status: "pending", approvalStatus: outcome, decision: { reviewerId: manager.user.id, reviewerName: manager.user.name, reason: "Manager formal decision" } });
    expect(decision.decision.reviewedAt).toBeTruthy();
    await action(manager.headers, "claim").expect(403);
    if (outcome === "approved") {
      await action(ta.headers, "start").expect(409);
      await action(ta.headers, "claim").expect(200);
      await action(other.headers, "start").expect(409);
      await action(ta.headers, "close").expect(409);
      await action(ta.headers, "start").expect(200);
      const closed = (await action(ta.headers, "close").expect(200)).body.data;
      expect(closed).toMatchObject({ status: "closed", approvalStatus: "approved", collaboration: decision.collaboration, decision: decision.decision });
    } else for (const next of ["claim", "start", "close"]) await action(ta.headers, next).expect(409);
    await request(app).patch(`/api/requests/${id}/approval-status`).set(manager.headers).send({ approvalStatus: "approved", reason: "Overwrite" }).expect(409);
  });
});

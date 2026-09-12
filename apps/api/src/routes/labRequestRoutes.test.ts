import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { hashPassword } from "../auth/password.js";
import { tokenHash } from "../auth/session.js";

const app = createApp("http://localhost:3000");
const password = "Only-for-isolated-tests-123!";
const passwordHash = await hashPassword(password);
const validRequest = { title: "Book microscope room B2", type: "space" };
type Account = { id: string; email: string; name: string; role: UserRole; token: string };
let member: Account, otherMember: Account, ta: Account, otherTa: Account, manager: Account;
async function account(name: string, role: UserRole): Promise<Account> {
  const user = await prisma.user.create({ data: { email: `${name}@example.test`, name, role, passwordHash } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { ...user, token };
}
const auth = (user: Account) => ({ Authorization: `Bearer ${user.token}` });
async function create(requiresApproval = false, user = member) {
  return (await request(app).post("/api/requests").set(auth(user)).send({ ...validRequest, requiresApproval }).expect(201)).body.data;
}
const action = (id: string, user: Account, value: string) => request(app).patch(`/api/requests/${id}/ta-action`).set(auth(user)).send({ action: value });
const review = (id: string, user: Account, approvalStatus = "approved", reason = "Reviewed lab resources and access.") =>
  request(app).patch(`/api/requests/${id}/approval-status`).set(auth(user)).send({ approvalStatus, reason });
beforeEach(async () => {
  [member, otherMember, ta, otherTa, manager] = await Promise.all([
    account("member", "member"), account("other-member", "member"), account("ta", "ta"), account("other-ta", "ta"), account("manager", "lab_manager"),
  ]);
});

describe("verified sessions", () => {
  it("leaves health public and requires sessions for every protected endpoint", async () => {
    await request(app).get("/api/health").expect(200);
    for (const path of ["/api/requests", "/api/requests/reports", "/api/requests/missing", "/api/auth/me", "/api/auth/assignees"]) await request(app).get(path).expect(401);
    await request(app).post("/api/requests").send(validRequest).expect(401);
    for (const path of ["ta-action", "status", "approval-status"]) await request(app).patch(`/api/requests/missing/${path}`).send({}).expect(401);
    await request(app).post("/api/auth/logout").expect(401);
    await request(app).get("/api/requests").set("X-Role", "lab_manager").set("X-Email", manager.email).expect(401);
    await request(app).get("/api/requests").set("Authorization", `Bearer ${"f".repeat(64)}`).expect(401);
  });
  it("verifies passwords, stores only a token hash, and revokes logout sessions", async () => {
    await request(app).post("/api/auth/login").send({ email: member.email, password: "wrong" }).expect(401);
    await request(app).post("/api/auth/login").send({ email: "unknown@example.test", password }).expect(401);
    await request(app).post("/api/auth/login").send({ email: member.email, password, role: "lab_manager" }).expect(400);
    const signedIn = await request(app).post("/api/auth/login").send({ email: member.email.toUpperCase(), password }).expect(200);
    expect(signedIn.body.user.role).toBe("member");
    expect(signedIn.body.user.passwordHash).toBeUndefined();
    const token = signedIn.body.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await prisma.session.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) } })).not.toBeNull();
    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`).expect(200);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(401);
  });
  it("checks expiry, active account, and current database role on each request", async () => {
    await prisma.session.updateMany({ where: { userId: member.id }, data: { expiresAt: new Date(0) } });
    await request(app).get("/api/requests").set(auth(member)).expect(401);
    await prisma.user.update({ where: { id: ta.id }, data: { active: false } });
    await request(app).get("/api/requests").set(auth(ta)).expect(401);
    await prisma.user.update({ where: { id: manager.id }, data: { role: "member" } });
    await request(app).get("/api/requests/reports").set(auth(manager)).expect(403);
  });
});

describe("role boundaries and ownership", () => {
  it("scopes member lists and details to the verified requester", async () => {
    const own = await create();
    const other = await create(false, otherMember);
    const list = await request(app).get("/api/requests").set(auth(member)).expect(200);
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([own.id]);
    await request(app).get(`/api/requests/${other.id}`).set(auth(member)).expect(404);
    await request(app).get(`/api/requests?requesterEmail=${otherMember.email}`).set(auth(member)).expect(403);
    for (const user of [ta, manager]) {
      expect((await request(app).get("/api/requests").set(auth(user)).expect(200)).body.data).toHaveLength(2);
      await request(app).get(`/api/requests/${other.id}`).set(auth(user)).expect(200);
      await request(app).post("/api/requests").set(auth(user)).send(validRequest).expect(403);
    }
  });
  it("TA and Member cannot approve or reject, even with spoofed manager headers", async () => {
    const r = await create(true);
    for (const user of [member, ta]) for (const decision of ["approved", "rejected"]) {
      await review(r.id, user, decision).set("X-Role", "lab_manager").set("X-Email", manager.email).expect(403);
    }
    expect((await prisma.labRequest.findUniqueOrThrow({ where: { id: r.id } })).approvalStatus).toBe("submitted");
  });
  it("Manager has no TA inheritance and Member cannot mutate work", async () => {
    const r = await create(true);
    for (const user of [member, manager]) {
      for (const value of ["claim", "assign", "start", "close"]) await action(r.id, user, value).expect(403);
      await request(app).patch(`/api/requests/${r.id}/status`).set(auth(user)).send({ status: "closed" }).expect(403);
      await request(app).get("/api/auth/assignees").set(auth(user)).expect(403);
    }
  });
  it("rejects client-controlled identity, reviewer, and initial status fields", async () => {
    for (const invalid of [{ requesterEmail: otherMember.email }, { role: "lab_manager" }, { status: "closed" }, { approvalStatus: "approved" }, { priority: "urgent" }, { requiresApproval: "true" }, { location: "x".repeat(201) }]) {
      await request(app).post("/api/requests").set(auth(member)).send({ ...validRequest, ...invalid }).expect(400);
    }
    const r = await create(true);
    await request(app).patch(`/api/requests/${r.id}/ta-action`).set(auth(ta)).send({ action: "claim", assigneeEmail: otherTa.email }).expect(400);
    await request(app).patch(`/api/requests/${r.id}/approval-status`).set(auth(manager)).send({ approvalStatus: "approved", reason: "Reason", reviewerEmail: ta.email }).expect(400);
  });
});

describe("independent approval and work workflow", () => {
  it("persists form metadata and allows normal TA work without approval", async () => {
    const fields = { ...validRequest, priority: "high", location: "Lab B2", neededBy: "2026-10-15", description: "Prepare equipment" };
    const r = (await request(app).post("/api/requests").set(auth(member)).send(fields).expect(201)).body.data;
    expect(r).toMatchObject({ ...fields, requesterEmail: member.email, neededBy: "2026-10-15T00:00:00.000Z", status: "pending", approvalStatus: "not_required" });
    await review(r.id, manager).expect(409);
    for (const value of ["claim", "start", "close"]) await action(r.id, ta, value).expect(200);
    const saved = (await request(app).get(`/api/requests/${r.id}`).set(auth(member)).expect(200)).body.data;
    expect(saved).toMatchObject({ status: "closed", approvalStatus: "not_required", decision: null, assigneeEmail: ta.email });
  });
  it("allows claiming while waiting; approval unlocks start/close and records immutable audit data", async () => {
    const r = await create(true);
    await action(r.id, ta, "claim").expect(200);
    await action(r.id, ta, "start").expect(409);
    await action(r.id, ta, "close").expect(409);
    const result = await review(r.id, manager, "approved", "  Budget and safety confirmed.  ").expect(200);
    expect(result.body.data).toMatchObject({ status: "assigned", approvalStatus: "approved", decision: {
      outcome: "approved", reason: "Budget and safety confirmed.", reviewerId: manager.id, reviewerName: manager.name, reviewerEmail: manager.email,
    } });
    expect(Number.isFinite(Date.parse(result.body.data.decision.reviewedAt))).toBe(true);
    await review(r.id, manager, "rejected").expect(409);
    await action(r.id, ta, "start").expect(200);
    await action(r.id, ta, "close").expect(200);
    const saved = (await request(app).get(`/api/requests/${r.id}`).set(auth(member)).expect(200)).body.data;
    expect(saved.approvalStatus).toBe("approved");
    expect(saved.decision).toEqual(result.body.data.decision);
  });
  it.each(["submitted", "under_review", "rejected", "cancelled"] as const)("blocks start and success-close for %s including the legacy endpoint", async (approvalStatus) => {
    const r = await create(true);
    await action(r.id, ta, "claim").expect(200);
    await prisma.labRequest.update({ where: { id: r.id }, data: { approvalStatus } });
    await action(r.id, ta, "start").expect(409);
    await request(app).patch(`/api/requests/${r.id}/status`).set(auth(ta)).send({ status: "in_progress" }).expect(409);
    // Existing records from the previous demo may already be in progress before approval.
    await prisma.labRequest.update({ where: { id: r.id }, data: { status: "in_progress" } });
    await action(r.id, ta, "close").expect(409);
    await request(app).patch(`/api/requests/${r.id}/status`).set(auth(ta)).send({ status: "closed" }).expect(409);
    expect((await prisma.labRequest.findUniqueOrThrow({ where: { id: r.id } })).approvalStatus).toBe(approvalStatus);
  });
  it("records rejection and requires a reason for both decisions", async () => {
    const r = await create(true);
    for (const value of ["approved", "rejected"]) await review(r.id, manager, value, "  ").expect(400);
    const rejected = await review(r.id, manager, "rejected", "No supervised access available.").expect(200);
    expect(rejected.body.data.decision.outcome).toBe("rejected");
    await action(r.id, ta, "claim").expect(200);
    await action(r.id, ta, "start").expect(409);
    await review(r.id, manager).expect(409);
  });
  it("assigns waiting work only to active TAs and respects current ownership", async () => {
    const r = await create(true);
    const assign = (id: string, expectedUpdatedAt = r.updatedAt) => request(app).patch(`/api/requests/${r.id}/ta-action`).set(auth(ta)).send({ action: "assign", assigneeId: id, expectedUpdatedAt });
    await assign(manager.id).expect(400);
    await assign(member.id).expect(400);
    const roster = (await request(app).get("/api/auth/assignees").set(auth(ta)).expect(200)).body.data;
    expect(roster.map((u: { role: string }) => u.role)).toEqual(["ta", "ta"]);
    expect(roster[0].passwordHash).toBeUndefined();
    const assigned = await assign(otherTa.id).expect(200);
    expect(assigned.body.data).toMatchObject({ status: "assigned", approvalStatus: "submitted", assigneeEmail: otherTa.email });
    await assign(ta.id).expect(409);
    await action(r.id, otherTa, "start").expect(409);
    await review(r.id, manager).expect(200);
    await action(r.id, ta, "start").expect(409);
    await action(r.id, otherTa, "start").expect(200);
    await assign(ta.id, assigned.body.data.updatedAt).expect(409);
    await action(r.id, ta, "close").expect(409);
    await action(r.id, otherTa, "close").expect(200);
  });
  it("prevents conflicting claims and conflicting final decisions", async () => {
    const r = await create(true);
    const claims = await Promise.all([action(r.id, ta, "claim"), action(r.id, otherTa, "claim")]);
    expect(claims.map((v) => v.status).sort()).toEqual([200, 409]);
    const decisions = await Promise.all([review(r.id, manager, "approved"), review(r.id, manager, "rejected")]);
    expect(decisions.map((v) => v.status).sort()).toEqual([200, 409]);
    expect(await prisma.approvalDecision.count({ where: { requestId: r.id } })).toBe(1);
  });
  it("does not allow raw status overrides or mixed approval/work updates", async () => {
    const r = await create(true);
    for (const status of ["approved", "assigned", "cancelled"]) await request(app).patch(`/api/requests/${r.id}/status`).set(auth(ta)).send({ status }).expect(400);
    await request(app).patch(`/api/requests/${r.id}/status`).set(auth(ta)).send({ status: "closed", approvalStatus: "approved" }).expect(400);
    await review(r.id, manager, "not_required").expect(400);
    await review(r.id, manager, "closed").expect(400);
    await action(r.id, ta, "close").expect(409);
  });
  it("supports independent filters and handles missing records", async () => {
    await create(); await create(true);
    const filtered = await request(app).get("/api/requests?status=pending&approvalStatus=submitted").set(auth(ta)).expect(200);
    expect(filtered.body.data).toHaveLength(1);
    await request(app).get("/api/requests?status=approved").set(auth(ta)).expect(400);
    await request(app).get("/api/requests?approvalStatus=in_progress").set(auth(ta)).expect(400);
    const id = "00000000-0000-0000-0000-000000000000";
    await request(app).get(`/api/requests/${id}`).set(auth(ta)).expect(404);
    await action(id, ta, "claim").expect(404);
    await review(id, manager).expect(404);
  });
});

describe("Manager reports", () => {
  it("restricts aggregates to Manager and counts independent statuses within a UTC date range", async () => {
    const r = await create(true); await create();
    await prisma.labRequest.update({ where: { id: r.id }, data: { createdAt: new Date("2026-01-15T23:59:00Z") } });
    for (const user of [member, ta]) await request(app).get("/api/requests/reports").set(auth(user)).expect(403);
    const report = (await request(app).get("/api/requests/reports?from=2026-01-15&to=2026-01-15").set(auth(manager)).expect(200)).body.data;
    expect(report).toMatchObject({ total: 1, byStatus: [{ label: "pending", count: 1 }], byApproval: [{ label: "submitted", count: 1 }] });
    expect((await request(app).get("/api/requests/reports").set(auth(manager)).expect(200)).body.data.total).toBe(2);
    await request(app).get("/api/requests/reports?from=2026-02-01&to=2026-01-01").set(auth(manager)).expect(400);
  });
});

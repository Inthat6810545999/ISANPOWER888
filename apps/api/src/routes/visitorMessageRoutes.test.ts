import request from "supertest";
import { randomBytes } from "node:crypto";
import type { ApprovalStatus, RequestStatus, UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";

const app = createApp("http://localhost:3000");
async function account(role: UserRole = "lab_manager") {
  const user = await prisma.user.create({ data: {
    name: `Private editor ${role}`, email: `${randomBytes(8).toString("hex")}@example.test`,
    role, membershipStatus: "APPROVED",
  } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { user, headers: { Authorization: `Bearer ${token}` } };
}
async function visit() {
  const response = await request(app).post("/api/visits").send({
    contactName: "Private visitor", email: "private-visitor@example.test", purpose: "tour",
    details: "Internal visit details", visitDate: "2099-12-01", timeSlot: "morning", visitorCount: 2,
  }).expect(201);
  return response.body.data as { requestId: string; trackingCode: string };
}
const edit = (id: string, headers: Record<string, string>, body: object = { publicMessage: "Updated message" }) =>
  request(app).patch(`/api/requests/${id}/public-message`).set(headers).send(body);
async function reviewed(outcome: "approved" | "rejected" = "approved") {
  const manager = await account();
  const receipt = await visit();
  await request(app).patch(`/api/requests/${receipt.requestId}/approval-status`).set(manager.headers)
    .send({ approvalStatus: outcome, reason: "Private approval reason", publicMessage: "Initial message" }).expect(200);
  return { ...receipt, manager };
}

describe("Manager visitor public-message editing", () => {
  it.each(["approved", "rejected"] as const)("edits %s messages with verified metadata and preserves decisions/work", async outcome => {
    const { requestId, trackingCode, manager } = await reviewed(outcome);
    const before = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(before.publicMessageUpdatedById).toBe(manager.user.id);
    const decisions = await prisma.approvalDecision.findMany({ where: { requestId } });
    const editor = await account();
    const started = Date.now();
    const response = await edit(requestId, editor.headers, { publicMessage: "  Please meet at reception.  " }).expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data).toMatchObject({ publicMessage: "Please meet at reception.",
      publicMessageUpdatedById: editor.user.id, publicMessageUpdatedByName: editor.user.name,
      publicMessageUpdatedByEmail: editor.user.email, approvalStatus: outcome });
    expect(Date.parse(response.body.data.publicMessageUpdatedAt)).toBeGreaterThanOrEqual(started);
    const after = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
    const { publicMessage: _message, publicMessageUpdatedById: _id, publicMessageUpdatedByName: _name,
      publicMessageUpdatedByEmail: _email, publicMessageUpdatedAt: _at, updatedAt: _updated, ...unchanged } = before;
    expect(after).toMatchObject(unchanged);
    expect(await prisma.approvalDecision.findMany({ where: { requestId } })).toEqual(decisions);
    for (const path of [`/api/requests/${requestId}`, "/api/requests"]) {
      const staff = await request(app).get(path).set(manager.headers).expect(200);
      const data = Array.isArray(staff.body.data) ? staff.body.data[0] : staff.body.data;
      expect(data.publicMessageUpdatedById).toBe(editor.user.id);
    }
    const tracked = await request(app).post("/api/visits/track").send({ code: trackingCode }).expect(200);
    expect(tracked.body).toEqual({ data: { status: "pending", approvalStatus: outcome,
      publicMessage: "Please meet at reception.", visitDate: "2099-12-01", timeSlot: "morning" } });
    await request(app).patch(`/api/requests/${requestId}/approval-status`).set(manager.headers)
      .send({ approvalStatus: outcome === "approved" ? "rejected" : "approved", reason: "Overwrite" }).expect(409);
  });

  it("accepts the length boundary, clears whitespace and keeps plain text as text", async () => {
    const { requestId, manager, trackingCode } = await reviewed();
    await edit(requestId, manager.headers, { publicMessage: "x".repeat(2000) }).expect(200);
    await edit(requestId, manager.headers, { publicMessage: "<script>alert(1)</script>" }).expect(200);
    await edit(requestId, manager.headers, { publicMessage: " \n " }).expect(200);
    const tracked = await request(app).post("/api/visits/track").send({ code: trackingCode }).expect(200);
    expect(tracked.body.data.publicMessage).toBe("");
  });

  it("rejects missing, invalid and spoofed fields without changing the row", async () => {
    const { requestId, manager } = await reviewed();
    const before = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
    for (const body of [{}, { publicMessage: null }, { publicMessage: 123 }, { publicMessage: "x".repeat(2001) },
      ...["role", "source", "status", "approvalStatus", "reason", "publicMessageUpdatedById", "publicMessageUpdatedByName",
        "publicMessageUpdatedByEmail", "publicMessageUpdatedAt"].map(key => ({ publicMessage: "Changed", [key]: "forged" }))]) {
      await edit(requestId, manager.headers, body).expect(400);
    }
    await request(app).patch(`/api/requests/${requestId}/public-message`).set(manager.headers)
      .set("Content-Type", "application/json").send('{"publicMessage":').expect(400);
    expect(await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } })).toEqual(before);
  });

  it("requires a current active approved Manager session, ignoring forged role headers", async () => {
    const { requestId, manager } = await reviewed();
    const before = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
    await edit(requestId, { "x-role": "lab_manager" }).expect(401);
    for (const role of ["member", "ta", "unassigned"] as const) {
      const other = await account(role);
      await edit(requestId, { ...other.headers, "x-role": "lab_manager" }).expect(403);
    }
    await prisma.user.update({ where: { id: manager.user.id }, data: { membershipStatus: "PENDING" } });
    await edit(requestId, manager.headers).expect(403);
    await prisma.user.update({ where: { id: manager.user.id }, data: { membershipStatus: "APPROVED", role: "ta" } });
    await edit(requestId, manager.headers).expect(403);
    await prisma.user.update({ where: { id: manager.user.id }, data: { role: "lab_manager", active: false } });
    await edit(requestId, manager.headers).expect(401);
    await prisma.user.update({ where: { id: manager.user.id }, data: { active: true } });
    await prisma.session.updateMany({ where: { userId: manager.user.id }, data: { expiresAt: new Date(0) } });
    await edit(requestId, manager.headers).expect(401);
    await prisma.session.deleteMany({ where: { userId: manager.user.id } });
    await edit(requestId, manager.headers).expect(401);
    expect(await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } })).toEqual(before);
  });

  it("rejects missing requests, member-source visitors and undecided/legacy approvals", async () => {
    const manager = await account();
    await edit("missing", manager.headers).expect(404);
    const memberRequest = await prisma.labRequest.create({ data: { title: "Member visitor request", type: "visitor",
      source: "member", requesterEmail: "member@example.test", approvalStatus: "approved" } });
    await edit(memberRequest.id, manager.headers).expect(409);
    const { requestId } = await visit();
    for (const approvalStatus of ["submitted", "under_review", "not_required", "cancelled"] satisfies ApprovalStatus[]) {
      await prisma.labRequest.update({ where: { id: requestId }, data: { approvalStatus } });
      const before = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
      await edit(requestId, manager.headers).expect(409);
      expect(await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } })).toEqual(before);
    }
  });

  it("allows decided visitors in every work state without altering assignment or history", async () => {
    const { requestId, manager } = await reviewed();
    for (const status of ["pending", "assigned", "in_progress", "closed", "cancelled"] satisfies RequestStatus[]) {
      await prisma.labRequest.update({ where: { id: requestId }, data: { status, assigneeEmail: "ta@example.test" } });
      const response = await edit(requestId, manager.headers).expect(200);
      expect(response.body.data).toMatchObject({ status, assigneeEmail: "ta@example.test", approvalStatus: "approved" });
    }
  });

  it("keeps concurrent message and editor writes together (last write wins)", async () => {
    const { requestId } = await reviewed();
    const first = await account(), second = await account();
    await Promise.all([
      edit(requestId, first.headers, { publicMessage: "First" }).expect(200),
      edit(requestId, second.headers, { publicMessage: "Second" }).expect(200),
    ]);
    const saved = await prisma.labRequest.findUniqueOrThrow({ where: { id: requestId } });
    const winner = saved.publicMessage === "First" ? first.user : second.user;
    expect(["First", "Second"]).toContain(saved.publicMessage);
    expect(saved).toMatchObject({ publicMessageUpdatedById: winner.id, publicMessageUpdatedByName: winner.name,
      publicMessageUpdatedByEmail: winner.email, approvalStatus: "approved", status: "pending" });
    expect(await prisma.approvalDecision.count({ where: { requestId } })).toBe(1);
  });
});

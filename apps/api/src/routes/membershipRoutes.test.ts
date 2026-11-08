import { randomBytes } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { UserRole, MembershipStatus } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";
import { resolveGoogleAccount } from "../auth/google-account.js";

const app = createApp("http://localhost:3000");
async function account(role: UserRole, membershipStatus: MembershipStatus = "APPROVED") {
  const user = await prisma.user.create({ data: { email: `${randomBytes(10).toString("hex")}@example.test`, name: role, role, membershipStatus } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { ...user, headers: { Authorization: `Bearer ${token}` } };
}
describe("membership approval", () => {
  it("requires an approved manager for listing and approval", async () => {
    const target = await account("unassigned", "PENDING");
    await request(app).get("/api/memberships").expect(401);
    await request(app).post(`/api/memberships/${target.id}/approve`).send({ role: "member" }).expect(401);
    for (const role of ["member", "ta", "unassigned", "lab_manager"] as const) {
      const user = await account(role, role === "lab_manager" || role === "unassigned" ? "PENDING" : "APPROVED");
      await request(app).get("/api/memberships").set(user.headers).expect(403);
      await request(app).post(`/api/memberships/${target.id}/approve`).set(user.headers).send({ role: "member" }).expect(403);
    }
  });
  it.each(["member", "ta", "lab_manager"] as const)("approves %s, records reviewer, and unlocks the existing session", async (role) => {
    const manager = await account("lab_manager"), target = await account("unassigned", "PENDING");
    await request(app).get("/api/requests").set(target.headers).expect(403);
    const list = await request(app).get("/api/memberships").set(manager.headers).expect(200);
    expect(list.body.data.map((u: {id: string}) => u.id)).toEqual([target.id]);
    expect(list.body.data[0].passwordHash).toBeUndefined();
    await request(app).post(`/api/memberships/${target.id}/approve`).set(manager.headers).send({ role }).expect(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.membershipStatus).toBe("APPROVED");
    expect(stored.membershipApprovedBy).toBe(manager.id);
    expect(stored.membershipApprovedAt).toBeInstanceOf(Date);
    const me = await request(app).get("/api/auth/me").set(target.headers).expect(200);
    expect(me.body.user.role).toBe(role);
    await request(app).get("/api/requests").set(target.headers).expect(200);
    expect((await request(app).get("/api/memberships").set(manager.headers)).body.data).toEqual([]);
  });
  it("does not assign admin, edit approved roles, or approve inactive accounts", async () => {
    const manager = await account("lab_manager"), target = await account("unassigned", "PENDING");
    const path = `/api/memberships/${target.id}/approve`;
    for (const role of ["admin", "unassigned", "invalid"]) await request(app).post(path).set(manager.headers).send({ role }).expect(400);
    await prisma.user.update({ where: { id: target.id }, data: { active: false } });
    await request(app).post(path).set(manager.headers).send({ role: "member" }).expect(409);
    await request(app).post(`/api/memberships/${manager.id}/approve`).set(manager.headers).send({ role: "ta" }).expect(409);
  });
  it("allows only one concurrent decision", async () => {
    const a = await account("lab_manager"), b = await account("lab_manager"), target = await account("unassigned", "PENDING");
    const path = `/api/memberships/${target.id}/approve`;
    const results = await Promise.all([
      request(app).post(path).set(a.headers).send({ role: "member" }),
      request(app).post(path).set(b.headers).send({ role: "ta" }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it("lists a new Google registration and preserves its assigned role on future login", async () => {
    const manager = await account("lab_manager");
    const identity = { subject: "membership-google-test", email: "new-google@example.test", name: "New registrant", authoritativeEmail: true };
    const pending = await resolveGoogleAccount(identity);
    expect(pending.membershipStatus).toBe("PENDING");
    await request(app).post(`/api/memberships/${pending.id}/approve`).set(manager.headers).send({ role: "ta" }).expect(200);
    expect((await resolveGoogleAccount(identity)).role).toBe("ta");
  });
});

describe("US-10 member management", () => {
  it("restricts all-account lists, history and changes to approved active managers", async () => {
    const target = await account("member");
    for (const headers of [undefined, (await account("member")).headers, (await account("ta")).headers, (await account("lab_manager", "PENDING")).headers]) {
      const status = headers ? 403 : 401;
      await request(app).get("/api/memberships?scope=all").set(headers ?? {}).expect(status);
      await request(app).get(`/api/memberships/${target.id}/history`).set(headers ?? {}).expect(status);
      await request(app).patch(`/api/memberships/${target.id}`).set(headers ?? {}).send({ action: "active", active: false, expectedVersion: 0 }).expect(status);
    }
    const manager = await account("lab_manager");
    await prisma.user.update({ where: { id: manager.id }, data: { active: false } });
    await request(app).get("/api/memberships?scope=all").set(manager.headers).expect(401);
  });
  it("lists active, inactive and pending accounts without credentials", async () => {
    const manager = await account("lab_manager"), member = await account("member"), pending = await account("unassigned", "PENDING");
    await prisma.user.update({ where: { id: member.id }, data: { active: false, passwordHash: "not-public", googleSubject: "not-public" } });
    const list = await request(app).get("/api/memberships?scope=all").set(manager.headers).expect(200);
    expect(list.body.data).toHaveLength(3);
    expect(list.body.data.find((u: { id: string }) => u.id === member.id).active).toBe(false);
    for (const user of list.body.data) expect(Object.keys(user).sort()).toEqual(["id", "name", "email", "role", "membershipStatus", "active", "membershipVersion"].sort());
    const awaiting = await request(app).get("/api/memberships").set(manager.headers).expect(200);
    expect(awaiting.body.data.map((u: { id: string }) => u.id)).toEqual([pending.id]);
  });
  it("updates existing sessions to the new role and records immutable actor/state snapshots", async () => {
    const manager = await account("lab_manager"), target = await account("member");
    await request(app).patch(`/api/memberships/${target.id}`).set(manager.headers).send({ action: "role", role: "ta", expectedVersion: 0 }).expect(200);
    const me = await request(app).get("/api/auth/me").set(target.headers).expect(200);
    expect(me.body.user.role).toBe("ta");
    await request(app).get("/api/auth/assignees").set(target.headers).expect(200);
    await request(app).patch(`/api/memberships/${target.id}`).set(manager.headers).send({ action: "role", role: "member", expectedVersion: 1 }).expect(200);
    await request(app).get("/api/auth/assignees").set(target.headers).expect(403);
    await prisma.user.update({ where: { id: manager.id }, data: { name: "Renamed manager" } });
    const history = await request(app).get(`/api/memberships/${target.id}/history`).set(manager.headers).expect(200);
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[1]).toMatchObject({ action: "role_changed", actorId: manager.id, actorName: "lab_manager", targetId: target.id, previousRole: "member", nextRole: "ta", previousActive: true, nextActive: true });
  });
  it("revokes all sessions on deactivation and does not revive them on reactivation", async () => {
    const manager = await account("lab_manager"), target = await account("ta");
    const secondToken = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { userId: target.id, tokenHash: tokenHash(secondToken), expiresAt: new Date(Date.now() + 3600000) } });
    const work = await prisma.labRequest.create({ data: { title: "Keep work history", type: "general", requesterEmail: target.email, assigneeEmail: target.email, status: "assigned" } });
    await request(app).patch(`/api/memberships/${target.id}`).set(manager.headers).send({ action: "active", active: false, expectedVersion: 0 }).expect(200);
    for (const headers of [target.headers, { Authorization: `Bearer ${secondToken}` }]) await request(app).get("/api/auth/me").set(headers).expect(401);
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    await expect(resolveGoogleAccount({ subject: "inactive-test", email: target.email, name: target.name, authoritativeEmail: true })).rejects.toThrow("inactive");
    await request(app).patch(`/api/memberships/${target.id}`).set(manager.headers).send({ action: "active", active: true, expectedVersion: 1 }).expect(200);
    await request(app).get("/api/auth/me").set(target.headers).expect(401);
    expect(await prisma.labRequest.findUnique({ where: { id: work.id } })).toMatchObject({ status: "assigned", assigneeEmail: target.email });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored).toMatchObject({ active: true, role: "ta", membershipStatus: "APPROVED", membershipVersion: 2 });
    const rows = await prisma.membershipAudit.findMany({ orderBy: { id: "asc" } });
    expect(rows.map(r => r.action)).toEqual(["deactivated", "reactivated"]);
  });
  it("preserves pending membership on reactivation and records approval once", async () => {
    const manager = await account("lab_manager"), target = await account("unassigned", "PENDING");
    const path = `/api/memberships/${target.id}`;
    await request(app).patch(path).set(manager.headers).send({ action: "role", role: "ta", expectedVersion: 0 }).expect(409);
    await request(app).patch(path).set(manager.headers).send({ action: "active", active: false, expectedVersion: 0 }).expect(200);
    await request(app).patch(path).set(manager.headers).send({ action: "active", active: true, expectedVersion: 1 }).expect(200);
    expect(await prisma.user.findUnique({ where: { id: target.id } })).toMatchObject({ role: "unassigned", membershipStatus: "PENDING" });
    await request(app).post(`${path}/approve`).set(manager.headers).send({ role: "member" }).expect(200);
    await request(app).post(`${path}/approve`).set(manager.headers).send({ role: "ta" }).expect(409);
    expect(await prisma.membershipAudit.count({ where: { targetId: target.id, action: "approved" } })).toBe(1);
  });
  it("protects the final manager from deactivation and demotion, including pending/inactive peers", async () => {
    const manager = await account("lab_manager");
    await account("lab_manager", "PENDING");
    const inactive = await account("lab_manager");
    await prisma.user.update({ where: { id: inactive.id }, data: { active: false } });
    const path = `/api/memberships/${manager.id}`;
    for (const change of [{ action: "role", role: "member" }, { action: "active", active: false }]) {
      const response = await request(app).patch(path).set(manager.headers).send({ ...change, expectedVersion: 0 }).expect(409);
      expect(response.body.error).toMatch(/at least one/);
    }
    expect(await prisma.membershipAudit.count()).toBe(0);
    await account("lab_manager");
    await request(app).patch(path).set(manager.headers).send({ action: "role", role: "ta", expectedVersion: 0 }).expect(200);
    await request(app).get("/api/memberships?scope=all").set(manager.headers).expect(403);
  });
  it("serializes concurrent self-demotions so one approved active manager survives", async () => {
    const a = await account("lab_manager"), b = await account("lab_manager");
    const results = await Promise.all([a, b].map(user => request(app).patch(`/api/memberships/${user.id}`).set(user.headers).send({ action: "role", role: "member", expectedVersion: 0 })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { active: true, role: "lab_manager", membershipStatus: "APPROVED" } })).toBe(1);
    expect(await prisma.membershipAudit.count()).toBe(1);
  });
  it("rejects stale concurrent edits, no-ops, unsupported roles, forged actor data and invalid bodies", async () => {
    const manager = await account("lab_manager"), target = await account("member");
    const path = `/api/memberships/${target.id}`;
    for (const body of [
      { action: "role", role: "admin", expectedVersion: 0 }, { action: "role", role: "unassigned", expectedVersion: 0 },
      { action: "active", active: "false", expectedVersion: 0 }, { action: "active", active: false },
      { action: "role", role: "ta", expectedVersion: 0, actorId: target.id },
      { action: "active", active: false, expectedVersion: -1 },
    ]) await request(app).patch(path).set(manager.headers).send(body).expect(400);
    await request(app).patch(path).set(manager.headers).send({ action: "role", role: "member", expectedVersion: 0 }).expect(409);
    const results = await Promise.all(["ta", "lab_manager"].map(role => request(app).patch(path).set(manager.headers).send({ action: "role", role, expectedVersion: 0 })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.membershipAudit.count()).toBe(1);
    await request(app).patch("/api/memberships/not-a-uuid").set(manager.headers).send({ action: "role", role: "ta", expectedVersion: 0 }).expect(400);
    await request(app).get("/api/memberships?scope=unknown").set(manager.headers).expect(400);
  });
  it("paginates history without duplicates and never exposes another member's events", async () => {
    const manager = await account("lab_manager"), target = await account("member");
    const data = { targetId: target.id, targetName: target.name, targetEmail: target.email, actorId: manager.id, actorName: manager.name, actorEmail: manager.email, action: "role_changed", previousRole: "member" as const, nextRole: "ta" as const, previousActive: true, nextActive: true, previousMembership: "APPROVED" as const, nextMembership: "APPROVED" as const };
    await prisma.membershipAudit.createMany({ data: Array.from({ length: 51 }, () => data) });
    const first = await request(app).get(`/api/memberships/${target.id}/history`).set(manager.headers).expect(200);
    expect(first.body.data).toHaveLength(50);
    const second = await request(app).get(`/api/memberships/${target.id}/history?before=${first.body.nextCursor}`).set(manager.headers).expect(200);
    expect(second.body.data).toHaveLength(1); expect(second.body.nextCursor).toBeNull();
    expect(new Set([...first.body.data, ...second.body.data].map(e => e.id)).size).toBe(51);
    expect((await request(app).get(`/api/memberships/${manager.id}/history`).set(manager.headers)).body.data).toEqual([]);
  });
});

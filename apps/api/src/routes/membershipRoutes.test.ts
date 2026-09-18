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
    for (const role of ["member", "ta", "admin", "unassigned", "lab_manager"] as const) {
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

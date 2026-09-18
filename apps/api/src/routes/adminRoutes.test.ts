import { randomBytes } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";
import { tokenHash } from "../auth/session.js";
import { hashPassword } from "../auth/password.js";

const app = createApp("http://localhost:3000");
const password = "Admin-test-password-123";
const passwordHash = await hashPassword(password);
async function account(role: UserRole) {
  const user = await prisma.user.create({ data: { email: `${randomBytes(8).toString("hex")}@example.test`, name: role, role, membershipStatus: "APPROVED", passwordHash } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { ...user, headers: { Authorization: `Bearer ${token}` } };
}
describe("administrator accounts", () => {
  it("rejects unauthenticated and non-admin reads and writes", async () => {
    await request(app).get("/api/admin/users").expect(401);
    await request(app).post("/api/admin/users").send({}).expect(401);
    await request(app).patch(`/api/admin/users/${randomBytes(16).toString("hex")}`).send({}).expect(401);
    for (const role of ["member", "ta", "lab_manager"] as const) {
      const user = await account(role);
      await request(app).get("/api/admin/users").set(user.headers).expect(403);
      await request(app).post("/api/admin/users").set(user.headers).send({}).expect(403);
      await request(app).patch(`/api/admin/users/${user.id}`).set(user.headers).send({}).expect(403);
    }
  });
  it("creates a login-capable user, rejects duplicates and hides secrets", async () => {
    const admin = await account("admin");
    const payload = { name: "New member", email: "NEW@example.test", role: "member", password };
    const created = await request(app).post("/api/admin/users").set(admin.headers).send(payload).expect(201);
    expect(created.body.data.email).toBe("new@example.test");
    expect(created.body.data.passwordHash).toBeUndefined();
    await request(app).post("/api/auth/login").send({ email: "new@example.test", password }).expect(200);
    await request(app).post("/api/admin/users").set(admin.headers).send(payload).expect(409);
    await request(app).post("/api/admin/users").set(admin.headers).send({ ...payload, password: "short" }).expect(400);
    const list = await request(app).get("/api/admin/users").set(admin.headers).expect(200);
    expect(list.body.data.every((u: Record<string, unknown>) => !("passwordHash" in u) && !("sessions" in u))).toBe(true);
  });
  it("revokes sessions on role changes and prevents deactivated users signing in", async () => {
    const admin = await account("admin"), member = await account("member");
    await request(app).patch(`/api/admin/users/${member.id}`).set(admin.headers).send({ name: "Updated", role: "ta", active: true }).expect(200);
    await request(app).get("/api/auth/me").set(member.headers).expect(401);
    const login = await request(app).post("/api/auth/login").send({ email: member.email, password }).expect(200);
    expect(login.body.user.role).toBe("ta");
    await request(app).patch(`/api/admin/users/${member.id}`).set(admin.headers).send({ name: "Updated", role: "ta", active: false }).expect(200);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`).expect(401);
    await request(app).post("/api/auth/login").send({ email: member.email, password }).expect(401);
    await request(app).patch(`/api/admin/users/${member.id}`).set(admin.headers).send({ name: "Updated", role: "ta", active: true }).expect(200);
    await request(app).post("/api/auth/login").send({ email: member.email, password }).expect(200);
    await request(app).get("/api/auth/me").set(member.headers).expect(401);
  });
  it("protects the acting admin and rejects invalid roles and email edits", async () => {
    const admin = await account("admin");
    const path = `/api/admin/users/${admin.id}`;
    await request(app).patch(path).set(admin.headers).send({ name: "Admin", role: "member", active: true }).expect(409);
    await request(app).patch(path).set(admin.headers).send({ name: "Admin", role: "admin", active: false }).expect(409);
    await request(app).patch(path).set(admin.headers).send({ name: "Admin", role: "superuser", active: true }).expect(400);
    await request(app).patch(path).set(admin.headers).send({ name: "Admin", role: "admin", active: true, email: "changed@example.test" }).expect(400);
    await request(app).get("/api/requests").set(admin.headers).expect(403);
  });
});

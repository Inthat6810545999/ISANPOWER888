import request from "supertest";
import { describe, it } from "vitest";
import { createApp } from "../app.js";

const app = createApp("http://localhost:3000");
describe("removed administrator API", () => {
  it("does not expose account management endpoints, even with claimed admin identity", async () => {
    await request(app).get("/api/admin/users").expect(404);
    await request(app).post("/api/admin/users").send({ role: "admin", email: "example@example.test" }).expect(404);
    await request(app).patch("/api/admin/users/00000000-0000-4000-8000-000000000000").send({ role: "admin" }).expect(404);
  });
});

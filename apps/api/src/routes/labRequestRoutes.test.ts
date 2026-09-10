import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const app = createApp("http://localhost:3000");

const validRequest = {
  title: "Book microscope room B2",
  type: "space",
  requesterEmail: "student@example.com",
};

describe("GET /api/health", () => {
  it("reports ok with a connected database", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "connected" });
  });
});

describe("lab requests", () => {
  it("creates a request with a default submitted status", async () => {
    const res = await request(app).post("/api/requests").send(validRequest).expect(201);
    expect(res.body.data).toMatchObject({ title: validRequest.title, status: "submitted" });
  });

  it("rejects a request with an invalid type", async () => {
    await request(app)
      .post("/api/requests")
      .send({ ...validRequest, type: "spaceship" })
      .expect(400);
  });

  it("lists created requests and filters by status", async () => {
    await request(app).post("/api/requests").send(validRequest).expect(201);

    const all = await request(app).get("/api/requests").expect(200);
    expect(all.body.data).toHaveLength(1);

    const approved = await request(app).get("/api/requests?status=approved").expect(200);
    expect(approved.body.data).toHaveLength(0);
  });

  it("updates the status of an existing request", async () => {
    const created = await request(app).post("/api/requests").send(validRequest).expect(201);

    const updated = await request(app)
      .patch(`/api/requests/${created.body.data._id}/status`)
      .send({ status: "approved" })
      .expect(200);

    expect(updated.body.data.status).toBe("approved");
  });

  it("returns 404 for a request that does not exist", async () => {
    await request(app).get("/api/requests/507f1f77bcf86cd799439011").expect(404);
  });
});

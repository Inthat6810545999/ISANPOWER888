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
  it("creates pending work without approval by default", async () => {
    const res = await request(app).post("/api/requests").send(validRequest).expect(201);
    expect(res.body.data).toMatchObject({ title: validRequest.title, status: "pending",
      approvalStatus: "not_required", requiresApproval: false, priority: "medium", location: "" });
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

    const closed = await request(app).get("/api/requests?status=closed").expect(200);
    expect(closed.body.data).toHaveLength(0);
  });

  it("updates the status of an existing request", async () => {
    const created = await request(app).post("/api/requests").send(validRequest).expect(201);

    const updated = await request(app)
      .patch(`/api/requests/${created.body.data.id}/status`)
      .send({ status: "in_progress" })
      .expect(200);

    expect(updated.body.data).toMatchObject({ status: "in_progress", approvalStatus: "not_required" });
  });

  it("returns 404 for a request that does not exist", async () => {
    await request(app)
      .get("/api/requests/00000000-0000-0000-0000-000000000000")
      .expect(404);
  });

  it("persists all form metadata and initializes approval independently", async () => {
    const fields = { ...validRequest, requiresApproval: true, priority: "high", location: "Lab B2",
      neededBy: "2026-10-15", description: "Prepare the equipment." };
    const created = await request(app).post("/api/requests").send(fields).expect(201);
    const loaded = await request(app).get(`/api/requests/${created.body.data.id}`).expect(200);
    expect(loaded.body.data).toMatchObject({ ...fields, neededBy: "2026-10-15T00:00:00.000Z",
      status: "pending", approvalStatus: "submitted" });
  });

  it("approval never closes work and work changes never approve it", async () => {
    const created = await request(app).post("/api/requests").send({ ...validRequest, requiresApproval: true }).expect(201);
    const url = `/api/requests/${created.body.data.id}`;
    const assigned = await request(app).patch(`${url}/status`).send({ status: "assigned" }).expect(200);
    expect(assigned.body.data).toMatchObject({ status: "assigned", approvalStatus: "submitted" });
    const approved = await request(app).patch(`${url}/approval-status`).send({ approvalStatus: "approved" }).expect(200);
    expect(approved.body.data).toMatchObject({ status: "assigned", approvalStatus: "approved" });
    const closed = await request(app).patch(`${url}/status`).send({ status: "closed" }).expect(200);
    expect(closed.body.data).toMatchObject({ status: "closed", approvalStatus: "approved" });
  });

  it("filters work and approval status independently and together", async () => {
    await request(app).post("/api/requests").send(validRequest).expect(201);
    await request(app).post("/api/requests").send({ ...validRequest, requiresApproval: true }).expect(201);
    const awaiting = await request(app).get("/api/requests?status=pending&approvalStatus=submitted").expect(200);
    expect(awaiting.body.data).toHaveLength(1);
    const noApproval = await request(app).get("/api/requests?approvalStatus=not_required").expect(200);
    expect(noApproval.body.data).toHaveLength(1);
    await request(app).get("/api/requests?status=approved").expect(400);
    await request(app).get("/api/requests?approvalStatus=in_progress").expect(400);
  });

  it("rejects mixing approval and work values without changing the record", async () => {
    const created = await request(app).post("/api/requests").send({ ...validRequest, requiresApproval: true }).expect(201);
    const url = `/api/requests/${created.body.data.id}`;
    await request(app).patch(`${url}/status`).send({ status: "approved" }).expect(400);
    await request(app).patch(`${url}/approval-status`).send({ approvalStatus: "closed" }).expect(400);
    await request(app).patch(`${url}/status`).send({ status: "assigned", approvalStatus: "approved" }).expect(400);
    await request(app).patch(`${url}/approval-status`).send({ approvalStatus: "not_required" }).expect(400);
    const loaded = await request(app).get(url).expect(200);
    expect(loaded.body.data).toMatchObject({ status: "pending", approvalStatus: "submitted" });
  });

  it("does not approve requests that do not require approval", async () => {
    const created = await request(app).post("/api/requests").send(validRequest).expect(201);
    await request(app).patch(`/api/requests/${created.body.data.id}/approval-status`).send({ approvalStatus: "approved" }).expect(400);
  });

  it.each([
    { priority: "urgent" }, { requiresApproval: "true" }, { location: "x".repeat(201) },
    { status: "closed" }, { approvalStatus: "approved" },
  ])("rejects invalid form data or client-controlled initial status: %j", async (invalid) => {
    await request(app).post("/api/requests").send({ ...validRequest, ...invalid }).expect(400);
  });

  it("returns 404 from both status endpoints for a missing request", async () => {
    const url = "/api/requests/00000000-0000-0000-0000-000000000000";
    await request(app).patch(`${url}/status`).send({ status: "cancelled" }).expect(404);
    await request(app).patch(`${url}/approval-status`).send({ approvalStatus: "approved" }).expect(404);
  });
});

describe("shared member and TA workflow", () => {
  const taEmail = "ta@isanpower.test";
  it("persists the complete member to TA to member flow", async () => {
    const created = await request(app).post("/api/requests").send({ ...validRequest,
      requesterEmail: "MEMBER@isanpower.test", priority: "high", location: "Lab 301",
      description: "Calibrate the sensor", neededBy: "2026-10-20", requiresApproval: true }).expect(201);
    const id = created.body.data.id;
    await request(app).post("/api/requests").send({ ...validRequest, requesterEmail: "another@example.com" }).expect(201);
    const member = await request(app).get("/api/requests?requesterEmail=member%40isanpower.test").expect(200);
    expect(member.body.data).toHaveLength(1);
    expect(member.body.data[0]).toMatchObject({ id, status: "pending", assigneeEmail: null });
    const queue = await request(app).get("/api/requests").expect(200);
    expect(queue.body.data.some((r: { id: string }) => r.id === id)).toBe(true);
    for (const [action, status] of [["claim", "assigned"], ["start", "in_progress"], ["close", "closed"]]) {
      await request(app).patch(`/api/requests/${id}/ta-action`).send({ action, assigneeEmail: taEmail }).expect(200);
      const reloaded = await request(app).get("/api/requests?requesterEmail=member%40isanpower.test").expect(200);
      expect(reloaded.body.data[0]).toMatchObject({ id, status, assigneeEmail: taEmail,
        approvalStatus: "submitted", priority: "high", location: "Lab 301", description: "Calibrate the sensor",
        neededBy: "2026-10-20T00:00:00.000Z" });
    }
  });

  it("allows only one concurrent claim and prevents stale or other-TA changes", async () => {
    const created = await request(app).post("/api/requests").send(validRequest).expect(201);
    const endpoint = `/api/requests/${created.body.data.id}/ta-action`;
    const results = await Promise.all([taEmail, "other-ta@example.com"].map((assigneeEmail) =>
      request(app).patch(endpoint).send({ action: "claim", assigneeEmail })));
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const winner = results.find((res) => res.status === 200)!.body.data.assigneeEmail;
    await request(app).patch(endpoint).send({ action: "close", assigneeEmail: winner }).expect(409);
    await request(app).patch(endpoint).send({ action: "start", assigneeEmail: "stranger@example.com" }).expect(409);
    await request(app).patch(endpoint).send({ action: "start", assigneeEmail: winner }).expect(200);
    await request(app).patch(endpoint).send({ action: "start", assigneeEmail: winner }).expect(409);
  });

  it("validates TA actions and handles missing requests", async () => {
    const endpoint = "/api/requests/00000000-0000-0000-0000-000000000000/ta-action";
    await request(app).patch(endpoint).send({ action: "approve", assigneeEmail: taEmail }).expect(400);
    await request(app).patch(endpoint).send({ action: "claim", assigneeEmail: taEmail }).expect(404);
    await request(app).get("/api/requests?requesterEmail=invalid").expect(400);
  });
});

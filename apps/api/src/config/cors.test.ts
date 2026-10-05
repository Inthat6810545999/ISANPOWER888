import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/connect.js";

const path = "/api/visits/track";
const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
describe("explicit shared CORS policy", () => {
  it.each(localOrigins)("allows %s in development for tracking and existing API routes", async origin => {
    const app = createApp("https://ignored-in-development.example", "development");
    for (const [url, method] of [[path, "POST"], ["/api/requests", "PATCH"]] as const) {
      const response = await request(app).options(url).set("Origin", origin)
        .set("Access-Control-Request-Method", method).set("Access-Control-Request-Headers", "content-type,authorization").expect(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      expect(response.headers["access-control-allow-methods"]).toContain(method);
      expect(response.headers["access-control-allow-headers"]).toBe("content-type,authorization");
      expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
      expect(response.headers.vary).toContain("Origin");
      if (url === path) expect(response.headers["cache-control"]).toBe("no-store");
    }
    const result = await request(app).post(path).set("Origin", origin).send({ code: "invalid" }).expect(404);
    expect(result.headers["access-control-allow-origin"]).toBe(origin);
    expect(result.headers["access-control-expose-headers"]).toBe("Retry-After");
    expect(result.body).toEqual({ error: "Visit request not found." });
    const health = await request(app).get("/api/health").set("Origin", origin).expect(200);
    expect(health.headers["access-control-allow-origin"]).toBe(origin);
    const submission = await request(app).post("/api/visits").set("Origin", origin).send({}).expect(400);
    expect(submission.headers["access-control-allow-origin"]).toBe(origin);
    await request(app).get("/api/requests").set("Origin", origin).expect(401);
  });

  it.each(["https://untrusted.example", "http://localhost:3001", "http://localhost:3000.evil.example", "https://localhost:3000", "null"])("rejects unlisted origin %s before processing", async origin => {
    const app = createApp(undefined, "development");
    for (const url of [path, "/api/visits"]) {
      const preflight = await request(app).options(url).set("Origin", origin)
        .set("Access-Control-Request-Method", "POST").expect(403);
      const post = await request(app).post(url).set("Origin", origin).send({ code: "invalid" }).expect(403);
      for (const response of [preflight, post]) {
        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
        expect(response.body).toEqual({ error: "Origin not allowed." });
        if (url === path) expect(response.headers["cache-control"]).toBe("no-store");
      }
    }
    expect(await prisma.publicRateLimit.count()).toBe(0);
    expect(await prisma.labRequest.count()).toBe(0);
  });

  it("production allows one configured origin only, without development aliases", async () => {
    const app = createApp("https://lab.example.org/", "production");
    for (const url of [path, "/api/requests"]) {
      const allowed = await request(app).options(url).set("Origin", "https://lab.example.org")
        .set("Access-Control-Request-Method", "POST").expect(204);
      expect(allowed.headers["access-control-allow-origin"]).toBe("https://lab.example.org");
      for (const origin of [...localOrigins, "https://other.example.org"]) {
        const denied = await request(app).options(url).set("Origin", origin)
          .set("Access-Control-Request-Method", "POST").expect(403);
        expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
      }
    }
    await request(app).get("/api/health").expect(200); // Existing server-to-server calls have no Origin.
  });

  it.each([undefined, "", "*", "https://lab.example.org/path", "https://lab.example.org?x=1", "https://user:secret@lab.example.org", "https://lab.example.org,https://other.example.org"])("fails closed for invalid production configuration %s", value => {
    expect(() => createApp(value, "production")).toThrow();
  });
});

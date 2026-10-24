import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile, mkdir } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";

// Run with: node --import ../api/node_modules/tsx/dist/loader.mjs --test scripts/public-message.live.test.mjs
// Creates a uniquely named, empty database; never resets or deletes development/demo records.
test("real API + isolated PostgreSQL: Manager save -> fresh Visitor lookup", { timeout: 180000 }, async t => {
  const apiRequire = createRequire(new URL("../../api/package.json", import.meta.url));
  const { PrismaClient } = apiRequire("@prisma/client");
  const { parse } = apiRequire("dotenv");
  const config = parse(await readFile(new URL("../../api/.env", import.meta.url)));
  const baseUrl = process.env.MESSAGE_TEST_ADMIN_DATABASE_URL ?? config.DATABASE_URL;
  assert.ok(baseUrl, "An administrative PostgreSQL connection is required");
  const database = `visitor_message_${Date.now()}_test`;
  assert.match(database, /^visitor_message_\d+_test$/);
  const admin = new PrismaClient({ datasourceUrl: baseUrl });
  const connection = new URL(baseUrl); connection.pathname = `/${database}`;
  let db, server, next, browser, created = false;
  t.after(async () => {
    await browser?.close();
    if (next) await new Promise(resolve => {
      if (process.platform === "win32") {
        const stop = spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" });
        stop.once("exit", resolve);
        stop.once("error", resolve);
      } else {
        next.once("exit", resolve);
        next.once("error", resolve);
        next.kill("SIGTERM");
      }
    });
    if (server) await new Promise(resolve => server.close(resolve));
    await db?.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  process.env.DATABASE_URL = connection.toString(); process.env.NODE_ENV = "test";
  execFileSync(process.execPath, [fileURLToPath(new URL("../../api/node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy"], {
    cwd: fileURLToPath(new URL("../../api/", import.meta.url)), env: process.env, stdio: "pipe",
  });
  const integration = execFileSync(process.execPath, [fileURLToPath(new URL("../../api/node_modules/vitest/vitest.mjs", import.meta.url)),
    "run", "src/routes/visitorMessageRoutes.test.ts", "src/routes/visitTrackRoutes.test.ts"], {
    cwd: fileURLToPath(new URL("../../api/", import.meta.url)), env: process.env, encoding: "utf8", stdio: "pipe",
  });
  console.log(integration);
  const { prisma } = await import("../../api/src/db/connect.ts"); db = prisma;
  const { createApp } = await import("../../api/src/app.ts");
  const web = "http://127.0.0.1:3102", api = "http://127.0.0.1:4102";
  server = createApp(web, "test").listen(4102, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const user = await db.user.create({ data: { name: "Integration Manager", email: "manager@example.test", role: "lab_manager", membershipStatus: "APPROVED" } });
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
  const submit = await fetch(`${api}/api/visits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    contactName: "Test Visitor", email: "visitor@example.test", purpose: "tour", details: "Synthetic integration fixture",
    visitDate: "2099-12-01", timeSlot: "morning", visitorCount: 1,
  }) });
  assert.equal(submit.status, 201); const receipt = (await submit.json()).data;
  const approved = await fetch(`${api}/api/requests/${receipt.requestId}/approval-status`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approvalStatus: "approved", reason: "Private integration reason", publicMessage: "Original message" }) });
  assert.equal(approved.status, 200);
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
    env: { ...process.env, NODE_ENV: "development", API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/message-live" }, stdio: "ignore",
  });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`)).ok) break; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: "isanpower_session", value: token, url: web, httpOnly: true }]);
  const page = await context.newPage(); await page.goto(`${web}/manager/approvals`);
  await page.getByRole("button", { name: /^All requests/ }).click(); await page.getByRole("button", { name: "Public message", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Edit public message" }).click();
  await dialog.getByRole("textbox", { name: "Public message to Visitor" }).fill("Please meet at reception. Updated by the Manager.");
  await dialog.getByRole("button", { name: "Save message", exact: true }).click(); await dialog.getByText(/Public message saved/).waitFor();
  const stored = await db.labRequest.findUniqueOrThrow({ where: { id: receipt.requestId } });
  assert.equal(stored.publicMessage, "Please meet at reception. Updated by the Manager."); assert.equal(stored.publicMessageUpdatedById, user.id);
  const evidence = new URL("../../../docs/development/evidence/visitor-message/", import.meta.url); await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL("live-saved.png", evidence)), fullPage: true });
  const visitor = await browser.newPage(); await visitor.goto(`${web}/visit/track`);
  await visitor.getByLabel("Tracking code", { exact: true }).fill(receipt.trackingCode);
  const tracked = visitor.waitForResponse(`${api}/api/visits/track`);
  await visitor.getByRole("button", { name: "Find my request" }).click();
  const publicData = (await (await tracked).json()).data;
  assert.deepEqual(Object.keys(publicData).sort(), ["approvalStatus", "publicMessage", "status", "timeSlot", "visitDate"]);
  await visitor.getByText(stored.publicMessage, { exact: true }).waitFor();
  assert.equal((await visitor.locator("body").innerText()).includes("Private integration reason"), false);
  // Hide the real test-only tracking credential before capturing evidence.
  await visitor.getByLabel("Tracking code", { exact: true }).fill("");
  await visitor.screenshot({ path: fileURLToPath(new URL("live-visitor-latest.png", evidence)), fullPage: true });
  await dialog.getByRole("button", { name: "Edit public message" }).click();
  await dialog.getByRole("textbox", { name: "Public message to Visitor" }).fill("");
  await dialog.getByRole("button", { name: "Save message", exact: true }).click(); await dialog.getByText("No public message.", { exact: true }).waitFor();
  await visitor.getByLabel("Tracking code", { exact: true }).fill(receipt.trackingCode);
  await visitor.getByRole("button", { name: "Find my request" }).click(); await visitor.getByRole("region", { name: "Visit request result" }).waitFor();
  assert.equal(await visitor.getByText(stored.publicMessage, { exact: true }).count(), 0);
});

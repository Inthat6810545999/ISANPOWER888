import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile, mkdir } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";

// Run only against a newly created, uniquely named database; never use a demo database.
test("live Member -> Manager -> TA workflow and rejection in the browser", { timeout: 240000 }, async t => {
  const apiRequire = createRequire(new URL("../../api/package.json", import.meta.url));
  const { PrismaClient } = apiRequire("@prisma/client");
  const { parse } = apiRequire("dotenv");
  const config = parse(await readFile(new URL("../../api/.env", import.meta.url)));
  const baseUrl = process.env.WORKFLOW_TEST_ADMIN_DATABASE_URL ?? config.DATABASE_URL;
  assert.ok(baseUrl, "An administrative PostgreSQL connection is required");
  const database = `workflow_smoke_${Date.now()}_test`;
  assert.match(database, /^workflow_smoke_\d+_test$/);
  const admin = new PrismaClient({ datasourceUrl: baseUrl });
  const connection = new URL(baseUrl);
  connection.pathname = `/${database}`;
  const web = "http://127.0.0.1:3103";
  const api = "http://127.0.0.1:4103";
  let db, server, next, browser, created = false;
  t.after(async () => {
    await browser?.close();
    if (next) await new Promise(resolve => {
      if (process.platform === "win32") {
        const stop = spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" });
        stop.once("exit", resolve); stop.once("error", resolve);
      } else {
        next.once("exit", resolve); next.once("error", resolve); next.kill("SIGTERM");
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
  const { prisma } = await import("../../api/src/db/connect.ts"); db = prisma;
  const { createApp } = await import("../../api/src/app.ts");
  server = createApp(web, "test").listen(4103, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));

  async function account(role) {
    const email = `${role.replace("_", "-")}@workflow.test`;
    const user = await db.user.create({ data: { email, name: `Smoke ${role}`, role, membershipStatus: "APPROVED" } });
    const token = randomBytes(32).toString("hex");
    await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
    return { user, token };
  }
  const member = await account("member");
  const manager = await account("lab_manager");
  const ta = await account("ta");
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3103"], {
    env: { ...process.env, NODE_ENV: "development", API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/workflow-smoke" }, stdio: "ignore",
  });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next.js server did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  async function pageFor(token) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: "isanpower_session", value: token, url: web, httpOnly: true }]);
    return context.newPage();
  }
  const memberPage = await pageFor(member.token);
  const managerPage = await pageFor(manager.token);
  const taPage = await pageFor(ta.token);
  const evidence = new URL("../../../docs/development/evidence/workflow-smoke/", import.meta.url);
  await mkdir(evidence, { recursive: true });

  async function submit(title) {
    await memberPage.goto(`${web}/workspace/requests/new`);
    await memberPage.getByRole("textbox", { name: "Request title *" }).fill(title);
    await memberPage.getByRole("textbox", { name: "What do you need? *" }).fill("Synthetic workflow smoke test request");
    await memberPage.getByRole("button", { name: "Submit request" }).click();
    await memberPage.waitForURL("**/workspace/my-requests");
    await memberPage.getByRole("row", { name: new RegExp(title) }).waitFor();
    const request = await db.labRequest.findFirstOrThrow({ where: { title } });
    assert.equal(request.requesterEmail, member.user.email);
    assert.equal(request.status, "pending");
    assert.equal(request.approvalStatus, "submitted");
    return request.id;
  }
  async function decide(title, outcome) {
    await managerPage.goto(`${web}/manager/approvals`);
    const row = managerPage.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Review" }).click();
    const dialog = managerPage.getByRole("dialog");
    await dialog.getByLabel("Decision").selectOption(outcome);
    await dialog.getByLabel("Reason (internal)").fill(`Synthetic ${outcome} reason`);
    await dialog.getByRole("button", { name: "Record decision" }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  const approvedTitle = "Smoke approved workflow";
  const approvedId = await submit(approvedTitle);
  await memberPage.screenshot({ path: fileURLToPath(new URL("01-member-submitted.png", evidence)), fullPage: true });
  await decide(approvedTitle, "approved");
  assert.equal((await db.labRequest.findUniqueOrThrow({ where: { id: approvedId } })).approvalStatus, "approved");
  await managerPage.screenshot({ path: fileURLToPath(new URL("02-manager-approved.png", evidence)), fullPage: true });

  await taPage.goto(`${web}/ta/queue`);
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByRole("button", { name: "Assign to myself" }).click();
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByRole("button", { name: "Start work" }).waitFor();
  let request = await db.labRequest.findUniqueOrThrow({ where: { id: approvedId } });
  assert.equal(request.status, "assigned"); assert.equal(request.assigneeEmail, ta.user.email);
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByRole("button", { name: "Start work" }).click();
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByRole("button", { name: "Mark closed" }).waitFor();
  request = await db.labRequest.findUniqueOrThrow({ where: { id: approvedId } });
  assert.equal(request.status, "in_progress");
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByRole("button", { name: "Mark closed" }).click();
  await taPage.getByRole("button", { name: /^All requests/ }).click();
  await taPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByText(/Closed/i).waitFor();
  request = await db.labRequest.findUniqueOrThrow({ where: { id: approvedId } });
  assert.equal(request.status, "closed");
  await taPage.screenshot({ path: fileURLToPath(new URL("03-ta-closed.png", evidence)), fullPage: true });
  await memberPage.reload();
  await memberPage.getByRole("row", { name: new RegExp(approvedTitle) }).getByText(/Closed/i).waitFor();

  const rejectedTitle = "Smoke rejected workflow";
  const rejectedId = await submit(rejectedTitle);
  await decide(rejectedTitle, "rejected");
  await taPage.reload();
  await taPage.getByRole("button", { name: /^All requests/ }).click();
  const rejectedRow = taPage.getByRole("row", { name: new RegExp(rejectedTitle) });
  await rejectedRow.getByText("Rejected — work blocked").waitFor();
  assert.equal(await rejectedRow.getByRole("button", { name: "Assign to myself" }).isDisabled(), true);
  request = await db.labRequest.findUniqueOrThrow({ where: { id: rejectedId } });
  assert.equal(request.approvalStatus, "rejected"); assert.equal(request.status, "pending"); assert.equal(request.assigneeEmail, null);
  await taPage.screenshot({ path: fileURLToPath(new URL("04-ta-rejection-blocked.png", evidence)), fullPage: true });
  await memberPage.reload();
  await memberPage.getByRole("row", { name: new RegExp(rejectedTitle) }).getByText(/Approval: Rejected/i).waitFor();
});

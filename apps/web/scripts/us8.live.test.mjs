import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, cp, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";

// Never fall back to apps/api/.env: it may point to the team's shared Neon database.
test("US-8 real UI/API/database workflow and regressions", { timeout: 300000 }, async t => {
  assert.ok(process.env.US8_TEST_ADMIN_DATABASE_URL, "Set US8_TEST_ADMIN_DATABASE_URL to a LOCAL PostgreSQL connection");
  const connection = new URL(process.env.US8_TEST_ADMIN_DATABASE_URL);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(connection.hostname), "This runner only permits local PostgreSQL; never Neon");
  const database = `us8_${Date.now()}_${randomBytes(3).toString("hex")}_test`;
  assert.match(database, /^us8_\d+_[a-f0-9]+_test$/);
  const apiRequire = createRequire(new URL("../../api/package.json", import.meta.url));
  const { PrismaClient } = apiRequire("@prisma/client");
  const admin = new PrismaClient({ datasourceUrl: connection.toString() });
  let db, server, next, browser, created = false;
  t.after(async () => {
    await browser?.close();
    if (next) {
      if (process.platform === "win32") await new Promise(resolve => spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", resolve));
      else next.kill();
    }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db?.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  connection.pathname = `/${database}`;
  process.env.DATABASE_URL = connection.toString(); process.env.NODE_ENV = "test";
  const apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
  const runApi = (entry, args) => execFileSync(process.execPath, [fileURLToPath(new URL(`../../api/node_modules/${entry}`, import.meta.url)), ...args], { cwd: apiDir, env: process.env, encoding: "utf8", stdio: "pipe" });
  // Build a pre-US8 schema history in ignored local build output, then upgrade it.
  const build = fileURLToPath(new URL("../build/", import.meta.url)); await mkdir(build, { recursive: true });
  const legacy = await mkdtemp(join(build, "us8-migrations-"));
  const prismaDir = fileURLToPath(new URL("../../api/prisma/", import.meta.url));
  await cp(join(prismaDir, "schema.prisma"), join(legacy, "schema.prisma"));
  await mkdir(join(legacy, "migrations"));
  for (const name of await readdir(join(prismaDir, "migrations"))) {
    if (name !== "20261107000000_industry_collaboration") await cp(join(prismaDir, "migrations", name), join(legacy, "migrations", name), { recursive: true });
  }
  runApi("prisma/build/index.js", ["migrate", "deploy", "--schema", join(legacy, "schema.prisma")]);
  const legacyClient = new PrismaClient({ datasourceUrl: connection.toString() });
  let legacyRequest;
  try {
    const reviewer = await legacyClient.user.create({ data: { name: "Legacy reviewer", email: "legacy@example.test", role: "lab_manager", membershipStatus: "APPROVED" } });
    legacyRequest = await legacyClient.labRequest.create({ data: { title: "Preserve legacy request", requesterEmail: "legacy-member@example.test", type: "general",
      status: "closed", approvalStatus: "approved", decisions: { create: { outcome: "approved", reason: "Preserve legacy decision", reviewerId: reviewer.id, reviewerName: reviewer.name, reviewerEmail: reviewer.email } } }, include: { decisions: true } });
  } finally { await legacyClient.$disconnect(); }
  console.log(runApi("prisma/build/index.js", ["migrate", "deploy"]));
  const upgraded = new PrismaClient({ datasourceUrl: connection.toString() });
  try { assert.deepEqual(await upgraded.labRequest.findUnique({ where: { id: legacyRequest.id }, include: { decisions: true } }), legacyRequest); }
  finally { await upgraded.$disconnect(); }
  console.log("Migration preservation: legacy request and decision unchanged");
  console.log(runApi("vitest/vitest.mjs", ["run"]));
  const { prisma } = await import("../../api/src/db/connect.ts"); db = prisma;
  const { createApp } = await import("../../api/src/app.ts");
  const web = "http://127.0.0.1:3118", api = "http://127.0.0.1:4118";
  const app = createApp(web, "test");
  let failNext = false, posts = 0;
  server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/requests/industry-collaboration") {
      posts++;
      await new Promise(resolve => setTimeout(resolve, 400));
      if (failNext) { failNext = false; res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Temporary test outage. Try again." })); return; }
    }
    app(req, res);
  }).listen(4118, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const tokens = {};
  for (const role of ["ta", "lab_manager"]) {
    const user = await db.user.create({ data: { name: `QA ${role}`, email: `${role}@example.test`, role, membershipStatus: "APPROVED" } });
    const token = randomBytes(32).toString("hex"); tokens[role] = token;
    await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
  }
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3118"], {
    env: { ...process.env, NODE_ENV: "development", API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/us8-live" }, stdio: "ignore",
  });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const pages = {};
  for (const role of Object.keys(tokens)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await context.addCookies([{ name: "isanpower_session", value: tokens[role], url: web, httpOnly: true }]);
    pages[role] = await context.newPage();
  }
  const ta = pages.ta, manager = pages.lab_manager;
  const evidence = new URL("../../../docs/development/evidence/us8/", import.meta.url); await mkdir(evidence, { recursive: true });
  const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true,
    mask: [page.locator('#collaboration-code, #collaboration-link, #tracking-code')], maskColor: '#222222' });
  const external = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const publicBodies = [];
  external.on('request', req => {
    if (req.url().includes('/api/collaborations/track')) publicBodies.push(JSON.parse(req.postData()));
  });
  async function openPrivateLink(link) {
    try { await external.goto(link); } catch { throw new Error("Tracking navigation failed (credential redacted)"); }
  }
  async function lookup(expected) {
    await external.getByRole('button', { name: 'Find my request' }).click();
    await external.getByRole('region', { name: 'Collaboration request result' }).getByText(expected, { exact: true }).waitFor();
  }
  async function fill(title) {
    await ta.goto(`${web}/ta/collaborations/new`);
    for (const [label, value] of [["Request title", title], ["Company / organization", "Example Industry Ltd"], ["External contact name", "Partner Contact"], ["External contact email", "partner@example.test"], ["Purpose and collaboration details", "Joint research with <b>plain text</b> details."]]) await ta.getByLabel(label, { exact: false }).fill(value);
  }
  await fill("US8 approved partnership");
  failNext = true;
  const submit = ta.getByRole("button", { name: "Submit collaboration request" });
  await submit.click();
  await ta.getByRole("alert").filter({ hasText: "Temporary test outage. Try again." }).waitFor();
  assert.equal(await submit.isEnabled(), true);
  assert.equal(await ta.getByLabel("Request title", { exact: false }).inputValue(), "US8 approved partnership");
  await shot(ta, "01-draft-after-error");
  await submit.locator("..").locator("..").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await ta.getByRole("link", { name: "Open created request" }).waitFor(); assert.equal(posts, 2);
  const trackingCode = await ta.getByLabel('Tracking code', { exact: true }).inputValue();
  const trackingLink = await ta.getByLabel('Tracking link', { exact: true }).inputValue();
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(trackingCode));
  // Codes never appear in assertion messages, logs, URL queries or screenshots.
  await openPrivateLink(trackingLink);
  await external.getByRole('heading', { name: 'Collaboration request found' }).waitFor();
  assert.equal(new URL(external.url()).hash, '');
  assert.equal(await external.getByText('Requested date', { exact: true }).count(), 0);
  assert.equal(await external.getByText('Example Industry Ltd', { exact: true }).count(), 0);
  assert.equal(publicBodies.length, 1);
  await shot(external, '09-public-awaiting-review');
  await shot(ta, "02-created");
  await ta.getByRole("link", { name: "Open created request" }).click();
  await ta.getByRole("heading", { name: "US8 approved partnership" }).waitFor();
  await ta.reload(); await ta.getByText("Example Industry Ltd", { exact: true }).waitFor();
  assert.equal(await ta.locator("b").count(), 0);
  const id = new URL(ta.url()).pathname.split("/").at(-1);
  assert.equal(await db.visitTrackingCredential.count({ where: { requestId: id } }), 1);
  assert.equal(await ta.getByLabel('Tracking code', { exact: true }).count(), 0);
  await shot(ta, "03-persisted-details");
  await manager.goto(`${web}/manager/approvals`);
  let row = manager.getByRole("row").filter({ hasText: "US8 approved partnership" });
  await row.getByRole("button", { name: "Review", exact: true }).click();
  await manager.getByRole("dialog").getByText("Example Industry Ltd", { exact: true }).waitFor();
  await shot(manager, "04-manager-review");
  await manager.locator('select[name="decision"]').selectOption("approved");
  await manager.getByLabel("Reason (internal)", { exact: true }).fill("Formal collaboration approved");
  await manager.getByRole("button", { name: "Record decision" }).click();
  await manager.getByRole("dialog").waitFor({ state: "hidden" });
  await ta.reload(); await ta.getByText("Formal collaboration approved", { exact: true }).waitFor();
  await shot(ta, "05-ta-approved");
  await lookup('Approved'); await shot(external, '10-public-approved');
  await ta.goto(`${web}/ta/queue`);
  row = ta.getByRole("row").filter({ hasText: "US8 approved partnership" });
  await row.getByRole("button", { name: "Assign to myself" }).click();
  await row.locator('[data-kind="work"][data-status="assigned"]').waitFor();
  await lookup('Assigned to lab staff');
  await row.getByRole("button", { name: "Start work" }).click();
  await row.locator('[data-kind="work"][data-status="in_progress"]').waitFor();
  await lookup('In progress');
  await row.getByRole("button", { name: "Mark closed" }).click();
  await row.getByText("Work: Closed", { exact: true }).waitFor(); await shot(ta, "06-closed");
  await lookup('Closed'); await shot(external, '11-public-closed');
  await fill("US8 rejected partnership"); await submit.click(); await ta.getByRole("link", { name: "Open created request" }).waitFor();
  const rejectedLink = await ta.getByLabel('Tracking link', { exact: true }).inputValue();
  await ta.getByRole("link", { name: "Open created request" }).click();
  await openPrivateLink(rejectedLink); await external.getByRole('heading', { name: 'Collaboration request found' }).waitFor();
  await manager.goto(`${web}/manager/approvals`);
  await manager.getByRole("row").filter({ hasText: "US8 rejected partnership" }).getByRole("button", { name: "Review", exact: true }).click();
  await manager.locator('select[name="decision"]').selectOption("rejected");
  await manager.getByLabel("Reason (internal)", { exact: true }).fill("Resources unavailable for partnership");
  await manager.getByRole("button", { name: "Record decision" }).click(); await manager.getByRole("dialog").waitFor({ state: "hidden" });
  await external.getByRole('button', { name: 'Find my request' }).click();
  await external.getByRole('heading', { name: 'Request declined' }).waitFor();
  assert.equal(await external.getByText('Resources unavailable for partnership', { exact: true }).count(), 0);
  await shot(external, '12-public-rejected');
  await ta.goto(`${web}/ta/queue`); await ta.getByRole("button", { name: /^All requests/ }).click();
  row = ta.getByRole("row").filter({ hasText: "US8 rejected partnership" });
  assert.equal(await row.getByRole("button", { name: "Assign to myself" }).isDisabled(), true);
  await shot(ta, "07-rejected-blocked");
  await manager.goto(`${web}/manager/reports`); await manager.getByRole("cell", { name: "External Industry Collaboration", exact: true }).waitFor();
  await shot(manager, "08-reports");
  const anonymous = await browser.newPage(); await anonymous.goto(`${web}/ta/collaborations/new`); assert.ok(anonymous.url().endsWith("/login"));
  await manager.goto(`${web}/ta/collaborations/new`); assert.ok(manager.url().includes("/manager/"));
  // Run the existing Visitor browser suite against this same isolated API.
  // Async child execution keeps this process's Express server responsive.
  await new Promise((resolve, reject) => {
    const regressionEnv = { ...process.env, TRACK_TEST_WEB_URL: web, TRACK_TEST_API_URL: api, TRACK_TEST_ORIGINS: web };
    delete regressionEnv.NODE_TEST_CONTEXT;
    const regression = spawn(process.execPath, ['--test', '--test-concurrency=1', 'scripts/visitor-track.browser.test.mjs'], {
      env: regressionEnv, stdio: 'inherit',
    });
    regression.once('error', reject);
    regression.once('exit', code => code === 0 ? resolve() : reject(new Error('Visitor tracking browser regression failed')));
  });
});

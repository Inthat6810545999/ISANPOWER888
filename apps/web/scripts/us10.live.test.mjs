import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, cp, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";

// Run only against a newly created, uniquely named database; never use a demo database.
test("US-10 migration preservation and member management in a real browser", { timeout: 240000 }, async t => {
  const apiRequire = createRequire(new URL("../../api/package.json", import.meta.url));
  const { PrismaClient } = apiRequire("@prisma/client");
  const baseUrl = process.env.US10_TEST_ADMIN_DATABASE_URL;
  assert.ok(baseUrl, "Set US10_TEST_ADMIN_DATABASE_URL to a local PostgreSQL admin connection");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseUrl).hostname), "Only local PostgreSQL is permitted; never Neon");
  const database = `us10_history_${Date.now()}_test`;
  assert.match(database, /^us10_history_\d+_test$/);
  const admin = new PrismaClient({ datasourceUrl: baseUrl });
  const connection = new URL(baseUrl);
  connection.pathname = `/${database}`;
  const web = "http://127.0.0.1:3110";
  const api = "http://127.0.0.1:4110";
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
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db?.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  });

  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  process.env.DATABASE_URL = connection.toString(); process.env.NODE_ENV = "test";
  const apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
  const migrate = args => execFileSync(process.execPath, [fileURLToPath(new URL("../../api/node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy", ...args], { cwd: apiDir, env: process.env, stdio: "pipe" });
  const build = fileURLToPath(new URL("../build/", import.meta.url)); await mkdir(build, { recursive: true });
  const legacyDir = await mkdtemp(join(build, "us10-migration-"));
  const prismaDir = fileURLToPath(new URL("../../api/prisma/", import.meta.url));
  await cp(join(prismaDir, "schema.prisma"), join(legacyDir, "schema.prisma"));
  await mkdir(join(legacyDir, "migrations"));
  for (const name of await readdir(join(prismaDir, "migrations"))) {
    if (name !== "20261108000000_member_management") await cp(join(prismaDir, "migrations", name), join(legacyDir, "migrations", name), { recursive: true });
  }
  migrate(["--schema", join(legacyDir, "schema.prisma")]);
  const oldDb = new PrismaClient({ datasourceUrl: connection.toString() });
  try {
    // Raw SQL intentionally uses the old schema before membershipVersion exists.
    await oldDb.$executeRaw`INSERT INTO users (id, email, name, role, "membershipStatus", active) VALUES ('legacy-user', 'legacy@example.test', 'Legacy member', 'member', 'APPROVED', true)`;
    const before = await oldDb.$queryRaw`SELECT id, email, name, role, "membershipStatus", active FROM users`;
    migrate([]);
    assert.deepEqual(await oldDb.$queryRaw`SELECT id, email, name, role, "membershipStatus", active FROM users`, before);
    assert.equal((await oldDb.user.findUniqueOrThrow({ where: { id: "legacy-user" } })).membershipVersion, 0);
    assert.equal(await oldDb.membershipAudit.count(), 0);
  } finally { await oldDb.$disconnect(); }
  const { prisma } = await import("../../api/src/db/connect.ts"); db = prisma;
  const { createApp } = await import("../../api/src/app.ts");
  server = createApp(web, "test").listen(4110, "127.0.0.1");
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
  const applicant = await db.user.create({ data: { name: "New applicant", email: "applicant@workflow.test" } });
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3110"], {
    env: { ...process.env, NODE_ENV: "development", API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/us10-live" }, stdio: "ignore",
  });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next.js server did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  async function pageFor(token) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: "isanpower_session", value: token, url: web, httpOnly: true }]);
    return context.newPage();
  }
  const page = await pageFor(manager.token);
  const evidence = new URL("../../../docs/development/evidence/us10/", import.meta.url);
  await mkdir(evidence, { recursive: true });
  const card = email => page.getByRole("article").filter({ has: page.getByText(email, { exact: true }) });
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true });
  await page.goto(`${web}/manager/members`);
  await page.getByRole("heading", { name: "Member management" }).waitFor();
  const own = card(manager.user.email);
  assert.equal(await own.getByRole("button", { name: "Save role" }).isDisabled(), true);
  assert.equal(await own.getByRole("button", { name: "Deactivate account" }).isDisabled(), true);
  await shot("desktop");

  await page.getByLabel("Filter by account status").selectOption("pending");
  const applicantCard = card(applicant.email);
  await applicantCard.getByLabel("Assign lab role").selectOption("member");
  await applicantCard.getByRole("button", { name: "Approve & assign role" }).click();
  await page.getByText("No members found").waitFor();
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: applicant.id } })).role, "member");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Search members").fill(applicant.email);
  await applicantCard.getByLabel("Lab role").selectOption("ta");
  await applicantCard.getByRole("button", { name: "Save role" }).click();
  await applicantCard.getByText("Active · Teaching Assistant", { exact: true }).waitFor();
  await applicantCard.getByText("Management history").click();
  await applicantCard.getByRole("button", { name: "Load history" }).click();
  await applicantCard.getByText("Registration approved", { exact: true }).waitFor();
  await applicantCard.getByText("Role changed", { exact: true }).waitFor();
  await shot("history");

  // Two open pages: the stale one must not overwrite the newer role.
  const stale = await pageFor(manager.token);
  await stale.goto(`${web}/manager/members`);
  await stale.getByLabel("Search members").fill(applicant.email);
  const staleCard = stale.getByRole("article");
  await applicantCard.getByLabel("Lab role").selectOption("member");
  await applicantCard.getByRole("button", { name: "Save role" }).click();
  await applicantCard.getByText("Active · Lab Member", { exact: true }).waitFor();
  await staleCard.getByLabel("Lab role").selectOption("lab_manager");
  await staleCard.getByRole("button", { name: "Save role" }).click();
  await stale.getByRole("alert").filter({ hasText: "This member changed" }).waitFor();
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: applicant.id } })).role, "member");
  await stale.close();

  await page.getByLabel("Search members").fill(ta.user.email);
  const taCard = card(ta.user.email);
  await taCard.getByRole("button", { name: "Deactivate account" }).click();
  await taCard.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ta.user.id } })).active, true);
  await taCard.getByRole("button", { name: "Deactivate account" }).click();
  await taCard.getByRole("button", { name: "Confirm deactivation" }).click();
  await taCard.getByRole("button", { name: "Reactivate account" }).waitFor();
  assert.equal((await fetch(`${api}/api/auth/me`, { headers: { Authorization: `Bearer ${ta.token}` } })).status, 401);
  await taCard.getByRole("button", { name: "Reactivate account" }).click();
  await taCard.getByRole("button", { name: "Deactivate account" }).waitFor();
  assert.equal((await fetch(`${api}/api/auth/me`, { headers: { Authorization: `Bearer ${ta.token}` } })).status, 401);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "mobile page must not overflow horizontally");
  await shot("mobile");

  // Demotion of oneself leaves the management page and enforces the new role.
  await db.user.create({ data: { email: "backup@workflow.test", name: "Backup manager", role: "lab_manager", membershipStatus: "APPROVED" } });
  await page.getByRole("button", { name: "Refresh members" }).click();
  await page.getByText("Backup manager", { exact: true }).waitFor();
  await page.getByLabel("Search members").fill(manager.user.email);
  await own.getByLabel("Lab role").selectOption("member");
  await own.getByRole("button", { name: "Save role" }).click();
  await page.waitForURL("**/workspace/my-requests");
  await page.goto(`${web}/manager/members`);
  await page.waitForURL("**/workspace/my-requests");
  assert.equal((await fetch(`${api}/api/memberships?scope=all`, { headers: { Authorization: `Bearer ${member.token}` } })).status, 403);
  const audit = await db.membershipAudit.findMany({ orderBy: { id: "asc" } });
  assert.deepEqual(audit.map(event => event.action), ["approved", "role_changed", "role_changed", "deactivated", "reactivated", "role_changed"]);
});

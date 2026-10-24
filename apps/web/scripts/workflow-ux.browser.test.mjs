import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

// Isolated HTTP fixture: no database, no real accounts or tokens. Drives the real
// Next Server Actions and browser UI while controlling latency and failures, so the
// loading, empty, error, slow-network and double-submit paths can all be exercised.
test("workflow UX: loading, errors, retries and double submits", { timeout: 300000 }, async t => {
  const web = "http://127.0.0.1:3102";
  const api = "http://127.0.0.1:4102";
  const evidence = new URL("../../../docs/development/evidence/workflow-ux/", import.meta.url);
  await mkdir(evidence, { recursive: true });

  const approved = {
    id: "ready-request", title: "Calibrate the oscilloscope", description: "Ready to accept",
    type: "equipment", source: "member", status: "pending", approvalStatus: "approved", requiresApproval: true,
    priority: "medium", location: "Lab B2", requesterEmail: "member@example.test", assigneeEmail: null,
    neededBy: null, createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-20T09:00:00Z",
    publicMessage: "", visit: null, decision: null, decisionHistory: [],
  };
  // The case the brief calls out: declined, yet work status is still "pending".
  const rejected = { ...approved, id: "declined-request", title: "Order replacement sensors",
    approvalStatus: "rejected", requesterEmail: "member@example.test" };

  let role = "ta", listStatus = 200, listDelay = 0, actionStatus = 200, actionDelay = 0;
  let actionCalls = 0, createCalls = 0, createStatus = 201, createDelay = 0;
  const drain = req => new Promise(resolve => { req.resume(); req.on("end", resolve); });
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.url === "/api/auth/me") {
      return send(200, { user: { id: "synthetic-user", name: "Test User", email: "user@example.test", role, membershipStatus: "APPROVED" } });
    }
    if (req.url === "/api/requests" && req.method === "GET") {
      if (listDelay) await new Promise(resolve => setTimeout(resolve, listDelay));
      if (listStatus !== 200) return send(listStatus, { error: "The lab workspace is unavailable." });
      return send(200, { data: [approved, rejected] });
    }
    if (req.url === "/api/requests" && req.method === "POST") {
      createCalls++;
      await drain(req);
      if (createDelay) await new Promise(resolve => setTimeout(resolve, createDelay));
      if (createStatus !== 201) return send(createStatus, { error: "The lab workspace rejected the save." });
      return send(201, { data: { ...approved, id: "created", title: "Created request" } });
    }
    if (req.url?.endsWith("/ta-action")) {
      actionCalls++;
      await drain(req);
      if (actionDelay) await new Promise(resolve => setTimeout(resolve, actionDelay));
      if (actionStatus !== 200) return send(actionStatus, { error: "Another TA already claimed this request." });
      return send(200, { data: { ...approved, status: "assigned", assigneeEmail: "user@example.test" } });
    }
    send(404, { error: "Not found" });
  });
  await new Promise(resolve => server.listen(4102, "127.0.0.1", resolve));

  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
    env: { ...process.env, API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/workflow-ux" }, stdio: "ignore",
  });
  let browser;
  t.after(async () => {
    server.closeAllConnections();
    await browser?.close();
    if (process.platform === "win32") await new Promise(resolve => spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", resolve));
    else next.kill();
    await new Promise(resolve => server.close(resolve));
  });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`)).ok) break; } catch { /* wait for the isolated dev server */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: "isanpower_session", value: "synthetic-browser-session", url: web, httpOnly: true }]);
  const page = await context.newPage();
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true });

  // --- Slow network: the queue must say it is loading, not look empty. ---
  listDelay = 2500;
  await page.goto(`${web}/ta/queue`);
  await page.getByRole("heading", { name: "Loading requests…" }).waitFor({ timeout: 10000 });
  await shot("ta-loading");
  await page.getByRole("button", { name: /^Ready to accept/ }).waitFor();
  await page.getByText("Calibrate the oscilloscope").first().waitFor({ timeout: 15000 });
  listDelay = 0;

  // --- Approval and work progress must read as two separate facts. ---
  await page.getByRole("button", { name: /^All requests/ }).click();
  const declinedRow = page.locator("tr", { hasText: "Order replacement sensors" });
  assert.match(await declinedRow.innerText(), /Work: Pending/);
  assert.match(await declinedRow.innerText(), /Approval: Rejected/);
  await shot("status-separation");

  // --- Failed load with nothing on screen: explain it and offer a retry. ---
  listStatus = 503;
  await page.goto(`${web}/ta/queue`);
  await page.getByRole("heading", { name: "We could not load your requests" }).waitFor({ timeout: 15000 });
  await shot("ta-load-error");
  const retry = page.getByRole("button", { name: "Try again" });
  assert.equal(await retry.isVisible(), true);
  listStatus = 200;
  await retry.click();
  await page.getByText("Calibrate the oscilloscope").first().waitFor({ timeout: 15000 });
  await shot("ta-after-retry");

  // --- Double click on a work action must reach the API once. ---
  actionCalls = 0; actionDelay = 900;
  await page.getByRole("button", { name: /^Ready to accept/ }).click();
  const claim = page.getByRole("button", { name: "Assign to myself" }).first();
  // Two clicks in one tick: `disabled` only lands on the next render, so this is the
  // real race the in-flight guard has to win.
  await claim.evaluate(button => { button.click(); button.click(); });
  await page.getByText("Saving…").first().waitFor({ timeout: 5000 });
  await shot("ta-saving");
  await page.waitForTimeout(2500);
  assert.equal(actionCalls, 1, "a double click must not send two writes");

  // --- A failed work action names the request and leaves the buttons usable. ---
  actionDelay = 0; actionStatus = 409; actionCalls = 0;
  await page.goto(`${web}/ta/queue`);
  await page.getByRole("button", { name: "Assign to myself" }).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Assign to myself" }).first().click();
  const alert = page.locator('p[role="alert"]').filter({ hasText: "did not save" });
  await alert.waitFor({ timeout: 10000 }).catch(async () => {
    const all = await page.getByRole("alert").allInnerTexts();
    throw new Error(`no action error rendered; alerts on page: ${JSON.stringify(all)}`);
  });
  const alertText = await alert.innerText();
  assert.match(alertText, /Calibrate the oscilloscope/, "the error must name the request");
  assert.match(alertText, /try again/i);
  await shot("ta-action-error");
  assert.equal(await page.getByRole("button", { name: "Assign to myself" }).first().isDisabled(), false,
    "the button must be usable again after a failure");
  actionStatus = 200;

  // --- Member submission: one POST per double submit, and a saving announcement. ---
  role = "member"; createDelay = 1500; createCalls = 0;
  await page.goto(`${web}/workspace/requests/new`);
  await page.getByLabel("Request title *").fill("Prepare the sensor bench");
  await page.getByLabel("What do you need? *").fill("Two benches and a calibration kit for Thursday.");
  const submit = page.getByRole("button", { name: /Submit request/ });
  await submit.evaluate(button => { button.click(); button.click(); });
  await page.getByText("Saving your request… keep this page open.").waitFor({ timeout: 8000 });
  await shot("member-saving");
  await page.waitForURL(`${web}/workspace/my-requests`, { timeout: 15000 });
  assert.equal(createCalls, 1, "a double submit must not create two requests");

  // --- Failed submission keeps what was typed and explains the failure. ---
  createDelay = 0; createStatus = 500; createCalls = 0;
  await page.goto(`${web}/workspace/requests/new`);
  await page.getByLabel("Request title *").fill("Replacement probes");
  await page.getByLabel("What do you need? *").fill("Two spare probes for the teaching bench.");
  await page.getByRole("button", { name: /Submit request/ }).click();
  await page.getByRole("alert").waitFor({ timeout: 10000 });
  await shot("member-save-error");
  assert.equal(await page.getByLabel("Request title *").inputValue(), "Replacement probes",
    "the typed title must survive a failed save");
  assert.equal(await page.getByLabel("What do you need? *").inputValue(), "Two spare probes for the teaching bench.",
    "the typed description must survive a failed save");
  assert.equal(await page.getByRole("button", { name: /Submit request/ }).isDisabled(), false,
    "the submit button must be usable again after a failure");
});

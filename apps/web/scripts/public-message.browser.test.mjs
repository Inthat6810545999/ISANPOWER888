import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

// Isolated HTTP fixture: never opens a database or uses real accounts/tokens.
// Exercises the real Next Server Actions and browser UI, with controlled API errors.
test("Manager public-message browser flow and error boundaries", { timeout: 240000 }, async t => {
  const web = "http://127.0.0.1:3101";
  const api = "http://127.0.0.1:4101";
  const evidence = new URL("../../../docs/development/evidence/visitor-message/", import.meta.url);
  await mkdir(evidence, { recursive: true });
  let record = {
    id: "message-fixture", title: "Visitor message fixture", description: "Synthetic browser test",
    type: "visitor", source: "visitor", status: "closed", approvalStatus: "approved", requiresApproval: true,
    priority: "low", location: "Lab", requesterEmail: "", assigneeEmail: null, neededBy: null,
    createdAt: "2026-10-23T15:00:00Z", updatedAt: "2026-10-23T15:00:00Z",
    publicMessage: "Original public message", publicMessageUpdatedById: null,
    publicMessageUpdatedByName: null, publicMessageUpdatedByEmail: null, publicMessageUpdatedAt: null,
    visit: null, decision: { id: "decision", outcome: "approved", reason: "INTERNAL_ONLY_REASON",
      reviewerName: "Internal reviewer", reviewerEmail: "private@example.test", reviewedAt: "2026-10-23T15:00:00Z" }, decisionHistory: [],
  };
  let responseStatus = 200, authStatus = 200, role = "lab_manager", patches = 0, reads = 0, delay = 0;
  let conflictIneligible = false;
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", web); res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.url === "/api/auth/me") return send(authStatus, { user: { id: "synthetic-manager", name: "Test Manager", email: "manager@example.test", role, membershipStatus: "APPROVED" } });
    if (req.url === "/api/requests" && req.method === "GET") return send(200, { data: [record] });
    if (req.url === "/api/requests/message-fixture" && req.method === "GET") { reads++; return send(200, { data: record }); }
    if (req.url === "/api/requests/message-fixture/public-message") {
      patches++;
      assert.equal(req.headers.authorization, "Bearer synthetic-browser-session");
      let raw = ""; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); assert.deepEqual(Object.keys(body), ["publicMessage"]);
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (responseStatus !== 200) {
        if (responseStatus === 409 && conflictIneligible) record = { ...record, approvalStatus: "submitted" };
        return send(responseStatus, { error: "Synthetic API error" });
      }
      record = { ...record, publicMessage: body.publicMessage.trim(), publicMessageUpdatedById: "synthetic-manager",
        publicMessageUpdatedByName: "Test Manager", publicMessageUpdatedByEmail: "manager@example.test", publicMessageUpdatedAt: "2026-10-24T01:02:03Z" };
      return send(200, { data: record });
    }
    if (req.url === "/api/visits/track") return send(200, { data: { status: record.status,
      approvalStatus: record.approvalStatus, publicMessage: record.publicMessage, visitDate: "2099-12-01", timeSlot: "morning" } });
    send(404, { error: "Not found" });
  });
  await new Promise(resolve => server.listen(4101, "127.0.0.1", resolve));
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3101"], {
    env: { ...process.env, API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, NEXT_DIST_DIR: "build/message-browser" }, stdio: "ignore",
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
    try { if ((await fetch(`${web}/login`)).ok) break; } catch { /* wait for isolated dev server */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: "isanpower_session", value: "synthetic-browser-session", url: web, httpOnly: true }]);
  const page = await context.newPage();
  const dialog = page.getByRole("dialog");
  const draft = dialog.getByRole("textbox", { name: "Public message to Visitor" });
  const save = dialog.getByRole("button", { name: "Save message", exact: true });
  async function settled() {
    for (let i = 0; i < 200 && await save.isDisabled(); i++) await page.waitForTimeout(50);
    assert.equal(await save.isDisabled(), false, await dialog.innerText());
  }
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true });
  async function open() {
    await page.goto(`${web}/manager/approvals`);
    await page.getByRole("button", { name: /^All requests/ }).click();
    await page.getByRole("button", { name: "Public message", exact: true }).click();
  }
  async function edit() { await dialog.getByRole("button", { name: "Edit public message" }).click(); }
  await open();
  assert.match(await dialog.innerText(), /Last edited by: Not recorded/);
  await edit(); assert.equal(await draft.inputValue(), "Original public message");
  await draft.fill("Cancelled draft"); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await shot("cancel"); await edit(); assert.equal(await draft.inputValue(), "Original public message"); assert.equal(patches, 0);
  await draft.fill("x".repeat(2001)); assert.equal(await save.isDisabled(), true);
  await draft.fill("  Latest <b>plain text</b>  "); delay = 500;
  await draft.locator("..").locator("..").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  assert.equal(await dialog.getByRole("button", { name: "Saving / loading…" }).isDisabled(), true);
  assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  await dialog.getByText("Public message saved.", { exact: false }).waitFor();
  assert.equal(patches, 1); assert.equal(record.publicMessage, "Latest <b>plain text</b>");
  assert.equal(await dialog.locator("b").count(), 0); assert.match(await dialog.innerText(), /Test Manager/);
  await shot("saved"); delay = 0;
  const visitor = await context.newPage();
  await visitor.goto(`${web}/visit/track`); await visitor.getByLabel("Tracking code", { exact: true }).fill("synthetic-code");
  await visitor.getByRole("button", { name: "Find my request" }).click();
  await visitor.getByText("Latest <b>plain text</b>", { exact: true }).waitFor();
  const visible = await visitor.locator("body").innerText();
  for (const privateText of ["Test Manager", "INTERNAL_ONLY_REASON", "private@example.test", "Last edited"]) assert.equal(visible.includes(privateText), false);
  await visitor.screenshot({ path: fileURLToPath(new URL("visitor-latest.png", evidence)), fullPage: true });
  await edit(); await draft.fill("   "); await save.click();
  await dialog.getByText("No public message.", { exact: true }).waitFor(); assert.equal(record.publicMessage, ""); await shot("cleared");
  await visitor.getByRole("button", { name: "Find my request" }).click();
  await visitor.getByRole("region", { name: "Visit request result" }).waitFor();
  assert.equal(await visitor.getByText("Latest <b>plain text</b>", { exact: true }).count(), 0);
  await edit(); await draft.fill("Draft survives failures");
  console.log("Checking API error responses");
  for (const status of [500, 400, 401, 403, 404, 413]) {
    responseStatus = status; await save.click(); await dialog.getByRole("alert").waitFor();
    await settled();
    assert.equal(await draft.inputValue(), "Draft survives failures");
    if (status === 500) {
      await shot("save-error"); responseStatus = 200; await save.click();
      await dialog.getByText(/Public message saved/).waitFor();
      assert.equal(record.publicMessage, "Draft survives failures"); await edit();
    }
  }
  const beforeAuth = patches;
  console.log("Checking expired session and changed role");
  responseStatus = 200; authStatus = 401; await save.click();
  await dialog.getByText(/Your session has expired/).waitFor(); assert.equal(patches, beforeAuth);
  authStatus = 200; role = "ta"; await save.click();
  await dialog.getByText(/Your current role or membership/).waitFor(); assert.equal(patches, beforeAuth);
  role = "lab_manager"; responseStatus = 409; const before409 = patches;
  console.log("Checking 409 reload");
  await save.click(); await dialog.getByText(/no longer eligible for message editing/).waitFor();
  await save.waitFor({ state: "visible" });
  await settled();
  assert.equal(reads, 1); assert.equal(patches, before409 + 1); assert.equal(await draft.inputValue(), "Draft survives failures");
  conflictIneligible = true; await save.click(); await dialog.getByText(/You can copy your draft/).waitFor();
  assert.equal(await save.isDisabled(), true); assert.equal(await draft.inputValue(), "Draft survives failures");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  responseStatus = 200;
  console.log("Checking all work states and ineligible requests");
  for (const approvalStatus of ["approved", "rejected"]) {
    for (const status of ["pending", "assigned", "in_progress", "closed", "cancelled"]) {
      record = { ...record, approvalStatus, status }; await open(); await edit();
      await draft.fill(`${approvalStatus} ${status}`); await save.click(); await dialog.getByText(/Public message saved/).waitFor();
      await dialog.getByRole("button", { name: "Close dialog" }).click();
    }
  }
  for (const [source, approvalStatus] of [["member", "approved"], ["visitor", "submitted"], ["visitor", "under_review"], ["visitor", "cancelled"], ["visitor", "not_required"]]) {
    record = { ...record, source, approvalStatus };
    await page.goto(`${web}/manager/approvals`); await page.getByRole("button", { name: /^All requests/ }).click();
    await page.getByRole("button", { name: record.title, exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Public message", exact: true }).count(), 0);
  }
  assert.equal(await page.evaluate(() => document.cookie.includes("synthetic-browser-session")), false);
});

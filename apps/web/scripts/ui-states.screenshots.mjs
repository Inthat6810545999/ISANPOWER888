import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Captures the status badge, refresh and form-validation states for review.
// Request data comes from Next Server Actions, which call the API from the Next
// server, so page.route cannot see those calls. A synthetic API on localhost
// answers them instead (no database, no real accounts), and page.route aborts
// any browser request that tries to leave localhost.
const web = "http://127.0.0.1:3103";
const api = "http://127.0.0.1:4103";
const output = new URL("../screenshots/", import.meta.url);
await mkdir(output, { recursive: true });

const base = {
  description: "Synthetic request for screenshots", type: "equipment", source: "member", requiresApproval: true,
  priority: "medium", location: "Lab B2", requesterEmail: "member@isanpower.test", assigneeEmail: null,
  neededBy: null, updatedAt: "2026-11-01T09:00:00Z", publicMessage: "", visit: null, decision: null, decisionHistory: [],
};
// One row per page of six covers every work status and every displayed approval status.
const requests = [
  { id: "REQ-106", title: "Calibrate the oscilloscope", status: "pending", approvalStatus: "submitted", priority: "high", neededBy: "2026-11-20T00:00:00Z" },
  { id: "REQ-105", title: "Order replacement sensors", status: "pending", approvalStatus: "rejected", type: "consumable" },
  { id: "REQ-104", title: "Book the 3D printer", status: "assigned", approvalStatus: "approved", type: "space", assigneeEmail: "ta@isanpower.test" },
  { id: "REQ-103", title: "Extend clean-room access", status: "in_progress", approvalStatus: "under_review", type: "access", assigneeEmail: "ta2@isanpower.test" },
  { id: "REQ-102", title: "Fix soldering station", status: "closed", approvalStatus: "approved", priority: "low", assigneeEmail: "ta@isanpower.test" },
  { id: "REQ-101", title: "Borrow a logic analyzer", status: "cancelled", approvalStatus: "cancelled", type: "general" },
].map((request, index) => ({ ...base, ...request, createdAt: `2026-11-0${6 - index}T09:00:00Z` }));

let listData = requests, listStatus = 200, listDelay = 0;
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
  if (req.url === "/api/auth/me") {
    return send(200, { user: { id: "synthetic-member", name: "Theewasu A.", email: "member@isanpower.test", role: "member", membershipStatus: "APPROVED" } });
  }
  if (req.url === "/api/requests" && req.method === "GET") {
    if (listDelay) await new Promise((resolve) => setTimeout(resolve, listDelay));
    if (listStatus !== 200) return send(listStatus, { error: "The lab workspace is unavailable." });
    return send(200, { data: listData });
  }
  send(404, { error: "Not found" });
});
await new Promise((resolve) => server.listen(4103, "127.0.0.1", resolve));

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3103"], {
  env: { ...process.env, API_BASE_URL: api, NEXT_PUBLIC_API_BASE_URL: api, APP_BASE_URL: web, NEXT_DIST_DIR: "build/ui-states" },
  stdio: "ignore",
});
let browser;
try {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${web}/login`)).ok) break; } catch { /* wait for the isolated dev server */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const blocked = [];
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });
  await context.addCookies([{ name: "isanpower_session", value: "synthetic-browser-session", url: web, httpOnly: true }]);
  const page = await context.newPage();
  // The dev-mode "Rendering…" indicator is not part of the app; hide it in captures only.
  const shot = async (name) => {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true });
  };

  // 1. Every status as a badge.
  await page.goto(`${web}/workspace/my-requests`);
  await page.getByText("Borrow a logic analyzer").waitFor({ timeout: 60000 });
  await shot("01-status-badges");

  // 2. Manual refresh in progress.
  const refresh = page.getByRole("button", { name: /Refresh requests|Refreshing/ });
  listDelay = 4000;
  await refresh.click();
  await page.getByTestId("refresh-spinner").waitFor();
  assert.equal(await refresh.isDisabled(), true, "refresh button must be disabled while loading");
  await shot("02-refresh-loading");
  await page.getByTestId("refresh-spinner").waitFor({ state: "detached", timeout: 15000 });
  listDelay = 0;

  // 3. Refresh returned no requests.
  listData = [];
  await refresh.click();
  await page.getByRole("heading", { name: "No requests yet" }).waitFor({ timeout: 15000 });
  await shot("03-empty-state");

  // 4. Refresh failed.
  listStatus = 503;
  await refresh.click();
  await page.getByRole("heading", { name: "We could not load your requests" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Try again" }).waitFor();
  await shot("04-error-state");
  listStatus = 200; listData = requests;

  // 5. Request form with validation errors.
  await page.goto(`${web}/workspace/requests/new`);
  const title = page.getByRole("textbox", { name: "Request title *" });
  await title.fill("x");
  await title.fill("");
  const description = page.getByRole("textbox", { name: "What do you need? *" });
  await description.focus();
  await description.blur();
  await page.getByLabel(/Needed by/).fill("2026-01-15");
  await page.getByLabel(/Needed by/).blur();
  await page.getByText("Choose today or a future date (Thailand time).").waitFor();
  assert.equal(await page.getByRole("button", { name: /Submit request/ }).isDisabled(), true, "submit must stay disabled while invalid");
  await shot("05-form-validation");

  assert.deepEqual(blocked, [], "no browser request may leave localhost");
  console.log(`Saved 5 screenshots to ${fileURLToPath(output)}`);
} finally {
  await browser?.close();
  if (process.platform === "win32") await new Promise((resolve) => spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", resolve));
  else next.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

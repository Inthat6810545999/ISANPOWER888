import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

// Start the API against the dedicated _test DB and Next with the public API URL.
const web = process.env.TRACK_TEST_WEB_URL ?? "http://localhost:3100";
const api = process.env.TRACK_TEST_API_URL ?? "http://localhost:4100";
const endpoint = `${api}/api/visits/track`;
// Optional explicit origins for the development-alias acceptance run.
const liveOrigins = (process.env.TRACK_TEST_ORIGINS ?? web).split(",");
const code = "Ab".repeat(21) + "A"; // Synthetic browser fixture, not a real credential.
const data = { status: "pending", approvalStatus: "rejected", publicMessage: "", visitDate: "2099-12-01", timeSlot: "morning" };
let browser;
before(async () => {
  // Fail before creating any credentials if the page server is not available.
  for (const origin of new Set([web, ...liveOrigins])) {
    const response = await fetch(`${origin}/visit/track`);
    assert.equal(response.status, 200, "Tracking page must be ready before browser tests");
  }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true });
});
after(async () => { await browser?.close(); });
async function pageFor(t, viewport) {
  const context = await browser.newContext({ viewport, timezoneId: "America/Los_Angeles" });
  t.after(() => context.close());
  return context.newPage();
}
async function found(page) { await page.getByRole("region", { name: "Visit request result" }).waitFor(); }
async function mock(page, body = { data }, status = 200, headers = {}) {
  let calls = 0;
  await page.route(endpoint, async route => { calls++; await route.fulfill({ status, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": web, "Access-Control-Expose-Headers": "Retry-After", ...headers }, body: JSON.stringify(body) }); });
  return () => calls;
}

test("real API: malformed and unknown codes show the same not-found message through actual CORS", async t => {
  const page = await pageFor(t);
  // Read a clone in the browser: the UI consumes only the 404 status, and Chrome
  // can discard an unread no-store response before DevTools retrieves its body.
  await page.addInitScript(() => {
    window.__trackingErrorResponses = [];
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (new URL(response.url).pathname === "/api/visits/track") {
        window.__trackingErrorResponses.push(await response.clone().json());
      }
      return response;
    };
  });
  const failures = [];
  page.on("requestfailed", request => {
    if (request.url() === endpoint) failures.push(request.failure()?.errorText);
  });
  await page.goto(`${web}/visit/track`);
  const expectedMessage = "We could not find that visit request. Check your tracking code and try again.";
  for (const value of ["โค้ดผิดรูปแบบ", "Z".repeat(43)]) {
    await page.getByLabel("Tracking code", { exact: true }).fill(value);
    const received = page.waitForResponse(response => response.url() === endpoint && response.request().method() === "POST");
    await page.getByRole("button", { name: "Find my request" }).click();
    const response = await received;
    assert.equal(response.status(), 404);
    assert.equal(response.headers()["access-control-allow-origin"], new URL(web).origin);
    assert.equal(response.headers()["cache-control"], "no-store");
    await page.getByRole("status").getByText(expectedMessage, { exact: true }).waitFor();
  }
  assert.deepEqual(await page.evaluate(() => window.__trackingErrorResponses), [
    { error: "Visit request not found." }, { error: "Visit request not found." },
  ]);
  assert.deepEqual(failures, []);
});

for (const liveWeb of liveOrigins) test(`real API + database: ${liveWeb} auto-tracks a persisted code once without credentials`, async t => {
  const response = await fetch(`${api}/api/visits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    contactName: "Browser fixture", email: "browser@example.test", purpose: "tour", details: "Browser integration", visitDate: "2099-12-01", timeSlot: "afternoon", visitorCount: 1,
  }) });
  assert.equal(response.status, 201);
  const { trackingCode } = (await response.json()).data;
  const page = await pageFor(t);
  await page.context().addCookies([{ name: "session", value: "must-not-be-forwarded", url: api }]);
  let calls = 0;
  await page.route(endpoint, async route => {
    calls++;
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(route.request().url(), endpoint);
    assert.equal(route.request().headers().cookie, undefined);
    assert.equal(route.request().headers().referer, undefined);
    await route.continue();
  });
  const navigation = await page.goto(`${liveWeb}/visit/track#code=${encodeURIComponent(trackingCode)}`)
    .catch(() => { throw new Error("Live tracking-page navigation failed (credential redacted)."); });
  assert.equal(navigation.status(), 200);
  assert.equal(navigation.headers()["referrer-policy"], "no-referrer");
  await found(page);
  assert.equal(await page.getByText("Awaiting review", { exact: true }).count(), 1);
  assert.equal(await page.getByText("13:00–16:00 · Thailand time (Asia/Bangkok)", { exact: true }).count(), 1);
  await page.waitForTimeout(300);
  assert.equal(calls, 1);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
});

test("fragment replay is guarded; pending rejection and HTML-like public message stay public text", async t => {
  const page = await pageFor(t);
  const message = '<img src=x onerror="alert(1)"> Message from the lab';
  const calls = await mock(page, { data: { ...data, publicMessage: message } });
  await page.goto(`${web}/visit/track#code=${code}`);
  await found(page);
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.getByRole("heading", { name: "Request declined" }).count(), 1);
  assert.equal(await page.getByText("Awaiting processing", { exact: true }).count(), 1);
  assert.equal(await page.getByText(message, { exact: true }).count(), 1);
  assert.equal(await page.locator('[aria-label="Visit request result"] img').count(), 0);
  await page.waitForTimeout(300);
  assert.equal(calls(), 1);
  assert.equal(await page.getByLabel("Tracking code", { exact: true }).isEditable(), true);
});

test("keyboard submit trims only outer whitespace, omits credentials and prevents concurrent Enter", async t => {
  const page = await pageFor(t);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  let calls = 0;
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (...args) => {
      window.__trackingOptions = { credentials: args[1]?.credentials, cache: args[1]?.cache };
      return original(...args);
    };
  });
  await page.route(endpoint, async route => {
    calls++;
    assert.deepEqual(route.request().postDataJSON(), { code });
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto(`${web}/visit/track`);
  const input = page.getByLabel("Tracking code", { exact: true });
  await input.fill(`  ${code}  `);
  await input.press("Enter");
  await page.getByText("Searching for your visit request…", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Searching…" }).isDisabled(), true);
  await input.press("Enter");
  release();
  await found(page);
  assert.equal(calls, 1);
  assert.deepEqual(await page.evaluate(() => window.__trackingOptions), { credentials: "omit", cache: "no-store" });
  assert.equal(await page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]').count(), 1);
});

for (const [status, message] of [
  [404, "We could not find that visit request."],
  [429, "Too many attempts. Please wait 37 seconds"],
  [503, "Visit tracking is temporarily unavailable."],
]) {
  test(`${status} has understandable error announcement and no automatic retry`, async t => {
    const page = await pageFor(t);
    const calls = await mock(page, { error: "INTERNAL_DETAILS_MUST_NOT_RENDER" }, status, { "Retry-After": "37" });
    await page.goto(`${web}/visit/track`);
    await page.getByLabel("Tracking code", { exact: true }).fill("bad");
    await page.getByRole("button", { name: "Find my request" }).click();
    await page.getByRole("status").getByText(message, { exact: false }).waitFor();
    assert.equal(await page.getByText("INTERNAL_DETAILS_MUST_NOT_RENDER").count(), 0);
    await page.waitForTimeout(300);
    assert.equal(calls(), 1);
    assert.equal(await page.getByRole("button", { name: "Find my request" }).isEnabled(), true);
  });
}

test("network failure and malformed success fail unavailable without retry", async t => {
  const page = await pageFor(t);
  let calls = 0;
  await page.route(endpoint, route => { calls++; return route.abort("failed"); });
  await page.goto(`${web}/visit/track#code=${code}`);
  await page.getByText("Visit tracking is temporarily unavailable. Please try again later.", { exact: true }).waitFor();
  await page.waitForTimeout(300);
  assert.equal(calls, 1);
  await page.unroute(endpoint);
  await mock(page, { data: { ...data, status: "invented" } });
  await page.getByRole("button", { name: "Find my request" }).click();
  await page.getByText("Visit tracking is temporarily unavailable. Please try again later.", { exact: true }).waitFor();
});

test("keyboard focus, mobile widths, requested-date wording and missing message", async t => {
  const page = await pageFor(t, { width: 320, height: 800 });
  await mock(page, { data: { ...data, approvalStatus: "approved", status: "closed", publicMessage: null } });
  await page.goto(`${web}/visit/track`);
  await page.getByRole("link", { name: "Back to Open House", exact: false }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.getByLabel("Tracking code", { exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.type(code);
  await page.keyboard.press("Tab");
  assert.equal(await page.getByRole("button", { name: "Find my request" }).evaluate(el => el === document.activeElement), true);
  assert.notEqual(await page.getByRole("button", { name: "Find my request" }).evaluate(el => getComputedStyle(el).outlineStyle), "none");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.getByLabel("Tracking code", { exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await found(page);
  assert.equal(await page.getByText("Message from the lab", { exact: true }).count(), 0);
  assert.equal(await page.getByText("1 December 2099", { exact: true }).count(), 1);
  // Approved fixture: the note must not read as a refusal, and must not promise a booking.
  assert.equal(await page.getByText("The lab has accepted your request. This is still the date and time you asked for — the lab will contact you to confirm the exact time.", { exact: true }).count(), 1);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }
  await page.screenshot({ path: "../../tmp/visitor-track-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "../../tmp/visitor-track-desktop.png", fullPage: true });
  await page.unroute(endpoint);
  const longMessage = "LongMessage".repeat(180);
  await mock(page, { data: { ...data, publicMessage: longMessage } });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "Find my request" }).click();
  await page.getByText(longMessage, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
});

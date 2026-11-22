// Exercise the README native setup on a disposable Windows runner.
// Upload startup logs only, never environment files or demo credentials.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'win32', 'This check targets real Windows');
const root = fileURLToPath(new URL('../../', import.meta.url));
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = webRequire('playwright');
await mkdir(new URL('../test-output/', import.meta.url), { recursive: true });
const children = [];
const logs = [];
let browser;
function start(name, cwd, command) {
  const log = createWriteStream(new URL(`../test-output/${name}.log`, import.meta.url));
  logs.push(log);
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    cwd: `${root}apps/${cwd}`, env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  children.push(child);
  return child;
}
async function waitFor(url, child, verify = () => true) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before ${url}: ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (response.ok && await verify(response)) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Server not ready: ${url}; inspect startup artifacts`);
}
try {
  const api = start('api', 'api', 'npm.cmd run dev');
  await waitFor('http://127.0.0.1:4000/api/health', api, async response => {
    const health = await response.json();
    return health.status === 'ok' && health.database === 'connected';
  });
  console.log('PASS: README API dev command and database health');
  const web = start('web', 'web', 'npm.cmd run dev -- --hostname 127.0.0.1 --port 3000');
  await waitFor('http://127.0.0.1:3000/login', web);
  const credentials = JSON.parse(await readFile(new URL('../../apps/api/.demo-accounts.json', import.meta.url), 'utf8'));
  const accounts = [
    ['member@isanpower.test', '/workspace/my-requests', 'member'],
    ['ta@isanpower.test', '/ta/queue', 'ta'],
    ['manager@isanpower.test', '/manager/approvals', 'lab_manager'],
  ];
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [email, path, role] of accounts) {
    const account = credentials.find(item => item.email === email);
    assert.ok(account, `Seed account missing: ${role}`);
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);
    await page.goto('http://127.0.0.1:3000/login');
    await page.getByText('Local demo account', { exact: true }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`http://127.0.0.1:3000${path}`, { timeout: 120_000 });
    assert.equal(new URL(page.url()).pathname, path);
    const response = await fetch('http://127.0.0.1:4000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: account.password }),
    });
    assert.equal(response.status, 200, `${role} API login`);
    assert.equal((await response.json()).user.role, role);
    console.log(`PASS: ${role} seeded password, browser login, and ${path}`);
    await context.close();
  }
  const home = await fetch('http://127.0.0.1:3000/');
  assert.equal(home.status, 200);
  console.log('PASS: README homepage and all three role redirects');
} finally {
  await browser?.close();
  for (const child of children.reverse()) {
    if (child.pid && child.exitCode === null) {
      await new Promise(resolve => {
        const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        stop.once('exit', resolve); stop.once('error', resolve);
      });
    }
  }
  for (const log of logs) log.end();
}

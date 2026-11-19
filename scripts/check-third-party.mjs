#!/usr/bin/env node
// scripts/check-third-party.mjs
//
// XPAI-228: the public intake pages must load nothing from third-party sites.
// This check fails (exit 1) when they do, so it can run in CI and block a
// merge. Two parts:
//
//   1. Static: the built index.html and every built stylesheet reference no
//      external URL (no CDN script, web font, stylesheet or tracker).
//   2. Runtime: a headless Chrome opens each intake page of a tenant, ticks
//      "Before you report" and continues, and records every request. Any host
//      other than our own origin and the allowed API hosts is a failure. It
//      also lists what the pages store in cookies, localStorage and
//      sessionStorage, and fails on anything outside the known keys.
//
// With --csp it also serves the pages with the Content-Security-Policy we ask
// the edge to send (docs/backend-requests/edge-security-headers.md) and fails
// on any violation, so the policy can be checked before it is deployed.
//
// Writes to the API are blocked by default, so the check never files a real
// report: the flow stops where the first write would happen (starting the
// report). Pass --allow-writes only against a staging tenant.
//
// Usage (after `npm run build`, with `npx vite preview` serving dist/):
//
//   CHECK_SLUG=acme npm run check:third-party
//   CHECK_SLUG=acme CHECK_ENTITY=insurance npm run check:third-party -- --csp
//
// Environment:
//   CHECK_BASE    the app's address              default http://localhost:4173
//   CHECK_SLUG    the tenant's portal slug       required
//   CHECK_ENTITY  an entity slug of that tenant  optional
//   CHECK_API     allowed API origins, comma separated
//                 default: the origin of VITE_API_URL in .env
//   CHROME_PATH   Chrome or Chromium executable  default /usr/bin/google-chrome
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const WITH_CSP = args.has('--csp');
const ALLOW_WRITES = args.has('--allow-writes');

const envFile = (() => {
  try {
    return Object.fromEntries(
      fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
        .split('\n')
        .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
    );
  } catch {
    return {};
  }
})();

const BASE = (process.env.CHECK_BASE || 'http://localhost:4173').replace(/\/$/, '');
const SLUG = process.env.CHECK_SLUG;
const ENTITY = process.env.CHECK_ENTITY;
const apiOrigins = (process.env.CHECK_API || (envFile.VITE_API_URL ? new URL(envFile.VITE_API_URL).origin : ''))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

if (!SLUG) {
  console.error('Set CHECK_SLUG to a tenant portal slug, e.g. CHECK_SLUG=acme npm run check:third-party');
  process.exit(2);
}

const ALLOWED_HOSTS = new Set([new URL(BASE).host, ...apiOrigins.map((o) => new URL(o).host)]);

// The Content-Security-Policy the edge should send (keep in step with
// docs/backend-requests/edge-security-headers.md). Inline styles stay allowed:
// React style attributes and the pricing pages' <style> blocks need them, and
// styles can't run code.
export const csp = (api) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${api.join(' ')}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${api.join(' ')}`.trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

// What intake pages may keep in the browser: none of it identifies the
// reporter (docs/backend-requests/edge-security-headers.md lists each).
const ALLOWED_STORAGE = {
  local: ['xposer-lang', 'xposer-lang-chosen', 'xposer-theme', /^xposer_[a-z_]+_tour_seen$/],
  session: ['xposer-portal', 'xposer-sso-pending'],
};
const allowed = (list, key) => list.some((k) => (k instanceof RegExp ? k.test(key) : k === key));

const failures = [];

// ── 1. Static ──────────────────────────────────────────────────────────────
const dist = path.join(ROOT, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  failures.push('dist/index.html is missing: run `npm run build` first.');
} else {
  const external = /(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+|@import\s+url\(\s*['"]?(?:https?:)?\/\/[^)'"]+|url\(\s*['"]?(?:https?:)?\/\/[^)'"]+/gi;
  const files = ['index.html', ...fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.css')).map((f) => `assets/${f}`)];
  for (const file of files) {
    const hits = fs.readFileSync(path.join(dist, file), 'utf8').match(external) || [];
    hits.forEach((hit) => failures.push(`static: ${file} references an external URL: ${hit.slice(0, 120)}`));
  }
  console.log(`static: checked ${files.length} files`);
}

// ── 2. Runtime ─────────────────────────────────────────────────────────────
const pages = [
  { path: `/${SLUG}`, name: 'portal home' },
  ENTITY && { path: `/${SLUG}/${ENTITY}`, name: 'entity portal' },
  { path: `/${SLUG}/submit-anonymous`, name: 'report (before you report → continue)', flow: 'report' },
  { path: `/${SLUG}/track-report`, name: 'track a report' },
  { path: `/${SLUG}/report-named`, name: 'report under my name' },
].filter(Boolean);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
if (WITH_CSP) {
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`);
    });
  });
}
const page = await context.newPage();
const policy = csp(apiOrigins);

await page.route('**/*', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const isApi = apiOrigins.some((o) => req.url().startsWith(o));
  if (isApi && !ALLOW_WRITES && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.abort();
  // Serve our own documents with the proposed policy.
  if (WITH_CSP && req.resourceType() === 'document' && url.host === new URL(BASE).host) {
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  }
  return route.continue();
});

for (const target of pages) {
  const hosts = new Map();
  const onRequest = (req) => {
    const url = new URL(req.url());
    if (['data:', 'blob:'].includes(url.protocol)) return;
    if (!ALLOWED_HOSTS.has(url.host)) hosts.set(url.host, req.url());
  };
  page.on('request', onRequest);
  await page.goto(BASE + target.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  if (target.flow === 'report') {
    // Close whatever opens on arrival (other ways to get help, a guided tour),
    // as a reporter would.
    for (let i = 0; i < 4 && (await page.locator('[role="dialog"], [role="alertdialog"]').count()); i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const close = page.locator('[role="dialog"] button[aria-label], [role="alertdialog"] button[aria-label]').first();
      if (await page.locator('[role="dialog"], [role="alertdialog"]').count() && (await close.count())) await close.click().catch(() => {});
    }
    // Tick "Before you report" and continue, as a reporter would.
    const box = page.locator('main input[type="checkbox"]').first();
    if (await box.count()) {
      await box.check();
      await page.locator('main button:not([disabled])').last().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      const heading = (await page.locator('main h1, main h2').first().innerText().catch(() => '')).trim();
      console.log(`         after "Before you report": ${heading || '(no heading)'}${ALLOW_WRITES ? '' : ' (writes blocked: the flow stops at the first write)'}`);
    } else {
      failures.push(`${target.name}: "Before you report" acknowledgement not found`);
    }
  }

  if (WITH_CSP) {
    const violations = await page.evaluate(() => window.__cspViolations.splice(0));
    violations.forEach((v) => failures.push(`csp: ${target.path}: ${v}`));
  }
  page.off('request', onRequest);
  hosts.forEach((url, host) => failures.push(`runtime: ${target.path} contacted ${host} (${url.slice(0, 120)})`));
  console.log(`runtime: ${target.name.padEnd(40)} ${hosts.size ? `${hosts.size} third-party host(s)` : 'ok'}`);
}

// What the pages left in the browser.
const stored = await page.evaluate(() => ({
  local: Object.keys(localStorage),
  session: Object.keys(sessionStorage),
  cookies: document.cookie ? document.cookie.split(';').map((c) => c.split('=')[0].trim()) : [],
}));
stored.local.filter((k) => !allowed(ALLOWED_STORAGE.local, k)).forEach((k) => failures.push(`storage: unexpected localStorage key "${k}"`));
stored.session.filter((k) => !allowed(ALLOWED_STORAGE.session, k)).forEach((k) => failures.push(`storage: unexpected sessionStorage key "${k}"`));
stored.cookies.forEach((k) => failures.push(`storage: unexpected cookie "${k}"`));
console.log(`storage: local [${stored.local.join(', ')}], session [${stored.session.join(', ')}], cookies [${stored.cookies.join(', ')}]`);

await browser.close();

console.log(`allowed hosts: ${[...ALLOWED_HOSTS].join(', ')}${WITH_CSP ? ' | CSP enforced' : ''}${ALLOW_WRITES ? ' | writes allowed' : ' | writes blocked'}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ No third-party requests on the intake pages.');

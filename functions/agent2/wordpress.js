'use strict';

/**
 * WordPress REST API helper for Agent 2 — Function D4: upgrade an ambassador's
 * user role from ambassador_applicant to ambassador_active on compliance
 * completion. This is the gate that makes the referral link visible in the
 * portal (design §6.4, §10) — Email D must never fire before this is confirmed.
 *
 * Uses HTTP Basic Auth with a WordPress application password (never the login
 * password), per design §1.
 */

const https = require('https');
const { URL } = require('url');
const M = require('./manifest');
const { WORDPRESS_ROLES } = M;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch { /* leave as string */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Set a WordPress user's role. Returns { ok, status }. Throws only on a
 * malformed base URL or transport error — HTTP failure statuses are returned,
 * not thrown, so the caller can apply the design's one-retry-then-alert policy.
 */
async function setUserRole(wpUserId, role) {
  const base = M.getEnv('WORDPRESS_API_BASE_URL');
  if (!base) throw new Error('WORDPRESS_API_BASE_URL is not set');
  const user = M.getEnv('WP_ADMIN_USER');
  const pass = M.getEnv('WP_ADMIN_APP_PASSWORD');
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  const url = new URL(`${base.replace(/\/+$/, '')}/wp-json/wp/v2/users/${encodeURIComponent(wpUserId)}`);
  const payload = JSON.stringify({ roles: [role] });
  const res = await request({
    hostname: url.hostname,
    path: url.pathname + url.search,
    port: url.port || 443,
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, body: res.body };
}

/**
 * Function D4 — upgrade to ambassador_active, with the design's single retry
 * after 60 seconds on failure. Returns { ok, status, attempts }. Never throws.
 */
async function upgradeToActive(wpUserId, { retryDelayMs = 60000 } = {}) {
  if (!wpUserId) return { ok: false, status: 0, attempts: 0, error: 'no WordPress_User_ID on record' };
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await setUserRole(wpUserId, WORDPRESS_ROLES.active);
      if (res.ok) return { ok: true, status: res.status, attempts: attempt };
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err.message;
    }
    if (attempt === 1 && retryDelayMs > 0) await wait(retryDelayMs);
  }
  return { ok: false, status: 0, attempts: 2, error: last };
}

module.exports = { setUserRole, upgradeToActive };

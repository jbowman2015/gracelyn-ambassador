'use strict';

/**
 * Zoho Analytics helper — best-effort. HARD STOP #2 (coordinator dashboard
 * built + accessible via API) was not confirmed as of this session, so this
 * is deliberately minimal: when the workspace/credentials aren't configured,
 * `writeSummary` returns { ok: false, reason: 'not configured' } rather than
 * throwing, and callers fall back to the design's own §8 failure-table
 * recipe (email the coordinator the data directly as text; the checkpoint
 * and weekly report jobs already do this unconditionally, so no data is lost
 * either way).
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const ANALYTICS_HOST = process.env.ZOHO_ANALYTICS_API_HOST || 'analyticsapi.zoho.com';

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

let _token = null;
async function getAnalyticsToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_ANALYTICS_CLIENT_ID,
    client_secret: process.env.ZOHO_ANALYTICS_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_ANALYTICS_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Analytics token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

function isConfigured() {
  return !!(process.env.ZOHO_ANALYTICS_CLIENT_ID && process.env.ZOHO_ANALYTICS_REFRESH_TOKEN && M.getEnv('ZOHO_ANALYTICS_WORKSPACE_ID'));
}

/**
 * Write a JSON summary row to the coordinator dashboard workspace. Never
 * throws — returns { ok, reason? }. `deps.request`/`deps.getAnalyticsToken`
 * are injectable for tests.
 */
async function writeSummary(summary, { deps = {} } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not configured (HARD STOP #2 — dashboard not yet confirmed)' };
  try {
    const doRequest = deps.request || request;
    const token = deps.getAnalyticsToken ? await deps.getAnalyticsToken() : await getAnalyticsToken();
    const workspaceId = M.getEnv('ZOHO_ANALYTICS_WORKSPACE_ID');
    const payload = JSON.stringify(summary);
    const res = await doRequest({
      hostname: ANALYTICS_HOST,
      path: `/restapi/v2/workspaces/${encodeURIComponent(workspaceId)}/data`,
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);
    const ok = res.status >= 200 && res.status < 300;
    return { ok, reason: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { getAnalyticsToken, resetToken, isConfigured, writeSummary };

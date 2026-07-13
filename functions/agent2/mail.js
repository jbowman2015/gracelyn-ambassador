'use strict';

/**
 * Zoho Mail client for Agent 2 — sends every onboarding/compliance email
 * (A, B, B-VIP, C x3, C-WinBack + 4 response paths, D, D-VIP) from
 * ambassadors@gracelyn.edu (design §1, §6).
 *
 * No SDK dependency: raw https to the Zoho Mail REST API
 * (POST /api/accounts/{accountId}/messages). ZOHO_MAIL_ACCOUNT_ID is not in the
 * design doc's env-var table but is required by this endpoint — see manifest.js.
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const MAIL_HOST = process.env.ZOHO_MAIL_API_HOST || 'mail.zoho.com';
const DEFAULT_FROM = 'ambassadors@gracelyn.edu';

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
async function getMailToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_MAIL_CLIENT_ID,
    client_secret: process.env.ZOHO_MAIL_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_MAIL_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Mail token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

/**
 * Send a plain-text email. Throws on failure so callers apply the design's
 * retry/alert policy explicitly rather than silently swallowing send errors.
 */
async function sendMail({ to, subject, content }) {
  const accountId = M.getEnv('ZOHO_MAIL_ACCOUNT_ID');
  if (!accountId) throw new Error('ZOHO_MAIL_ACCOUNT_ID is not set');
  const fromAddress = M.getEnv('ZOHO_MAIL_FROM_ADDRESS') || DEFAULT_FROM;

  const token = await getMailToken();
  const payload = JSON.stringify({
    fromAddress,
    toAddress: to,
    subject,
    content,
    mailFormat: 'plaintext',
  });
  const res = await request({
    hostname: MAIL_HOST,
    path: `/api/accounts/${encodeURIComponent(accountId)}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  const ok = res.status >= 200 && res.status < 300;
  if (!ok) {
    throw new Error(`Zoho Mail send failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return { ok: true, to, subject };
}

module.exports = { getMailToken, resetToken, sendMail };

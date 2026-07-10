'use strict';

/**
 * Zoho Mail direct-send fallback (design §7): "Spend alert email fails to
 * send... if second failure: send fallback email directly from Catalyst using
 * AMBASSADOR_MAIL_ACCOUNT_ID credentials." Used ONLY as the last resort when
 * the Make.com spend-alert webhook has failed twice — the spend data must
 * reach the coordinator somehow.
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const MAIL_HOST = process.env.ZOHO_MAIL_API_HOST || 'mail.zoho.com';

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
    client_id: M.getEnv('ZOHO_MAIL_CLIENT_ID'),
    client_secret: M.getEnv('ZOHO_MAIL_CLIENT_SECRET'),
    refresh_token: M.getEnv('ZOHO_MAIL_REFRESH_TOKEN'),
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Zoho Mail token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}
function resetToken() { _token = null; }

/** Send a plain-text email via the Zoho Mail API. Throws on failure (caller logs, does not retry further). */
async function sendMail({ to, subject, content }) {
  const accountId = M.getEnv('AMBASSADOR_MAIL_ACCOUNT_ID');
  if (!accountId) throw new Error('AMBASSADOR_MAIL_ACCOUNT_ID is not set — cannot send fallback email.');
  const token = await getMailToken();
  const payload = JSON.stringify({ toAddress: to, subject, content, mailFormat: 'plaintext' });
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
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Zoho Mail send failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return { ok: true };
}

module.exports = { getMailToken, resetToken, sendMail };

'use strict';

/**
 * Zoho Mail helper for Agent 3 — every sprint and standard-cycle email sends
 * from ambassadors@gracelyn.edu (design doc §1) via the Zoho Mail API.
 *
 * OAuth uses the ZOHO_MAIL trio (separate token cache from zoho.js's CRM
 * token). Account id is resolved once and cached; all calls are injectable
 * for offline tests.
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

let _accountId = null;
async function getAccountId() {
  if (_accountId) return _accountId;
  const token = await getMailToken();
  const res = await request({
    hostname: MAIL_HOST,
    path: '/api/accounts',
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const accounts = res.body && res.body.data;
  if (!Array.isArray(accounts) || !accounts.length) {
    throw new Error(`Mail accounts lookup failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  const fromAddr = M.getEnv('AMBASSADOR_MAIL_FROM_ADDRESS') || DEFAULT_FROM;
  const match = accounts.find((a) => (a.mailboxAddress || a.emailAddress || '').toLowerCase() === fromAddr.toLowerCase());
  _accountId = (match || accounts[0]).accountId;
  return _accountId;
}

function resetAccountId() { _accountId = null; }

/**
 * Send an email. Returns { ok, status, error }. Never throws — the caller
 * applies the design's retry-once-then-alert policy (§10).
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const token = await getMailToken();
    const accountId = await getAccountId();
    const fromAddr = M.getEnv('AMBASSADOR_MAIL_FROM_ADDRESS') || DEFAULT_FROM;
    const payload = JSON.stringify({
      fromAddress: fromAddr,
      toAddress: to,
      subject,
      content: html || text || '',
      mailFormat: html ? 'html' : 'plaintext',
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
    return { ok, status: res.status, error: ok ? null : JSON.stringify(res.body).slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

module.exports = { getMailToken, resetToken, getAccountId, resetAccountId, sendEmail, DEFAULT_FROM };

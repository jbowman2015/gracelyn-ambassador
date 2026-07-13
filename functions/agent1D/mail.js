'use strict';

/**
 * Zoho Mail send (design §4 Step 7). Plain text only — mailFormat must be
 * 'text'. Same OAuth trio + send shape as functions/agent1A/mail.js.
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const MAIL_API_HOST = process.env.ZOHO_MAIL_API_HOST || 'mail.zoho.com';

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

/** Pure — builds the Zoho Mail send payload, used by both the real send and tests. */
function buildMailPayload(fromAddr, toAddr, subject, content) {
  return { fromAddress: fromAddr, toAddress: toAddr, subject, content, mailFormat: 'text' };
}

async function sendMail(toAddress, subject, body) {
  const token = await getMailToken();
  const accountId = process.env.AMBASSADOR_MAIL_ACCOUNT_ID;
  const fromAddr = process.env.AMBASSADOR_MAIL_FROM_ADDRESS;
  const payload = JSON.stringify(buildMailPayload(fromAddr, toAddress, subject, body));
  const res = await request({
    hostname: MAIL_API_HOST,
    path: `/api/accounts/${accountId}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  if (!res.body || !res.body.status || res.body.status.code !== 200) {
    throw new Error(`Mail send failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

module.exports = { getMailToken, resetToken, buildMailPayload, sendMail };

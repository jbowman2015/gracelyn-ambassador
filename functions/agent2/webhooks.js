'use strict';

/**
 * Make.com webhook delivery for Agent 2 (design §8). Same one-retry policy as
 * functions/agent0/webhooks.js. Returns a result object rather than throwing so
 * callers can apply the design's §10 per-scenario fallback.
 */

const https = require('https');
const { URL } = require('url');

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlString); } catch (err) { return reject(new Error(`Invalid webhook URL: ${err.message}`)); }
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      port: url.port || 443,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fire a webhook with a single retry after `retryDelayMs` on non-200 / error.
 * Returns { ok, status, attempts, error }. Never throws.
 */
async function fireWebhook(url, payload, { retryDelayMs = 0, deps = {} } = {}) {
  const post = deps.postJson || postJson;
  if (!url) return { ok: false, status: 0, attempts: 0, error: 'webhook URL not configured' };
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await post(url, payload);
      if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, attempts: attempt };
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err.message;
    }
    if (attempt === 1 && retryDelayMs > 0) await wait(retryDelayMs);
  }
  return { ok: false, status: 0, attempts: 2, error: last };
}

module.exports = { fireWebhook, postJson };

'use strict';

/**
 * Coordinator run-summary webhook (design doc §4 Step 8, §6.3). Every run
 * POSTs its summary to MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL. Retries once on
 * failure per §7; a second failure is the caller's cue to alert Parmeet with
 * the full summary text (the webhook itself never throws — it reports
 * delivered:false so orchestrate.js can decide what to do).
 */

const https = require('https');
const { withRetryOnce } = require('./retry');
const { wait, RETRY_DELAY_MS } = require('./wait');

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlString); } catch (err) { reject(err); return; }
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
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

async function postRunSummary(summary, waitFn = wait, postJsonFn = postJson) {
  const url = process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL;
  if (!url) return { delivered: false, reason: 'MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL not set' };
  try {
    await withRetryOnce(async () => {
      const res = await postJsonFn(url, summary);
      if (res.status < 200 || res.status >= 300) throw new Error(`webhook returned HTTP ${res.status}`);
      return res;
    }, waitFn, RETRY_DELAY_MS);
    return { delivered: true };
  } catch (err) {
    return { delivered: false, reason: err.message };
  }
}

module.exports = { postJson, postRunSummary };

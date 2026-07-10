'use strict';

/**
 * HeyGen video helper for Agent 3 — milestone recognition videos only (design
 * §1: VIP welcome videos are Agent 2's). Thin submit-and-forget wrapper;
 * never throws, so a HeyGen outage never blocks the milestone email itself.
 */

const https = require('https');
const M = require('./manifest');

const API_HOST = process.env.HEYGEN_API_HOST || 'api.heygen.com';

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

/** Submit a milestone recognition video job. Returns { ok, jobId, error }. */
async function submitMilestoneVideo({ scriptText }) {
  const apiKey = M.getEnv('HEYGEN_API_KEY');
  const templateId = M.getEnv('HEYGEN_TEMPLATE_ID');
  const avatarId = M.getEnv('HEYGEN_FLIPPEN_AVATAR_ID');
  if (!apiKey || !templateId || !avatarId) {
    return { ok: false, jobId: null, error: 'HeyGen credentials not configured' };
  }
  try {
    const payload = JSON.stringify({ template_id: templateId, avatar_id: avatarId, script: scriptText });
    const res = await request({
      hostname: API_HOST,
      path: '/v2/video/generate',
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    const ok = res.status >= 200 && res.status < 300;
    const jobId = res.body && (res.body.video_id || (res.body.data && res.body.data.video_id));
    return { ok, jobId: jobId || null, error: ok ? null : JSON.stringify(res.body).slice(0, 200) };
  } catch (err) {
    return { ok: false, jobId: null, error: err.message };
  }
}

module.exports = { submitMilestoneVideo };

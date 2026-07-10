'use strict';

/**
 * HeyGen client for Agent 2 — Function B4-VIP: submit a personalized welcome
 * video job from Dr. Flippen for a VIP ambassador, within 24 hours of approval
 * (design §5). Polling for completion and delivery is Make.com Scenario 6, not
 * Agent 2 — this module only submits the job and returns the job id to store
 * in VIP_HeyGen_Job_ID.
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

/**
 * Submit a VIP welcome video job personalized with the ambassador's first name.
 * Throws on failure so the caller can apply the design's fallback (send the
 * VIP email without video, alert Parmeet).
 */
async function submitVipWelcomeVideo({ firstName, script }) {
  const apiKey = M.getEnv('HEYGEN_API_KEY');
  const templateId = M.getEnv('HEYGEN_TEMPLATE_ID');
  const avatarId = M.getEnv('HEYGEN_FLIPPEN_AVATAR_ID');
  if (!apiKey) throw new Error('HEYGEN_API_KEY is not set');
  if (!templateId) throw new Error('HEYGEN_TEMPLATE_ID is not set');

  const payload = JSON.stringify({
    template_id: templateId,
    variables: { first_name: { name: 'first_name', type: 'text', properties: { content: firstName } } },
    caption: false,
    avatar_id: avatarId,
    script,
  });
  const res = await request({
    hostname: API_HOST,
    path: '/v2/template/generate',
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  const jobId = res.body && res.body.data && (res.body.data.video_id || res.body.data.job_id);
  if (res.status !== 200 || !jobId) {
    throw new Error(`HeyGen job submission failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return { jobId };
}

module.exports = { submitVipWelcomeVideo };

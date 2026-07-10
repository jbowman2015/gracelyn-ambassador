'use strict';

/**
 * WordPress REST API helper for Agent 5 — Step 3: verify the ambassador's
 * portal session and extract their email (design §4 Step 3).
 *
 * BUILD-TIME SEAM: the design doc says only "Call WordPress REST API with
 * session_token to confirm the user is authenticated and has ambassador role.
 * Extract user email from the verified session" — it does not name a concrete
 * endpoint or payload shape, and the design's own hard-stop (§1) says not to
 * build until Parmeet confirms the existing chat/session implementation. Rather
 * than guess at WordPress internals, this calls a configurable REST path
 * (WORDPRESS_SESSION_VERIFY_PATH, default below) with the session token, using
 * the same wp-agent5 application-password Basic Auth Agent 2 uses for its
 * WordPress calls. Expected response shape: { valid: true, email, role }.
 * Confirm the real endpoint with Parmeet before deploying (see DEPLOY.md).
 */

const https = require('https');
const { URL } = require('url');
const M = require('./manifest');

const DEFAULT_VERIFY_PATH = '/wp-json/gracelyn/v1/verify-session';
const AMBASSADOR_ROLE = 'ambassador_active';

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
 * Verify a WordPress portal session token. Returns
 * { valid, email, role } on success or when the server explicitly says
 * invalid; throws only on transport/auth-config errors so the pipeline can
 * distinguish "not verified" (design's NOT_VERIFIED_RESPONSE, no CRM record)
 * from an infrastructure failure (FALLBACK_RESPONSE + alert).
 */
async function verifySession(sessionToken) {
  const base = M.getEnv('WORDPRESS_API_BASE_URL');
  if (!base) throw new Error('WORDPRESS_API_BASE_URL is not set');
  const user = M.getEnv('WP_ADMIN_USER');
  const pass = M.getEnv('WP_ADMIN_APP_PASSWORD');
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const verifyPath = M.getEnv('WORDPRESS_SESSION_VERIFY_PATH') || DEFAULT_VERIFY_PATH;

  const url = new URL(`${base.replace(/\/+$/, '')}${verifyPath}`);
  const payload = JSON.stringify({ session_token: sessionToken });
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

  if (res.status !== 200 || !res.body || typeof res.body !== 'object') {
    return { valid: false, email: null, role: null };
  }
  const valid = res.body.valid === true && !!res.body.email
    && (res.body.role === AMBASSADOR_ROLE || res.body.role === 'ambassador');
  return { valid, email: valid ? res.body.email : null, role: res.body.role || null };
}

module.exports = { verifySession, AMBASSADOR_ROLE, DEFAULT_VERIFY_PATH };

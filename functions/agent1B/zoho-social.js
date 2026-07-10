'use strict';

/**
 * Zoho Social read-only engagement monitoring (design doc §4.2 Step 5):
 * "Identify educators who engaged with any Gracelyn-posted content in the
 * past 7 days (likes, comments, shares)." Read-only — never posts via Zoho
 * Social (§1: "No posting via Zoho Social. Confirm connected platforms with
 * Parmeet.").
 *
 * Uses ZOHO_SOCIAL_ACCESS_TOKEN directly (design doc §1.1: "Zoho Social token:
 * read-only, used for monitoring only", supplied as a ready token — no OAuth
 * refresh flow, unlike CRM/WorkDrive/Mail).
 *
 * UNCONFIRMED (flagged in DEPLOY.md, same caveat as social-monitoring.js):
 * the design doc names the credential and its purpose but not the exact
 * Zoho Social streams endpoint/response shape. `normalizeEngager()` is the
 * one place to adjust if the real account's response differs; the network
 * call is deps-injectable so orchestrate.js's tests never depend on it.
 */

const https = require('https');

const API_HOST = process.env.ZOHO_SOCIAL_API_HOST || 'social.zoho.com';

function request(options) {
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
    req.end();
  });
}

/** Normalizes one raw engagement record into { name, profileUrl, engagementType }. Pure. */
function normalizeEngager(raw) {
  return {
    name: raw.name || raw.userName || '',
    profileUrl: raw.profileUrl || raw.permalink || '',
    engagementType: raw.type || raw.action || 'engagement',
  };
}

/**
 * Fetches engagement (likes/comments/shares) on Gracelyn's own posts since
 * `sinceDate` (a Date). Returns [] on any failure or missing credentials —
 * never throws; the caller degrades (skips the high-engagement flag step)
 * and alerts, per the same non-abort pattern as the rest of the intelligence
 * cycle's optional inputs.
 */
async function fetchRecentEngagers(sinceDate) {
  const token = process.env.ZOHO_SOCIAL_ACCESS_TOKEN;
  const portalId = process.env.ZOHO_SOCIAL_PORTAL_ID;
  if (!token || !portalId) return [];
  const sinceIso = sinceDate.toISOString();
  const path = `/api/v2/portals/${encodeURIComponent(portalId)}/engagements?since=${encodeURIComponent(sinceIso)}`;
  try {
    const res = await request({
      hostname: API_HOST,
      path,
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) return [];
    return res.body.data.map(normalizeEngager);
  } catch {
    return [];
  }
}

module.exports = { normalizeEngager, fetchRecentEngagers };

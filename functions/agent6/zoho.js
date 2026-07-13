'use strict';

/**
 * Zoho CRM helper for Agent 6 — OPTIONAL, read-only, used-file exclusion only.
 *
 * Agent 6 does not interact with Zoho CRM for story intake (design §2.3); the
 * one exception is the buffer job's "used file exclusion" (design §6), which
 * reads Ambassador records for the filename Agent 3 last used. Reuses the
 * metadata/records pattern from functions/agent5A/zoho.js and
 * functions/agent0/zoho.js.
 *
 * Coordination gap flagged for Parmeet + the Agent 3 developer: the design
 * doc says the exclusion should cover files "used this week", but Agent 3's
 * schema (functions/agent3/manifest.js) has no separate
 * "date Last_Story_File_Used was set" field. This helper approximates "this
 * week" using Last_Engagement_Date (Agent 3 updates it whenever it records
 * engagement, including a story send) — confirm this mapping is correct
 * before relying on it in production; until confirmed, treat the buffer
 * job's used-file exclusion as best-effort, not authoritative.
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const API_HOST = process.env.ZOHO_CRM_API_HOST || 'www.zohoapis.com';
const API_VERSION = process.env.ZOHO_CRM_API_VERSION || 'v6';

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
async function getCrmToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CRM_CLIENT_ID,
    client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_CRM_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`CRM token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

async function crmGet(path) {
  const token = await getCrmToken();
  return request({
    hostname: API_HOST,
    path: `/crm/${API_VERSION}${path}`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
}

/** Pull all records from a module (paged), limited to `fields`. */
async function fetchAllRecords(moduleApiName, { fields, perPage = 200, maxPages = 100 } = {}) {
  const out = [];
  let page = 1;
  const fieldParam = fields && fields.length ? `&fields=${encodeURIComponent(fields.join(','))}` : '';
  while (page <= maxPages) {
    const res = await crmGet(`/${encodeURIComponent(moduleApiName)}?page=${page}&per_page=${perPage}${fieldParam}`);
    if (res.status === 204) break;
    if (res.status !== 200 || !res.body) {
      throw new Error(`list failed on "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
    }
    const data = Array.isArray(res.body.data) ? res.body.data : [];
    out.push(...data);
    const more = res.body.info && res.body.info.more_records;
    if (!more) break;
    page += 1;
  }
  return out;
}

/**
 * Fetch the set of story filenames used this week, keyed on Last_Engagement_Date
 * falling within [weekStart, now] (design §6 "used file exclusion"; see the
 * module doc-comment above for the caveat on this date mapping).
 */
async function fetchUsedFilenamesThisWeek(moduleApiName, { lastStoryFileUsedField, lastEngagementDateField, weekStart }) {
  const records = await fetchAllRecords(moduleApiName, { fields: [lastStoryFileUsedField, lastEngagementDateField] });
  const used = new Set();
  for (const r of records) {
    const filename = r[lastStoryFileUsedField];
    const engagedAt = r[lastEngagementDateField];
    if (filename && engagedAt && String(engagedAt) >= weekStart) used.add(filename);
  }
  return used;
}

module.exports = { getCrmToken, resetToken, fetchAllRecords, fetchUsedFilenamesThisWeek };

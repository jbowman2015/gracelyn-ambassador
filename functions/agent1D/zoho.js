'use strict';

/**
 * Zoho CRM helper for Agent 1D — metadata + Prospect records.
 *
 * Same shape as functions/agent0/zoho.js (token refresh + crmGet +
 * fetchModules/fetchFields/resolveModuleApiName/verifyFields), each function
 * copies this pattern rather than sharing a module since Catalyst functions
 * deploy independently. Adds nothing new on top of Agent 0's upsert — Agent
 * 1D just calls it with different fields (dedup keyed on Email, not
 * Social_Profile_URL).
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

async function crmRequest(method, path, payload) {
  const token = await getCrmToken();
  const body = payload ? JSON.stringify(payload) : null;
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return request({ hostname: API_HOST, path: `/crm/${API_VERSION}${path}`, method, headers }, body);
}

const crmGet = (path) => crmRequest('GET', path);

// ─── Metadata ──────────────────────────────────────────────────────────────────

async function fetchModules() {
  const res = await crmGet('/settings/modules');
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.modules)) {
    throw new Error(`modules metadata failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byLabel = new Map();
  for (const m of res.body.modules) {
    const rec = { api_name: m.api_name, module_name: m.module_name, plural_label: m.plural_label, singular_label: m.singular_label };
    [m.api_name, m.module_name, m.plural_label, m.singular_label]
      .filter(Boolean)
      .forEach((k) => byLabel.set(String(k).toLowerCase(), rec));
  }
  return { raw: res.body.modules, byLabel };
}

async function fetchFields(moduleApiName) {
  const res = await crmGet(`/settings/fields?module=${encodeURIComponent(moduleApiName)}`);
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.fields)) {
    throw new Error(`fields metadata failed for "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byApi = new Map();
  for (const f of res.body.fields) {
    byApi.set(f.api_name, { api_name: f.api_name, data_type: f.data_type, encrypted: !!f.crypt });
  }
  return { raw: res.body.fields, byApi };
}

async function resolveModuleApiName({ label, envVar }) {
  const modules = await fetchModules();
  const override = envVar && process.env[envVar] && process.env[envVar].trim();
  let rec = override ? modules.byLabel.get(override.toLowerCase()) : null;
  if (!rec) rec = modules.byLabel.get(String(label).toLowerCase());
  if (!rec || !rec.api_name) {
    throw new Error(`Could not resolve CRM module api_name for "${label}"${override ? ` (env ${envVar}="${override}")` : ''}.`);
  }
  const divergence = override && override.toLowerCase() !== rec.api_name.toLowerCase()
    ? `${envVar}="${override}" but Zoho api_name is "${rec.api_name}"` : null;
  return { apiName: rec.api_name, divergence };
}

async function verifyFields(moduleApiName, fieldApiNames) {
  const fields = await fetchFields(moduleApiName);
  const missing = fieldApiNames.filter((n) => !fields.byApi.has(n));
  return { missing, byApi: fields.byApi };
}

// ─── Records ──────────────────────────────────────────────────────────────────

async function searchByCriteria(moduleApiName, criteria) {
  const res = await crmGet(`/${encodeURIComponent(moduleApiName)}/search?criteria=${encodeURIComponent(criteria)}`);
  if (res.status === 204) return [];
  if (res.status !== 200 || !res.body) {
    throw new Error(`search failed on "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return Array.isArray(res.body.data) ? res.body.data : [];
}

async function createRecord(moduleApiName, record) {
  const res = await crmRequest('POST', `/${encodeURIComponent(moduleApiName)}`, { data: [record] });
  return interpretWrite(res, 'create', moduleApiName);
}

async function updateRecord(moduleApiName, id, record) {
  const res = await crmRequest('PUT', `/${encodeURIComponent(moduleApiName)}/${encodeURIComponent(id)}`, { data: [{ ...record }] });
  return interpretWrite(res, 'update', moduleApiName);
}

function interpretWrite(res, op, moduleApiName) {
  const row = res.body && Array.isArray(res.body.data) ? res.body.data[0] : null;
  const ok = row && row.code === 'SUCCESS';
  if (!ok) {
    const detail = row ? `${row.code}: ${row.message}` : `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`;
    throw new Error(`CRM ${op} failed on "${moduleApiName}": ${detail}`);
  }
  return { id: row.details && row.details.id, op };
}

/**
 * Find an existing Prospect by the dedup field (Email). Returns the raw
 * record (with `id`) or null. Split out from upsert so Step 5b can inspect
 * the existing record's Lead_Magnets_Downloaded / Audience_Track before
 * deciding what to write.
 */
async function findByDedupKey(moduleApiName, dedupField, value) {
  if (!value) return null;
  const matches = await searchByCriteria(moduleApiName, `(${dedupField}:equals:${value})`);
  return matches.length ? matches[0] : null;
}

module.exports = {
  getCrmToken,
  resetToken,
  fetchModules,
  fetchFields,
  resolveModuleApiName,
  verifyFields,
  searchByCriteria,
  findByDedupKey,
  createRecord,
  updateRecord,
};

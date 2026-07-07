'use strict';

/**
 * Zoho CRM helper for Agent 0 — metadata + records.
 *
 * Reuses the metadata-helper pattern from functions/agent5A/zoho.js (token
 * refresh + crmGet + fetchModules/fetchFields), and adds the records operations
 * Agent 0 needs: paged read of existing Prospects for the dedup index (Step 4),
 * search-by-URL, and create/update upsert (Step 10).
 *
 * Per ClaudeCode_Zoho_API_Names_Instruction, Zoho is authoritative for module +
 * field api_names. `resolveModuleApiName` pulls the real api_name live and
 * `verifyFields` cross-checks the field names Agent 0 writes against Zoho's
 * fields metadata, so a divergence is surfaced rather than failing silently.
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

// Reset the cached token — used by the run cycle's Step 1 token refresh.
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

// ─── Metadata (same shape as agent5A/zoho.js) ─────────────────────────────────

async function fetchModules() {
  const res = await crmGet('/settings/modules');
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.modules)) {
    throw new Error(`modules metadata failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byLabel = new Map();
  for (const m of res.body.modules) {
    const rec = {
      api_name: m.api_name,
      module_name: m.module_name,
      plural_label: m.plural_label,
      singular_label: m.singular_label,
      api_supported: m.api_supported,
    };
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

/**
 * Resolve a module's live api_name, preferring the env override, else matching
 * the human label against Zoho's labels/api_names. Throws if unresolved.
 */
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

/**
 * Cross-check that every field name Agent 0 intends to write exists in Zoho.
 * Returns { missing: [...] } — the caller surfaces missing names to Jessica.
 */
async function verifyFields(moduleApiName, fieldApiNames) {
  const fields = await fetchFields(moduleApiName);
  const missing = fieldApiNames.filter((n) => !fields.byApi.has(n));
  return { missing, byApi: fields.byApi };
}

// ─── Records ──────────────────────────────────────────────────────────────────

/** COQL-free field search. Returns the array of matching records (may be empty). */
async function searchByCriteria(moduleApiName, criteria) {
  const res = await crmGet(`/${encodeURIComponent(moduleApiName)}/search?criteria=${encodeURIComponent(criteria)}`);
  if (res.status === 204) return []; // Zoho returns 204 (no content) for no matches.
  if (res.status !== 200 || !res.body) {
    throw new Error(`search failed on "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return Array.isArray(res.body.data) ? res.body.data : [];
}

/**
 * Pull all records from a module (paged), returning the raw record array.
 * Used to build the Step 4 deduplication index. `fields` limits the payload.
 */
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
 * Upsert a Prospect keyed on the dedup field (Step 10). If a record with the
 * same dedup value exists, update it; otherwise create. Returns { id, op }.
 */
async function upsertProspect(moduleApiName, record, dedupField) {
  const dedupValue = record[dedupField];
  let existingId = null;
  if (dedupValue) {
    const matches = await searchByCriteria(moduleApiName, `(${dedupField}:equals:${dedupValue})`);
    if (matches.length) existingId = matches[0].id;
  }
  return existingId
    ? updateRecord(moduleApiName, existingId, record)
    : createRecord(moduleApiName, record);
}

module.exports = {
  getCrmToken,
  resetToken,
  fetchModules,
  fetchFields,
  resolveModuleApiName,
  verifyFields,
  searchByCriteria,
  fetchAllRecords,
  createRecord,
  updateRecord,
  upsertProspect,
};

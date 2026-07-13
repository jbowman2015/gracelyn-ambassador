'use strict';

/**
 * Zoho CRM helper for Agent 1A — metadata functions (getCrmToken, fetchModules,
 * fetchFields) copied verbatim from functions/agent5A/zoho.js; each Catalyst
 * function deploys as an independent, self-contained folder, so this is
 * duplicated rather than required cross-function. crmSearch/crmUpdateRecord
 * are new: the data-plane operations Agent 1A needs that 5A (a read-only
 * validation gate) never did.
 *
 * Per ClaudeCode_Zoho_API_Names_Instruction: Zoho is the single source of truth
 * for module + field API names. Agent 1A resolves them live and reconciles
 * against the design doc rather than trusting a hardcoded name — see manifest.js.
 *
 * Uses the CRM OAuth trio (ZOHO_CRM_CLIENT_ID/SECRET/REFRESH_TOKEN). The refresh
 * token must carry ZohoCRM.modules.READ/CREATE/UPDATE + ZohoCRM.settings.READ.
 */

const https = require('https');
const qs    = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const API_HOST      = process.env.ZOHO_CRM_API_HOST  || 'www.zohoapis.com';
const API_VERSION   = process.env.ZOHO_CRM_API_VERSION || 'v6';

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
    grant_type:    'refresh_token',
    client_id:     process.env.ZOHO_CRM_CLIENT_ID,
    client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_CRM_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path:     '/oauth/v2/token',
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`CRM token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

async function crmGet(path) {
  const token = await getCrmToken();
  return request({
    hostname: API_HOST,
    path:     `/crm/${API_VERSION}${path}`,
    method:   'GET',
    headers:  { Authorization: `Zoho-oauthtoken ${token}` },
  });
}

/**
 * Fetch all module metadata. Returns a Map of lowercased label/plural/api_name
 * → { api_name, module_name, api_supported }.
 */
async function fetchModules() {
  const res = await crmGet('/settings/modules');
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.modules)) {
    throw new Error(`modules metadata failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byLabel = new Map();
  for (const m of res.body.modules) {
    const rec = {
      api_name:      m.api_name,
      module_name:   m.module_name,
      plural_label:  m.plural_label,
      singular_label: m.singular_label,
      api_supported: m.api_supported,
    };
    [m.api_name, m.module_name, m.plural_label, m.singular_label]
      .filter(Boolean)
      .forEach((k) => byLabel.set(String(k).toLowerCase(), rec));
  }
  return { raw: res.body.modules, byLabel };
}

/**
 * Fetch field metadata for a module (by its confirmed api_name).
 * Returns a Map of api_name → { api_name, data_type, encrypted }.
 */
async function fetchFields(moduleApiName) {
  const res = await crmGet(`/settings/fields?module=${encodeURIComponent(moduleApiName)}`);
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.fields)) {
    throw new Error(`fields metadata failed for "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byApi = new Map();
  for (const f of res.body.fields) {
    byApi.set(f.api_name, {
      api_name:  f.api_name,
      data_type: f.data_type,
      // Zoho marks encrypted fields with a `crypt` object on the field metadata.
      encrypted: !!f.crypt,
      crypt:     f.crypt || null,
    });
  }
  return { raw: res.body.fields, byApi };
}

/**
 * Search a module by criteria string (Zoho COQL-style search criteria, e.g.
 * "((Contact_Found:equals:true)and(Outreach_Status:equals:Standard))").
 * Returns [] on "no records found" (Zoho returns non-200 for that case too).
 */
async function crmSearch(moduleApiName, criteria, fields, perPage = 200) {
  const token = await getCrmToken();
  const path = `/${moduleApiName}/search?criteria=${encodeURIComponent(criteria)}` +
    `&fields=${encodeURIComponent(fields.join(','))}&per_page=${perPage}`;
  const res = await request({
    hostname: API_HOST,
    path:     `/crm/${API_VERSION}${path}`,
    method:   'GET',
    headers:  { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 204) return []; // no content — zero matches
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
    if (res.status === 400 && res.body && res.body.code === 'INVALID_DATA') return [];
    throw new Error(`search failed for "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body.data;
}

/** Update a single record. `record` must include `id` plus the fields to change. */
async function crmUpdateRecord(moduleApiName, record) {
  const token = await getCrmToken();
  const body = JSON.stringify({ data: [record] });
  const res = await request({
    hostname: API_HOST,
    path:     `/crm/${API_VERSION}/${moduleApiName}`,
    method:   'PUT',
    headers:  {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  const entry = res.body && res.body.data && res.body.data[0];
  if (res.status !== 200 || !entry || entry.status !== 'success') {
    throw new Error(`update failed for "${moduleApiName}" id=${record.id} (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return entry;
}

/** Fetch a single record by ID (used by the lead_capture_new_contact handoff from Agent 1D). */
async function crmGetRecord(moduleApiName, id, fields) {
  const token = await getCrmToken();
  const path = `/${moduleApiName}/${id}?fields=${encodeURIComponent(fields.join(','))}`;
  const res = await request({
    hostname: API_HOST,
    path:     `/crm/${API_VERSION}${path}`,
    method:   'GET',
    headers:  { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.data) || !res.body.data[0]) {
    throw new Error(`get record failed for "${moduleApiName}" id=${id} (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body.data[0];
}

module.exports = { getCrmToken, fetchModules, fetchFields, crmSearch, crmUpdateRecord, crmGetRecord };

'use strict';

/**
 * Zoho client for Agent 1C — CRM (metadata + records), Analytics (dashboard
 * push), and WorkDrive (brand asset read).
 *
 * Reuses the metadata-helper pattern from functions/agent0/zoho.js
 * (resolveModuleApiName + verifyFields) so module/field api_names are always
 * confirmed live against Zoho rather than hardcoded from a document, per
 * docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md.
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const CRM_HOST = process.env.ZOHO_CRM_API_HOST || 'www.zohoapis.com';
const CRM_API_VERSION = process.env.ZOHO_CRM_API_VERSION || 'v6';
const ANALYTICS_HOST = process.env.ZOHO_ANALYTICS_API_HOST || 'analyticsapi.zoho.com';
const WD_HOST = process.env.ZOHO_WORKDRIVE_API_HOST || 'www.zohoapis.com';
const DOWNLOAD_HOST = process.env.ZOHO_WORKDRIVE_DOWNLOAD_HOST || 'download.zoho.com';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let parsed = buf.toString('utf8');
        if ((res.headers['content-type'] || '').includes('application/json')) {
          try { parsed = JSON.parse(parsed); } catch { /* keep string */ }
        }
        resolve({ status: res.statusCode, body: parsed, buffer: buf });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshToken({ clientId, clientSecret, refreshToken }) {
  const body = qs.stringify({
    grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Token refresh failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
}

// ─── CRM ───────────────────────────────────────────────────────────────────────
let _crmToken = null;
async function getCrmToken() {
  if (_crmToken) return _crmToken;
  _crmToken = await refreshToken({
    clientId: M.getEnv('ZOHO_CRM_CLIENT_ID'),
    clientSecret: M.getEnv('ZOHO_CRM_CLIENT_SECRET'),
    refreshToken: M.getEnv('ZOHO_CRM_REFRESH_TOKEN'),
  });
  return _crmToken;
}
function resetCrmToken() { _crmToken = null; }

async function crmRequest(method, path, payload) {
  const token = await getCrmToken();
  const body = payload ? JSON.stringify(payload) : null;
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return request({ hostname: CRM_HOST, path: `/crm/${CRM_API_VERSION}${path}`, method, headers }, body);
}
const crmGet = (path) => crmRequest('GET', path);

async function fetchModules() {
  const res = await crmGet('/settings/modules');
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.modules)) {
    throw new Error(`modules metadata failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const byLabel = new Map();
  for (const mod of res.body.modules) {
    const rec = { api_name: mod.api_name, module_name: mod.module_name, plural_label: mod.plural_label, singular_label: mod.singular_label };
    [mod.api_name, mod.module_name, mod.plural_label, mod.singular_label]
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

/** Resolve a module's live api_name, preferring the env override, else label match. */
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

/** Cross-check that every field name Agent 1C intends to read/write exists in Zoho. */
async function verifyFields(moduleApiName, fieldApiNames) {
  const fields = await fetchFields(moduleApiName);
  const missing = fieldApiNames.filter((n) => !fields.byApi.has(n));
  return { missing, byApi: fields.byApi };
}

async function searchByCriteria(moduleApiName, criteria) {
  const res = await crmGet(`/${encodeURIComponent(moduleApiName)}/search?criteria=${encodeURIComponent(criteria)}`);
  if (res.status === 204) return [];
  if (res.status !== 200 || !res.body) {
    throw new Error(`search failed on "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return Array.isArray(res.body.data) ? res.body.data : [];
}

async function fetchRecords(moduleApiName, { criteria, fields, perPage = 200 } = {}) {
  if (criteria) return searchByCriteria(moduleApiName, criteria);
  const fieldParam = fields && fields.length ? `&fields=${encodeURIComponent(fields.join(','))}` : '';
  const res = await crmGet(`/${encodeURIComponent(moduleApiName)}?per_page=${perPage}${fieldParam}`);
  if (res.status === 204) return [];
  if (res.status !== 200 || !res.body) {
    throw new Error(`list failed on "${moduleApiName}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return Array.isArray(res.body.data) ? res.body.data : [];
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

async function createRecord(moduleApiName, record) {
  const res = await crmRequest('POST', `/${encodeURIComponent(moduleApiName)}`, { data: [record] });
  return interpretWrite(res, 'create', moduleApiName);
}

async function updateRecord(moduleApiName, id, record) {
  const res = await crmRequest('PUT', `/${encodeURIComponent(moduleApiName)}/${encodeURIComponent(id)}`, { data: [{ ...record }] });
  return interpretWrite(res, 'update', moduleApiName);
}

// ─── Zoho Analytics ────────────────────────────────────────────────────────────
let _analyticsToken = null;
async function getAnalyticsToken() {
  if (_analyticsToken) return _analyticsToken;
  _analyticsToken = await refreshToken({
    clientId: M.getEnv('ZOHO_ANALYTICS_CLIENT_ID'),
    clientSecret: M.getEnv('ZOHO_ANALYTICS_CLIENT_SECRET'),
    refreshToken: M.getEnv('ZOHO_ANALYTICS_REFRESH_TOKEN'),
  });
  return _analyticsToken;
}
function resetAnalyticsToken() { _analyticsToken = null; }

/**
 * Push a row to the coordinator dashboard (upsert by Date). Design §4 Step A4 /
 * confirmation update. Throws on non-2xx so the caller applies the §7 fallback
 * (embed spend data directly in the alert email).
 */
async function updateAnalyticsDashboard(row) {
  const token = await getAnalyticsToken();
  const workspaceId = M.getEnv('AMBASSADOR_ANALYTICS_WORKSPACE_ID');
  const view = M.getEnv('AMBASSADOR_ANALYTICS_DAILY_SPEND_VIEW') || 'DailySpendLog';
  const payload = qs.stringify({
    ZOHO_ACTION: 'IMPORT',
    ZOHO_COLUMNS: JSON.stringify(Object.keys(row)),
    ZOHO_ROWS: JSON.stringify([Object.values(row)]),
    ZOHO_IMPORT_TYPE: 'UPDATEADD',
    ZOHO_MATCHING_COLUMNS: 'Date',
  });
  const res = await request({
    hostname: ANALYTICS_HOST,
    path: `/api/v2/workspaces/${encodeURIComponent(workspaceId)}/views/${encodeURIComponent(view)}/rows`,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Analytics dashboard update failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return { ok: true };
}

// ─── Zoho WorkDrive ────────────────────────────────────────────────────────────
let _wdToken = null;
async function getWorkDriveToken() {
  if (_wdToken) return _wdToken;
  _wdToken = await refreshToken({
    clientId: M.getEnv('ZOHO_WORKDRIVE_CLIENT_ID'),
    clientSecret: M.getEnv('ZOHO_WORKDRIVE_CLIENT_SECRET'),
    refreshToken: M.getEnv('ZOHO_WORKDRIVE_REFRESH_TOKEN'),
  });
  return _wdToken;
}
function resetWorkDriveToken() { _wdToken = null; }

async function listFolderFiles(folderId) {
  const token = await getWorkDriveToken();
  const res = await request({
    hostname: WD_HOST,
    path: `/workdrive/api/v1/files/${encodeURIComponent(folderId)}/files`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/vnd.api+json' },
  });
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
    throw new Error(`WorkDrive list failed for folder "${folderId}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res.body.data.map((f) => ({ id: f.id, name: (f.attributes && (f.attributes.name || f.attributes.display_attr_name)) || '' }));
}

async function downloadFileText(fileId) {
  const token = await getWorkDriveToken();
  const res = await request({
    hostname: DOWNLOAD_HOST,
    path: `/v1/workdrive/download/${encodeURIComponent(fileId)}`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status !== 200) throw new Error(`WorkDrive download failed for "${fileId}" (HTTP ${res.status})`);
  return res.buffer.toString('utf8');
}

async function readFileByName(folderId, filename) {
  const files = await listFolderFiles(folderId);
  const match = files.find((f) => f.name === filename) || files.find((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!match) throw new Error(`WorkDrive file "${filename}" not found in folder "${folderId}".`);
  return downloadFileText(match.id);
}

/** Read the two brand asset files from Folder 08 (design §2.2). Non-fatal if missing. */
async function readBrandAssets(folder08Id) {
  const [copyRules, voiceGuidelines] = await Promise.allSettled([
    readFileByName(folder08Id, 'ambassador_copy_rules.txt'),
    readFileByName(folder08Id, 'ambassador_voice_guidelines.txt'),
  ]);
  return {
    copyRules: copyRules.status === 'fulfilled' ? copyRules.value : '',
    voiceGuidelines: voiceGuidelines.status === 'fulfilled' ? voiceGuidelines.value : '',
  };
}

module.exports = {
  // CRM
  getCrmToken, resetCrmToken, fetchModules, fetchFields, resolveModuleApiName, verifyFields,
  searchByCriteria, fetchRecords, createRecord, updateRecord,
  // Analytics
  getAnalyticsToken, resetAnalyticsToken, updateAnalyticsDashboard,
  // WorkDrive
  getWorkDriveToken, resetWorkDriveToken, listFolderFiles, downloadFileText, readFileByName, readBrandAssets,
};

'use strict';

/**
 * Zoho Forms client — used only by the nightly cleanup job (Scenario 3,
 * design §7), never the real-time webhook path.
 *
 * NOT YET LIVE-CONFIRMED: the Zoho Forms REST API addresses a form as
 * `{account_owner_name}/{form_link_name}`, not a bare numeric ID. As of this
 * build LEAD_CAPTURE_FORM_IDS is documented as "JSON array of Zoho Forms
 * form IDs" (design §9/§12) without specifying which identifier shape
 * Parmeet will populate it with. This client accepts each LEAD_CAPTURE_FORM_IDS
 * entry as an opaque `formRef` and expects it to already be in the
 * `owner/formLinkName` shape the API needs — confirm with Parmeet at deploy
 * time and adjust `recordsPath` below if the org uses a different form
 * addressing convention. This mirrors how Agent 1A documents PARA_DB_MODULE_NAME
 * as "not yet confirmed, degrades gracefully" rather than guessing silently.
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const FORMS_API_HOST = process.env.ZOHO_FORMS_API_HOST || 'forms.zoho.com';

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

let _token = null;
async function getFormsToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_FORMS_CLIENT_ID,
    client_secret: process.env.ZOHO_FORMS_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_FORMS_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  });
  if (!res.body || !res.body.access_token) {
    throw new Error(`Forms token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

/**
 * Fetch submissions for one form recorded since `sinceIso`. Returns records
 * normalized to the same shape as the real-time webhook payload. Throws on
 * an API failure so the caller can alert Parmeet per form, without aborting
 * the other forms in the cleanup run.
 */
async function fetchRecentSubmissions(formRef, sinceIso) {
  const token = await getFormsToken();
  const res = await request({
    hostname: FORMS_API_HOST,
    path: `/api/v1/${formRef}/records?range_from=${encodeURIComponent(sinceIso)}`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status !== 200 || !res.body) {
    throw new Error(`Forms records fetch failed for "${formRef}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  const rows = Array.isArray(res.body) ? res.body : (Array.isArray(res.body.data) ? res.body.data : []);
  return rows.map(normalizeRecord);
}

function normalizeRecord(row) {
  const r = row || {};
  return {
    first_name: r.first_name || r.First_Name || '',
    email: r.email || r.Email || '',
    role_category: r.role_category || r.Role_Category || '',
    state: r.state || r.State || '',
    lead_magnet_id: r.lead_magnet_id || r.Lead_Magnet_Id || '',
    utm_source: r.utm_source || r.UTM_Source || '',
    utm_campaign: r.utm_campaign || r.UTM_Campaign || '',
  };
}

module.exports = { getFormsToken, resetToken, fetchRecentSubmissions };

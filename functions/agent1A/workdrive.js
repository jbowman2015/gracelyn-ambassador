'use strict';

/**
 * WorkDrive Folder 08 brand asset reads (design doc §3.3). Read fresh on every
 * run — not cached — so Parmeet's copy updates take effect immediately. On a
 * missing file, log it and continue with reduced context (design doc §7: no
 * abort, but alert Parmeet).
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const WORKDRIVE_API_HOST = process.env.ZOHO_WORKDRIVE_API_HOST || 'workdrive.zoho.com';

const BRAND_ASSET_FILES = [
  'ambassador_copy_rules.txt',
  'ambassador_voice_guidelines.txt',
  'ambassador_motivation_frames.txt',
  'ambassador_program_descriptions.txt',
];

function request(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

let _token = null;
async function getWorkdriveToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_WORKDRIVE_CLIENT_ID,
    client_secret: process.env.ZOHO_WORKDRIVE_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  });
  let parsed;
  try { parsed = JSON.parse(res.body); } catch { parsed = null; }
  if (!parsed || !parsed.access_token) {
    throw new Error(`WorkDrive token failed: ${res.body}`);
  }
  _token = parsed.access_token;
  return _token;
}

/**
 * Reads all four brand asset files from Folder 08. Returns { assets, missing }
 * — missing is a list of filenames not found, never throws for that case.
 */
async function readAllBrandAssets() {
  const token = await getWorkdriveToken();
  const folderId = process.env.WORKDRIVE_FOLDER_08_ID;
  const listRes = await request({
    hostname: WORKDRIVE_API_HOST,
    path: `/api/v1/files/${folderId}/files`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  let listData;
  try { listData = JSON.parse(listRes.body); } catch { listData = null; }
  if (!listData || !Array.isArray(listData.data)) {
    return { assets: {}, missing: BRAND_ASSET_FILES.slice() };
  }

  const byName = new Map(listData.data.map((f) => [f.attributes && f.attributes.name, f]));
  const assets = {};
  const missing = [];
  for (const name of BRAND_ASSET_FILES) {
    const file = byName.get(name);
    if (!file) { missing.push(name); continue; }
    const dlRes = await request({
      hostname: WORKDRIVE_API_HOST,
      path: `/api/v1/files/${file.id}/download`,
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    assets[name] = dlRes.body;
  }
  return { assets, missing };
}

module.exports = { BRAND_ASSET_FILES, getWorkdriveToken, readAllBrandAssets };

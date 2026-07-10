'use strict';

/**
 * Zoho WorkDrive helper for Agent 6 — read-only. The buffer-monitoring job
 * scans Folder 05 for the current story count by role category (design §6).
 * Agent 6 never writes to Folder 05 itself; the Zoho Flow owns file creation
 * (design §2.3, §5). Reuses the OAuth + request pattern from
 * functions/agent3/workdrive.js.
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
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

let _token = null;
async function getWorkDriveToken() {
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
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`WorkDrive token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

/** List files within a folder, newest first. Returns [{ id, name, createdTime }]. */
async function listFolderFiles(folderId) {
  const token = await getWorkDriveToken();
  const res = await request({
    hostname: WD_HOST,
    path: `/workdrive/api/v1/files/${encodeURIComponent(folderId)}/files?sort_by=created_time&sort_order=DESC&limit=200`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/vnd.api+json' },
  });
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
    throw new Error(`WorkDrive list failed for folder "${folderId}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res.body.data.map((f) => ({
    id: f.id,
    name: (f.attributes && (f.attributes.name || f.attributes.display_attr_name)) || '',
    createdTime: f.attributes && f.attributes.created_time,
  }));
}

async function downloadFileText(fileId) {
  const token = await getWorkDriveToken();
  const res = await request({
    hostname: DOWNLOAD_HOST,
    path: `/v1/workdrive/download/${encodeURIComponent(fileId)}`,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status !== 200) {
    throw new Error(`WorkDrive download failed for "${fileId}" (HTTP ${res.status})`);
  }
  return res.buffer.toString('utf8');
}

/** List story files (Story_*.txt) from Folder 05. */
async function listStoryFiles(folder05Id, { prefix = 'Story_', suffix = '.txt' } = {}) {
  const files = await listFolderFiles(folder05Id);
  return files.filter((f) => f.name.startsWith(prefix) && f.name.endsWith(suffix));
}

module.exports = { getWorkDriveToken, resetToken, listFolderFiles, downloadFileText, listStoryFiles };

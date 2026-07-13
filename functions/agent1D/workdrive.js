'use strict';

/**
 * Zoho WorkDrive helper for Agent 1D.
 *
 *   - readBrandAsset()      — Folder 08, ambassador_copy_rules.txt (design §1,
 *                             read by Claude's opening-sentence prompt). Missing
 *                             is non-fatal — Agent 1D continues without it.
 *   - resolveLeadMagnetLink() — Step 4 (design §4): locate the file at the
 *                             LEAD_MAGNET_MAP path within Folder 06 (which may
 *                             be nested one subfolder deep) and generate a
 *                             time-limited share link (minimum 7-day validity).
 *
 * Same raw-https pattern as functions/agent0/workdrive.js — no SDK dependency,
 * copied rather than shared since each Catalyst function deploys independently.
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

/** List files/folders directly within a folder. Returns [{ id, name, isFolder }]. */
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
  return res.body.data.map((f) => ({
    id: f.id,
    name: (f.attributes && (f.attributes.name || f.attributes.display_attr_name)) || '',
    isFolder: !!(f.attributes && f.attributes.is_folder),
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
  if (res.status !== 200) throw new Error(`WorkDrive download failed for "${fileId}" (HTTP ${res.status})`);
  return res.buffer.toString('utf8');
}

/** Read a named file from a folder as text. Returns null (not throw) if absent. */
async function readFileByName(folderId, filename) {
  const files = await listFolderFiles(folderId);
  const match = files.find((f) => f.name === filename)
    || files.find((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!match) return null;
  return downloadFileText(match.id);
}

/**
 * Read the Folder 08 brand asset used in the Claude opening-sentence prompt.
 * Never throws — missing asset just means the prompt runs without it.
 */
async function readBrandAsset(folder08Id, filename) {
  try {
    return await readFileByName(folder08Id, filename);
  } catch {
    return null;
  }
}

/**
 * Resolve a `/`-separated relative path (e.g. "k12-educator/selfcare-guide.pdf")
 * to a file id, walking one subfolder level at a time from `rootFolderId`.
 * Returns null if any segment is not found (caller applies the fallback flow).
 */
async function resolveFileIdByPath(rootFolderId, relativePath) {
  const segments = String(relativePath || '').split('/').filter(Boolean);
  if (!segments.length) return null;
  let currentFolder = rootFolderId;
  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const files = await listFolderFiles(currentFolder);
    const match = files.find((f) => f.name === segments[i])
      || files.find((f) => f.name.toLowerCase() === segments[i].toLowerCase());
    if (!match) return null;
    if (isLast) return match.id;
    currentFolder = match.id;
  }
  return null;
}

/**
 * Create a time-limited share link for a file. `minDays` is the minimum
 * validity per design §4 Step 4 (default 7). Returns the share URL.
 */
async function createShareLink(fileId, minDays = 7) {
  const token = await getWorkDriveToken();
  const expiry = new Date(Date.now() + minDays * 24 * 60 * 60 * 1000);
  const payload = JSON.stringify({
    data: {
      attributes: {
        resource_id: fileId,
        role_id: '34', // view/download link role (WorkDrive external link).
        expiry_date: expiry.toISOString().slice(0, 10),
        link_name: 'Agent 1D lead magnet delivery',
      },
      type: 'links',
    },
  });
  const res = await request({
    hostname: WD_HOST,
    path: '/workdrive/api/v1/links',
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/vnd.api+json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`WorkDrive share link failed for "${fileId}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  const rec = res.body && res.body.data;
  const url = rec && rec.attributes && (rec.attributes.link_url || rec.attributes.url);
  if (!url) throw new Error(`WorkDrive share link response missing URL for "${fileId}".`);
  return url;
}

/**
 * Step 4 (design §4): resolve the lead_magnet_id's file via LEAD_MAGNET_MAP
 * and generate a share link. Returns { url, resourceName } on success, or
 * { url: null, resourceName } on any miss — caller applies the fallback
 * delivery-email message and alerts Parmeet, but never aborts the submission.
 */
async function resolveLeadMagnetLink(folder06Id, leadMagnetMap, leadMagnetId, minDays) {
  const relativePath = leadMagnetMap && leadMagnetMap[leadMagnetId];
  const resourceName = relativePath ? relativePath.split('/').pop() : null;
  if (!relativePath) return { url: null, resourceName: null, reason: 'lead_magnet_id not in LEAD_MAGNET_MAP' };
  const fileId = await resolveFileIdByPath(folder06Id, relativePath);
  if (!fileId) return { url: null, resourceName, reason: `file not found at path "${relativePath}"` };
  const url = await createShareLink(fileId, minDays);
  return { url, resourceName, reason: null };
}

module.exports = {
  getWorkDriveToken,
  resetToken,
  listFolderFiles,
  downloadFileText,
  readFileByName,
  readBrandAsset,
  resolveFileIdByPath,
  createShareLink,
  resolveLeadMagnetLink,
};

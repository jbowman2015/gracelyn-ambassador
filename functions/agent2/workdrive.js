'use strict';

/**
 * Zoho WorkDrive helper for Agent 2.
 *
 *   - readVoiceGuidelines() — Folder 08, for the VIP personalization paragraph (§7.2).
 *   - listWelcomeKitFiles() + generateShareLinks() — Folder 03, Function D2:
 *     30-day time-limited share links for the welcome kit files relevant to the
 *     ambassador's Audience_Track. VIP ambassadors get every file in the folder
 *     (the "additional VIP kit files" the design doc describes, distinguished by
 *     a `vip_` filename prefix convention).
 *
 * OAuth uses the ZOHO_WORKDRIVE trio, same pattern as agent0/workdrive.js.
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const WD_HOST = process.env.ZOHO_WORKDRIVE_API_HOST || 'www.zohoapis.com';
const DOWNLOAD_HOST = process.env.ZOHO_WORKDRIVE_DOWNLOAD_HOST || 'download.zoho.com';
const SHARE_LINK_DAYS = 30;

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

/** Read the voice guidelines asset from Folder 08 (§7.2 VIP personalization). */
async function readVoiceGuidelines(folder08Id, filename = 'voice_guidelines.txt') {
  const files = await listFolderFiles(folder08Id);
  const match = files.find((f) => f.name === filename) || files.find((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!match) throw new Error(`WorkDrive file "${filename}" not found in folder "${folder08Id}".`);
  return downloadFileText(match.id);
}

/** List welcome kit files in Folder 03, relevant to the audience track (or all for VIP). */
async function listWelcomeKitFiles(folder03Id, { audienceTrack, vip } = {}) {
  const files = await listFolderFiles(folder03Id);
  if (vip) return files;
  if (!audienceTrack) return files;
  const slug = audienceTrack.toLowerCase().replace(/\s+/g, '_');
  const relevant = files.filter((f) => f.name.toLowerCase().includes(slug) && !f.name.toLowerCase().startsWith('vip_'));
  return relevant.length ? relevant : files.filter((f) => !f.name.toLowerCase().startsWith('vip_'));
}

/** Create a 30-day external share link for one file. Returns { fileId, name, url }. */
async function createShareLink(fileId, name) {
  const token = await getWorkDriveToken();
  const expiry = new Date(Date.now() + SHARE_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({
    data: { attributes: { resource_id: fileId, role_id: '34', expiry_date: expiry }, type: 'links' },
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
    throw new Error(`WorkDrive share link failed for "${name}" (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  const attrs = res.body && res.body.data && res.body.data.attributes;
  const url = attrs && (attrs.short_url || attrs.download_url || attrs.url);
  if (!url) throw new Error(`WorkDrive share link response for "${name}" had no URL.`);
  return { fileId, name, url };
}

/**
 * Generate 30-day share links for every relevant welcome-kit file (Function D2).
 * Never throws for a single file failure — returns { links, failures } so the
 * caller can send Email D with a fallback note per the design's §10 failure table.
 */
async function generateWelcomeKitLinks(folder03Id, { audienceTrack, vip } = {}) {
  const files = await listWelcomeKitFiles(folder03Id, { audienceTrack, vip });
  const links = [];
  const failures = [];
  for (const f of files) {
    try {
      links.push(await createShareLink(f.id, f.name));
    } catch (err) {
      failures.push({ name: f.name, error: err.message });
    }
  }
  return { links, failures };
}

module.exports = {
  getWorkDriveToken,
  resetToken,
  listFolderFiles,
  downloadFileText,
  readVoiceGuidelines,
  listWelcomeKitFiles,
  createShareLink,
  generateWelcomeKitLinks,
};

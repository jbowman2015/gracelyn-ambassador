'use strict';

/**
 * Zoho WorkDrive helper for Agent 1B — Folders 02 (approved social content),
 * 07 (Agent 0 gap reports), 08 (brand assets), 09 (VIP Prospect briefings,
 * read-only). Token refresh + list/download follow the same pattern as
 * functions/agent0/workdrive.js and functions/agent1A/workdrive.js; renaming
 * (the _POSTED suffix, design doc §4.1 Step 7) is new — neither agent0 nor
 * agent1A needed to mutate a file already in WorkDrive.
 *
 * Read fresh on every run — not cached — so Parmeet's content/copy updates
 * take effect immediately (same rule as Agent 1A's brand-asset reads).
 */

const https = require('https');
const qs = require('querystring');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const WD_HOST = process.env.ZOHO_WORKDRIVE_API_HOST || 'www.zohoapis.com';
const DOWNLOAD_HOST = process.env.ZOHO_WORKDRIVE_DOWNLOAD_HOST || 'download.zoho.com';

const POSTED_SUFFIX = '_POSTED';

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
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`WorkDrive token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

/** List files within a folder. Returns [{ id, name, createdTime, permalink }]. */
async function listFolderFiles(folderId) {
  const token = await getWorkdriveToken();
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
    createdTime: (f.attributes && (f.attributes.created_time_in_millis || f.attributes.created_time)) || null,
    permalink: (f.attributes && f.attributes.permalink) || null,
  }));
}

/** Download a file's raw text by resource id. */
async function downloadFileText(fileId) {
  const token = await getWorkdriveToken();
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

/** Read a named file from a folder as text. Throws if not present. */
async function readFileByName(folderId, filename) {
  const files = await listFolderFiles(folderId);
  const match = files.find((f) => f.name === filename)
    || files.find((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!match) throw new Error(`WorkDrive file "${filename}" not found in folder "${folderId}".`);
  return downloadFileText(match.id);
}

/**
 * Read the required brand assets from Folder 08 (design doc §3.3 — copy rules
 * + voice guidelines, both required). Returns { assets, missing } — never
 * throws for a missing file so the caller can halt the post cycle with an
 * alert (design doc §9) instead of an unhandled exception.
 */
async function readBrandAssets(folder08Id, assetNames) {
  const assets = {};
  const missing = [];
  for (const name of assetNames) {
    try {
      assets[name] = await readFileByName(folder08Id, name);
    } catch {
      missing.push(name);
    }
  }
  return { assets, missing };
}

/**
 * Folder 02 (design doc §3.1): files NOT already carrying the _POSTED suffix,
 * oldest first (createdTime ascending; files with no timestamp sort last so
 * they don't jump the queue). Returns [] if the folder is empty or unreadable
 * — the caller sends the low-content alert and exits gracefully rather than
 * throwing (design doc §9).
 */
async function listUnpostedAssets(folder02Id) {
  let files;
  try {
    files = await listFolderFiles(folder02Id);
  } catch {
    return [];
  }
  return files
    .filter((f) => !f.name.endsWith(POSTED_SUFFIX) && !/_POSTED\.[a-zA-Z0-9]+$/.test(f.name))
    .sort((a, b) => (Number(a.createdTime) || Infinity) - (Number(b.createdTime) || Infinity));
}

/**
 * Design doc §4.1 Step 7: rename the posted asset by appending _POSTED so it
 * is never selected again. Inserts the suffix before the file extension when
 * one is present (e.g. "flyer.png" → "flyer_POSTED.png").
 */
function postedFilename(originalName) {
  const dot = originalName.lastIndexOf('.');
  if (dot <= 0) return `${originalName}${POSTED_SUFFIX}`;
  return `${originalName.slice(0, dot)}${POSTED_SUFFIX}${originalName.slice(dot)}`;
}

async function markAssetPosted(fileId, originalName) {
  const token = await getWorkdriveToken();
  const newName = postedFilename(originalName);
  const body = JSON.stringify({ data: { attributes: { name: newName }, id: fileId, type: 'files' } });
  const res = await request({
    hostname: WD_HOST,
    path: `/workdrive/api/v1/files/${encodeURIComponent(fileId)}`,
    method: 'PATCH',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/vnd.api+json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`WorkDrive rename of "${originalName}" failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return { id: fileId, name: newName };
}

/**
 * Folder 07 (design doc §3.2): most recently created gap report, or null if
 * the folder is empty/unreadable (caller degrades to default community
 * config + alert, per design doc §9 — never throws).
 */
async function readMostRecentGapReport(folder07Id) {
  let files;
  try {
    files = await listFolderFiles(folder07Id);
  } catch {
    return null;
  }
  if (!files.length) return null;
  const mostRecent = files.slice().sort((a, b) => (Number(b.createdTime) || 0) - (Number(a.createdTime) || 0))[0];
  try {
    return { name: mostRecent.name, content: await downloadFileText(mostRecent.id) };
  } catch {
    return null;
  }
}

/**
 * Folder 09 (design doc §3.4, read-only): all active VIP Prospect briefing
 * documents. Returns [] if the folder is empty/unreadable — caller degrades
 * (no Stage 1 warm-follow monitoring that cycle) rather than throwing.
 */
async function readAllBriefings(folder09Id) {
  let files;
  try {
    files = await listFolderFiles(folder09Id);
  } catch {
    return [];
  }
  const briefings = [];
  for (const f of files) {
    try {
      briefings.push({ name: f.name, content: await downloadFileText(f.id) });
    } catch {
      // Skip an individual unreadable briefing rather than failing the whole cycle.
    }
  }
  return briefings;
}

/**
 * Design doc §6 "Low content alert": days since the most recently posted
 * asset, used for the alert payload. Returns null if no _POSTED asset is
 * found (can't compute a meaningful count yet).
 */
function daysSinceLastPost(files, today) {
  const postedTimes = files
    .filter((f) => f.name.includes(POSTED_SUFFIX))
    .map((f) => Number(f.createdTime))
    .filter((t) => Number.isFinite(t) && t > 0);
  if (!postedTimes.length) return null;
  const mostRecent = Math.max(...postedTimes);
  return Math.max(0, Math.floor((today.getTime() - mostRecent) / 86400000));
}

module.exports = {
  getWorkdriveToken,
  resetToken,
  listFolderFiles,
  downloadFileText,
  readFileByName,
  readBrandAssets,
  listUnpostedAssets,
  markAssetPosted,
  postedFilename,
  readMostRecentGapReport,
  readAllBriefings,
  daysSinceLastPost,
  POSTED_SUFFIX,
};

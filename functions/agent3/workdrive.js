'use strict';

/**
 * Zoho WorkDrive helper for Agent 3.
 *
 *   - listStoryFiles() / downloadFileText()  — Folder 05 story buffer (design §5.3).
 *   - markStoryUsed()   — appends to a Used_By log in Folder 05 (Step 5).
 *   - readUpdateBrief()  — Folder 08 `update_brief.txt` for the Week 4 Program
 *     Update email; returns null (not throw) when absent so the caller can fall
 *     back to a Claude-generated mission message (design §5.2 Week 4).
 *
 * OAuth uses the ZOHO_WORKDRIVE trio, same pattern as functions/agent0/workdrive.js.
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
    path: `/workdrive/api/v1/files/${encodeURIComponent(folderId)}/files?sort_by=created_time&sort_order=DESC&limit=50`,
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

/** List story files (Story_*.txt) from Folder 05, newest first. */
async function listStoryFiles(folder05Id, { prefix = 'Story_', suffix = '.txt' } = {}) {
  const files = await listFolderFiles(folder05Id);
  return files.filter((f) => f.name.startsWith(prefix) && f.name.endsWith(suffix));
}

/** Read a named file from a folder as text, or null if not present (no throw). */
async function readFileByNameOrNull(folderId, filename) {
  const files = await listFolderFiles(folderId);
  const match = files.find((f) => f.name === filename)
    || files.find((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!match) return null;
  return downloadFileText(match.id);
}

/** Append a Used_By log entry for a consumed story file (design §5.3 Step 5). */
async function uploadTextFile(folderId, filename, content) {
  const token = await getWorkDriveToken();
  const boundary = `----agent3boundary${Buffer.from(filename).toString('hex').slice(0, 16)}`;
  const CRLF = '\r\n';
  const parts = [];
  parts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="parent_id"${CRLF}${CRLF}${folderId}${CRLF}`);
  parts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="filename"${CRLF}${CRLF}${filename}${CRLF}`);
  parts.push(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="content"; filename="${filename}"${CRLF}Content-Type: text/plain${CRLF}${CRLF}`,
  );
  const head = Buffer.from(parts.join(''), 'utf8');
  const body = Buffer.from(content, 'utf8');
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
  const payload = Buffer.concat([head, body, tail]);
  const res = await request({
    hostname: WD_HOST,
    path: '/workdrive/api/v1/upload',
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
    },
  }, payload);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`WorkDrive upload of "${filename}" failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  const rec = res.body && res.body.data ? (Array.isArray(res.body.data) ? res.body.data[0] : res.body.data) : null;
  const id = rec && (rec.attributes ? (rec.attributes.resource_id || rec.id) : rec.id);
  return { id: id || null, name: filename };
}

/** Mark a story file used: append a Used_By_<date>.txt log entry into Folder 05. */
async function markStoryUsed(folder05Id, { roleCategory, filename, today }) {
  const logName = `Used_By_${today}.txt`;
  const existing = await readFileByNameOrNull(folder05Id, logName);
  const line = `${filename} | ${roleCategory || 'Unknown'} | ${today}\n`;
  const content = (existing || '') + line;
  return uploadTextFile(folder05Id, logName, content);
}

/** Read Folder 08's update_brief.txt, or null if not present (design §5.2 Week 4). */
async function readUpdateBrief(folder08Id, filename = 'update_brief.txt') {
  return readFileByNameOrNull(folder08Id, filename);
}

module.exports = {
  getWorkDriveToken,
  resetToken,
  listFolderFiles,
  downloadFileText,
  listStoryFiles,
  readFileByNameOrNull,
  uploadTextFile,
  markStoryUsed,
  readUpdateBrief,
};

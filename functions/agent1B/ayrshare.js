'use strict';

/**
 * Ayrshare posting (design doc §4.1 Step 5). Static API key, no OAuth refresh.
 * "Post to all three platforms in a single Ayrshare call" — uses Ayrshare's
 * platformOptions override so each platform gets its own generated caption
 * (design doc §7.1) in one request. "A failure on one platform does not block
 * the others" — this module never throws for a per-platform failure; it
 * always returns a per-platform result array so the caller can log/alert
 * accordingly.
 *
 * ASSUMPTION (flagged in DEPLOY.md — confirm against the real Ayrshare
 * account before Week 2): Ayrshare's response includes a `posts` array with
 * one entry per requested platform (`platform`, `status`, `id`/`errors`). If
 * the account/response shape differs, `parsePostResponse` is the one place
 * to adjust — it is unit tested in isolation from the network call.
 */

const https = require('https');

const API_HOST = process.env.AYRSHARE_API_HOST || 'app.ayrshare.com';

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

const PLATFORMS = ['linkedin', 'facebook', 'instagram'];

/** Builds the Ayrshare request payload. Pure — used by both the real call and tests. */
function buildPostPayload(captions, mediaUrl) {
  const payload = {
    post: captions.linkedin || captions.facebook || captions.instagram || '',
    platforms: PLATFORMS,
    platformOptions: {
      linkedin: { post: captions.linkedin },
      facebook: { post: captions.facebook },
      instagram: { post: captions.instagram },
    },
  };
  if (mediaUrl) payload.mediaUrls = [mediaUrl];
  return payload;
}

/**
 * Normalizes Ayrshare's response into one result per platform:
 * [{ platform, ok, postId, errorCode }]. Never throws — a malformed/unexpected
 * response shape is treated as "unknown per-platform outcome" and every
 * requested platform is reported failed with the parse problem as the error,
 * matching design doc §9's "Ayrshare post fails on all platforms" handling.
 */
function parsePostResponse(httpStatus, body) {
  if (httpStatus < 200 || httpStatus >= 300 || !body || typeof body !== 'object') {
    const errorCode = `HTTP ${httpStatus}`;
    return PLATFORMS.map((platform) => ({ platform, ok: false, postId: null, errorCode }));
  }
  const posts = Array.isArray(body.posts) ? body.posts : null;
  if (!posts) {
    // No per-platform detail — best-effort: whole call succeeded, assume all requested platforms posted.
    return PLATFORMS.map((platform) => ({ platform, ok: true, postId: (body.id || null), errorCode: null }));
  }
  return PLATFORMS.map((platform) => {
    const entry = posts.find((p) => p && p.platform === platform);
    if (!entry) return { platform, ok: false, postId: null, errorCode: 'No response entry for platform' };
    const ok = entry.status === 'success' || entry.status === 'scheduled';
    return {
      platform,
      ok,
      postId: entry.id || null,
      errorCode: ok ? null : (entry.errors ? JSON.stringify(entry.errors).slice(0, 200) : (entry.status || 'unknown error')),
    };
  });
}

/**
 * Posts to all three platforms in a single Ayrshare call. Returns
 * { results: [{platform, ok, postId, errorCode}], allFailed }. Throws only on
 * a genuine network-level failure (DNS/connection) — an Ayrshare-side error
 * response is captured in `results`, not thrown, per design doc §9.
 */
async function postToAllPlatforms(captions, mediaUrl) {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) throw new Error('AYRSHARE_API_KEY is not set');
  const payload = JSON.stringify(buildPostPayload(captions, mediaUrl));
  const res = await request({
    hostname: API_HOST,
    path: '/api/post',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  const results = parsePostResponse(res.status, res.body);
  return { results, allFailed: results.every((r) => !r.ok) };
}

module.exports = { PLATFORMS, buildPostPayload, parsePostResponse, postToAllPlatforms };

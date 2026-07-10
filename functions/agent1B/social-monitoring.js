'use strict';

/**
 * Read-only community monitoring for the Intelligence Cycle (design doc §4.2
 * Step 2): "Search priority communities on Facebook and LinkedIn for
 * educators, childcare workers, faith community leaders, and mission-aligned
 * advocates... Use read-only API tokens. Do not engage directly from this
 * function."
 *
 * UNCONFIRMED (flagged in DEPLOY.md): the design doc names the two tools
 * (FACEBOOK_READ_TOKEN, LINKEDIN_READ_TOKEN) and their read-only purpose but
 * gives no endpoint/query schema — unlike Ayrshare/Zoho, which have
 * documented, conventional APIs used elsewhere in this codebase. This module
 * implements a reasonable interpretation (Facebook Graph API keyword search
 * over Pages/Groups; a configurable LinkedIn search endpoint) behind a thin,
 * deps-injectable interface so orchestrate.js and its tests never depend on
 * the exact shape — only `normalizeCandidate()` needs to change if the real
 * account's response differs. Confirm the actual endpoints/scopes with
 * Parmeet before Week 2.
 */

const https = require('https');

const FACEBOOK_API_HOST = process.env.FACEBOOK_GRAPH_API_HOST || 'graph.facebook.com';
const FACEBOOK_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v19.0';
const LINKEDIN_API_HOST = process.env.LINKEDIN_API_HOST || 'api.linkedin.com';

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

/** Normalizes one raw search hit into { name, profileUrl, platform, snippet }. Pure. */
function normalizeCandidate(platform, raw) {
  if (platform === 'facebook') {
    return {
      platform: 'facebook',
      name: raw.name || '',
      profileUrl: raw.link || (raw.id ? `https://www.facebook.com/${raw.id}` : ''),
      snippet: raw.about || raw.category || '',
    };
  }
  return {
    platform: 'linkedin',
    name: raw.name || raw.localizedFirstName || '',
    profileUrl: raw.publicProfileUrl || raw.profileUrl || '',
    snippet: raw.headline || '',
  };
}

/** Read-only Facebook Graph API keyword search over Pages. Returns [] on any failure — never throws. */
async function searchFacebookCommunity(keyword) {
  const token = process.env.FACEBOOK_READ_TOKEN;
  if (!token) return [];
  const path = `/${FACEBOOK_API_VERSION}/search?q=${encodeURIComponent(keyword)}&type=page&fields=name,link,about,category&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await request({ hostname: FACEBOOK_API_HOST, path, method: 'GET' });
    if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) return [];
    return res.body.data.map((raw) => normalizeCandidate('facebook', raw));
  } catch {
    return [];
  }
}

/** Read-only LinkedIn keyword search. Returns [] on any failure — never throws. */
async function searchLinkedInCommunity(keyword) {
  const token = process.env.LINKEDIN_READ_TOKEN;
  if (!token) return [];
  const path = `/v2/search?keywords=${encodeURIComponent(keyword)}`;
  try {
    const res = await request({
      hostname: LINKEDIN_API_HOST,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200 || !res.body || !Array.isArray(res.body.elements)) return [];
    return res.body.elements.map((raw) => normalizeCandidate('linkedin', raw));
  } catch {
    return [];
  }
}

/** Searches both platforms for one keyword/community. Never throws. */
async function searchCommunity(keyword) {
  const [fb, li] = await Promise.all([searchFacebookCommunity(keyword), searchLinkedInCommunity(keyword)]);
  return [...fb, ...li];
}

/**
 * Design doc §5.1 warm-follow monitoring: recent post text from ONE specific
 * Stage 1 VIP Prospect's profile (distinct from the community keyword search
 * above, and from zoho-social.js's "who engaged with Gracelyn's own posts").
 * UNCONFIRMED — same caveat as the rest of this module: exact endpoint/scope
 * needs confirmation with Parmeet (profile-level read access may require a
 * different Graph/LinkedIn permission than the community search above).
 * Returns [] on any failure or missing token — never throws.
 */
async function fetchRecentPostsForProfile(profileUrl) {
  const isFacebook = /facebook\.com/i.test(profileUrl || '');
  const isLinkedIn = /linkedin\.com/i.test(profileUrl || '');
  if (isFacebook) {
    const token = process.env.FACEBOOK_READ_TOKEN;
    if (!token) return [];
    try {
      const res = await request({
        hostname: FACEBOOK_API_HOST,
        path: `/${FACEBOOK_API_VERSION}/posts?fields=message,permalink_url&access_token=${encodeURIComponent(token)}&profile=${encodeURIComponent(profileUrl)}`,
        method: 'GET',
      });
      if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) return [];
      return res.body.data.map((p) => ({ text: p.message || '', url: p.permalink_url || profileUrl }));
    } catch {
      return [];
    }
  }
  if (isLinkedIn) {
    const token = process.env.LINKEDIN_READ_TOKEN;
    if (!token) return [];
    try {
      const res = await request({
        hostname: LINKEDIN_API_HOST,
        path: `/v2/shares?profile=${encodeURIComponent(profileUrl)}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200 || !res.body || !Array.isArray(res.body.elements)) return [];
      return res.body.elements.map((p) => ({ text: p.text || p.commentary || '', url: p.permalink || profileUrl }));
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = {
  normalizeCandidate, searchFacebookCommunity, searchLinkedInCommunity, searchCommunity,
  fetchRecentPostsForProfile,
};

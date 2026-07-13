'use strict';

/**
 * Anthropic Claude client for Agent 2 (design §7).
 *   - classifyMotivation()      → Function D1, max_tokens 10, retry once on an
 *                                  invalid tag then fall back to 'Unknown' (§10).
 *   - generateVIPParagraph()    → Function B4-VIP welcome email personalization.
 *
 * No SDK dependency: raw https to the Messages API, same pattern as agent0/claude.js.
 */

const https = require('https');
const M = require('./manifest');
const {
  buildMotivationClassifierPrompt, validateMotivationTag,
  buildVIPPersonalizationPrompt, buildVIPPersonalizationUser,
} = require('./prompts');

const API_HOST = process.env.ANTHROPIC_API_HOST || 'api.anthropic.com';
const API_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function model() {
  return M.getEnv('ANTHROPIC_MODEL') || DEFAULT_MODEL;
}

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

async function callMessages({ system, user, maxTokens }) {
  const apiKey = M.getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const payload = JSON.stringify({
    model: model(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const res = await request({
    hostname: API_HOST,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
  }, payload);

  if (res.status !== 200 || !res.body || typeof res.body === 'string') {
    const detail = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    throw new Error(`Claude API HTTP ${res.status}: ${String(detail).slice(0, 300)}`);
  }
  const blocks = Array.isArray(res.body.content) ? res.body.content : [];
  return blocks.filter((b) => b && b.type === 'text').map((b) => b.text).join('').trim();
}

/**
 * Function D1 — classify motivation from the Part 3 discovery responses.
 * Retries once on an invalid tag (§10), then falls back to 'Unknown' and flags
 * for manual review — never throws.
 *
 * @returns {{tag, needsReview, raw, attempts}}
 */
async function classifyMotivation(discoveryResponse) {
  const system = buildMotivationClassifierPrompt();
  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw;
    try {
      raw = await callMessages({ system, user: discoveryResponse, maxTokens: 10 });
    } catch (err) {
      if (attempt === 2) return { tag: 'Unknown', needsReview: true, raw: null, attempts: attempt, apiError: err.message };
      continue;
    }
    const tag = raw.trim();
    if (validateMotivationTag(tag) === tag) return { tag, needsReview: false, raw, attempts: attempt };
    if (attempt === 2) return { tag: 'Unknown', needsReview: true, raw, attempts: attempt };
  }
  return { tag: 'Unknown', needsReview: true, raw: null, attempts: 2 };
}

/** Function B4-VIP — 2-3 sentence VIP welcome personalization paragraph. */
async function generateVIPParagraph({ ambassador, voiceGuidelines }) {
  return callMessages({
    system: buildVIPPersonalizationPrompt(voiceGuidelines || ''),
    user: buildVIPPersonalizationUser(ambassador),
    maxTokens: 300,
  });
}

module.exports = { classifyMotivation, generateVIPParagraph, model, DEFAULT_MODEL };

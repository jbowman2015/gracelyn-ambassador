'use strict';

/**
 * Anthropic Claude client for Agent 1B — caption generation only (design doc
 * §4.1 Step 4, §7.1). No SDK dependency: raw https to the Messages API, same
 * pattern as functions/agent0/claude.js and functions/agent1A/personalize.js.
 * Model defaults to claude-sonnet-4-20250514 per CLAUDE.md unless
 * ANTHROPIC_MODEL overrides.
 */

const https = require('https');
const { buildCaptionSystemPrompt, buildCaptionUserPrompt } = require('./prompts');

const API_HOST = process.env.ANTHROPIC_API_HOST || 'api.anthropic.com';
const API_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function model() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
 * Tolerant JSON extraction: strips ```json fences and pulls the first {...} block.
 * Returns the parsed object or null (caller applies the design doc §9 fallback).
 */
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch { /* give up */ }
  }
  return null;
}

/** Non-empty-string check for each of the three required caption fields. */
function hasAllCaptions(parsed) {
  return !!parsed
    && typeof parsed.linkedin === 'string' && parsed.linkedin.trim() !== ''
    && typeof parsed.facebook === 'string' && parsed.facebook.trim() !== ''
    && typeof parsed.instagram === 'string' && parsed.instagram.trim() !== '';
}

/**
 * Generates the three platform captions (design doc §4.1 Step 4). Never
 * throws for a bad/non-JSON model response — design doc §9: "Log raw
 * response. Send Parmeet alert. Skip this post cycle run. Do not post
 * without valid captions." Only a network/API-level failure throws (caller
 * applies the same skip-and-alert handling).
 *
 * @returns {{ok: boolean, captions: {linkedin,facebook,instagram}|null, raw: string|null, error?: string}}
 */
async function generateCaptions(assetDescription, copyRules, voiceGuidelines, caller = callMessages) {
  const raw = await caller({
    system: buildCaptionSystemPrompt(copyRules, voiceGuidelines),
    user: buildCaptionUserPrompt(assetDescription),
    maxTokens: 500,
  });
  const parsed = extractJson(raw);
  if (!hasAllCaptions(parsed)) {
    return { ok: false, captions: null, raw, error: 'Claude response was not valid JSON with linkedin/facebook/instagram fields' };
  }
  return {
    ok: true,
    captions: { linkedin: parsed.linkedin, facebook: parsed.facebook, instagram: parsed.instagram },
    raw,
  };
}

module.exports = { generateCaptions, extractJson, hasAllCaptions, callMessages, model, DEFAULT_MODEL };

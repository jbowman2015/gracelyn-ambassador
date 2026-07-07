'use strict';

/**
 * Anthropic Claude client for Agent 0.
 *
 * Two calls (design §7):
 *   - assessProspect()     → JSON assessment (Step 7, max_tokens 500)
 *   - generateVIPBriefing()→ plain-text briefing (Step 9, max_tokens 800)
 *
 * No SDK dependency: raw https to the Messages API. Model defaults to
 * claude-sonnet-4-20250514 per CLAUDE.md unless ANTHROPIC_MODEL overrides.
 */

const https = require('https');
const M = require('./manifest');
const { buildAssessmentSystemPrompt, buildVIPBriefingSystemPrompt } = require('./prompts');

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

/** POST /v1/messages and return the concatenated text of the first content blocks. */
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
 * Tolerant JSON extraction: strips ```json fences and pulls the first {...} block.
 * Returns the parsed object or null (caller applies safe defaults).
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

/**
 * Step 7 — assess a prospect. Never throws for a bad model response: returns a
 * structured result the pipeline can route on.
 *
 * @returns {{ok, parsed, assessment, raw, error}}
 *   ok=false, error='parse' → safe defaults in .assessment, flag Parse_Error.
 *   ok=false, error='api'   → API/network failure (caller decides retry/skip).
 */
async function assessProspect(prospectProfileText) {
  let raw;
  try {
    raw = await callMessages({
      system: buildAssessmentSystemPrompt(),
      user: prospectProfileText,
      maxTokens: 500,
    });
  } catch (err) {
    return { ok: false, error: 'api', raw: null, parsed: null,
      assessment: { ...M.SAFE_ASSESSMENT_DEFAULTS }, apiError: err.message };
  }
  const parsed = extractJson(raw);
  if (!parsed) {
    return { ok: false, error: 'parse', raw, parsed: null,
      assessment: { ...M.SAFE_ASSESSMENT_DEFAULTS } };
  }
  // Normalize/guard the fields the pipeline relies on.
  const assessment = {
    motivationHypothesis: str(parsed.motivationHypothesis),
    motivationRationale: str(parsed.motivationRationale),
    roleCategory: str(parsed.roleCategory),
    missionAlignmentScore: num(parsed.missionAlignmentScore),
    orgInfluenceScore: num(parsed.orgInfluenceScore),
    notes: str(parsed.notes),
  };
  return { ok: true, error: null, raw, parsed, assessment };
}

/**
 * Step 9 — generate the VIP briefing plain-text document. Throws on API failure
 * so the caller can apply the design's retry-once-then-alert policy.
 */
async function generateVIPBriefing({ voiceGuidelines, prospectContext }) {
  return callMessages({
    system: buildVIPBriefingSystemPrompt(voiceGuidelines || ''),
    user: prospectContext,
    maxTokens: 800,
  });
}

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

module.exports = { assessProspect, generateVIPBriefing, extractJson, model, DEFAULT_MODEL };

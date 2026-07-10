'use strict';

/**
 * Anthropic Claude client for Agent 1C.
 *
 * One call only (design §5.1): the weekly audience targeting recommendation.
 * Agent 1C does NOT use Claude for ad creative — Parmeet manages that directly
 * in Meta/Google dashboards (design §2.3, §9.3).
 *
 * No SDK dependency: raw https to the Messages API. Model defaults to
 * claude-sonnet-4-20250514 per CLAUDE.md unless ANTHROPIC_MODEL overrides.
 */

const https = require('https');
const M = require('./manifest');

const API_HOST = process.env.ANTHROPIC_API_HOST || 'api.anthropic.com';
const API_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function model() { return M.getEnv('ANTHROPIC_MODEL') || DEFAULT_MODEL; }

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

function buildSystemPrompt() {
  return [
    'You are analyzing ambassador recruiting campaign performance data for',
    'Gracelyn University to generate a weekly targeting recommendation.',
    '',
    'Gracelyn is a DEAC-accredited online Christian university serving K-12 educators.',
    'The ambassador program recruits educators, childcare workers, faith community',
    'leaders, and mission-aligned advocates who share Gracelyn with their networks.',
    '',
    'Based on the prospect data and spend history provided, produce a brief',
    '(3-5 bullet points) targeting recommendation for the coming week.',
    '',
    'Focus on: which audience segments are producing the most prospects,',
    'which platforms are most cost-efficient, and one specific adjustment',
    'to consider for the coming week.',
    '',
    'Be specific and actionable. No preamble. Bullet points only.',
    'No em dashes. No commission language.',
  ].join('\n');
}

/**
 * Design §5.1 — weekly audience recommendation. Throws on API failure so the
 * caller applies the §7 policy (skip recommendation, note the failure, alert
 * only after three consecutive weekly failures).
 */
async function generateAudienceRecommendation(segmentSummary, spendHistory) {
  const apiKey = M.getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const userPrompt = [
    'PROSPECT SEGMENT DATA (last 30 days):',
    JSON.stringify(segmentSummary, null, 2),
    '',
    'SPEND HISTORY (last 7 days):',
    JSON.stringify(spendHistory, null, 2),
    '',
    'Generate a weekly targeting recommendation.',
  ].join('\n');

  const payload = JSON.stringify({
    model: model(),
    max_tokens: 400,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
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

module.exports = { generateAudienceRecommendation, buildSystemPrompt, model, DEFAULT_MODEL };

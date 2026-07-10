'use strict';

/**
 * Anthropic Claude client for Agent 3 — generates every sprint and
 * standard-cycle email fresh (design §1: "Highest token usage agent in the
 * system"). No SDK dependency: raw https to the Messages API. Model defaults
 * to claude-sonnet-4-20250514 per CLAUDE.md unless ANTHROPIC_MODEL overrides.
 */

const https = require('https');
const M = require('./manifest');

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

/** POST /v1/messages and return the concatenated text of the content blocks. */
async function callMessages({ system, user, maxTokens = 400 }) {
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

/** Generate an email body from a (system, user) prompt pair. Throws on API failure. */
async function generateEmail({ system, user, maxTokens = 400 }) {
  return callMessages({ system, user, maxTokens });
}

module.exports = { callMessages, generateEmail, model, DEFAULT_MODEL };

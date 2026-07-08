'use strict';

/**
 * Anthropic Claude client for Agent 1D — Step 6 (design §4, §5.1): one
 * personalized opening sentence for the delivery email. No SDK dependency:
 * raw https to the Messages API, same shape as functions/agent0/claude.js.
 * Model defaults to claude-sonnet-4-20250514 per CLAUDE.md.
 */

const https = require('https');
const M = require('./manifest');
const { buildOpeningPrompt } = require('./prompts');

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
 * Strip a leading/trailing quote or stray markdown a model sometimes adds,
 * and collapse to a single line — the prompt already asks for one sentence,
 * this just guards the em-dash / preamble rules the design doc requires.
 */
function cleanSentence(text) {
  let t = String(text || '').trim().split('\n')[0].trim();
  t = t.replace(/^["'`]+|["'`]+$/g, '').trim();
  return t;
}

/**
 * Step 6 — generate the personalized opening sentence. Never throws: on any
 * API failure or empty response, returns the design's fallback sentence and
 * `ok: false` so the pipeline can log it without aborting the send (design §8).
 */
async function generateOpeningSentence({ firstName, roleCategory, audienceTrack, leadMagnetName }) {
  const { system, user } = buildOpeningPrompt(firstName, roleCategory, audienceTrack, leadMagnetName);
  try {
    const raw = await callMessages({ system, user, maxTokens: 200 });
    const sentence = cleanSentence(raw);
    if (!sentence) throw new Error('empty response');
    return { ok: true, sentence, error: null };
  } catch (err) {
    return { ok: false, sentence: M.FALLBACK_OPENING_SENTENCE(firstName), error: err.message };
  }
}

module.exports = { generateOpeningSentence, cleanSentence, model, DEFAULT_MODEL };

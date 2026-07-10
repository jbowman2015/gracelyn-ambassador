'use strict';

/**
 * OpenAI Assistants API (v2) client for Agent 5 (design §1, §4 Steps 6-7, §13).
 *
 * Agent 5 extends the ambassador knowledge base assistant Parmeet configures
 * (OPENAI_AMBASSADOR_ASSISTANT_ID) — this module only manages threads/messages/
 * runs against it, never the assistant definition itself.
 *
 * No SDK dependency: raw https to api.openai.com. Requires the
 * `OpenAI-Beta: assistants=v2` header on every Assistants endpoint.
 */

const https = require('https');
const M = require('./manifest');

const API_HOST = process.env.OPENAI_API_HOST || 'api.openai.com';
const ASSISTANTS_BETA_HEADER = 'assistants=v2';

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

function headers(extra) {
  const apiKey = M.getEnv('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return {
    Authorization: `Bearer ${apiKey}`,
    'OpenAI-Beta': ASSISTANTS_BETA_HEADER,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function call(method, path, payload) {
  const body = payload ? JSON.stringify(payload) : null;
  const h = headers(body ? { 'Content-Length': Buffer.byteLength(body) } : {});
  return request({ hostname: API_HOST, path: `/v1${path}`, method, headers: h }, body);
}

/** Create a new thread. Returns the thread id. */
async function createThread() {
  const res = await call('POST', '/threads', {});
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error(`OpenAI thread creation failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body.id;
}

/** Retrieve a thread by id. Returns null if not found (so the caller can create a new one). */
async function getThread(threadId) {
  if (!threadId) return null;
  const res = await call('GET', `/threads/${encodeURIComponent(threadId)}`);
  if (res.status === 404) return null;
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error(`OpenAI thread lookup failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

/** Add a user message to a thread. */
async function addMessage(threadId, content) {
  const res = await call('POST', `/threads/${encodeURIComponent(threadId)}/messages`, { role: 'user', content });
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error(`OpenAI message add failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

/** Create a run on a thread with the ambassador assistant. */
async function createRun(threadId, { assistantId, additionalInstructions } = {}) {
  const payload = { assistant_id: assistantId };
  if (additionalInstructions) payload.additional_instructions = additionalInstructions;
  const res = await call('POST', `/threads/${encodeURIComponent(threadId)}/runs`, payload);
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error(`OpenAI run creation failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

async function getRun(threadId, runId) {
  const res = await call('GET', `/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`);
  if (res.status !== 200 || !res.body || !res.body.id) {
    throw new Error(`OpenAI run lookup failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}

/** Latest assistant message's concatenated text content, or ''. */
async function getLatestAssistantMessage(threadId) {
  const res = await call('GET', `/threads/${encodeURIComponent(threadId)}/messages?limit=5&order=desc`);
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.data)) {
    throw new Error(`OpenAI messages fetch failed (HTTP ${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  const msg = res.body.data.find((m) => m.role === 'assistant');
  if (!msg) return '';
  return (msg.content || [])
    .filter((c) => c.type === 'text' && c.text && c.text.value)
    .map((c) => c.text.value)
    .join('\n')
    .trim();
}

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'expired'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll a run until it reaches a terminal status or maxAttempts is exhausted
 * (design §4 Step 7: 2s interval, 30s / 15 attempts max). `sleep` is injectable
 * for tests. Returns the final run object, with `timedOut: true` added if the
 * poll exhausted its attempts without reaching a terminal status.
 */
async function pollRunCompletion(threadId, runId, { intervalMs, maxAttempts, sleep = wait, deps = {} } = {}) {
  const getRunFn = (deps.getRun) || getRun;
  const interval = intervalMs || Number(M.getEnv('OPENAI_POLL_INTERVAL_MS')) || M.DEFAULT_OPENAI_POLL_INTERVAL_MS;
  const attempts = maxAttempts || Number(M.getEnv('OPENAI_POLL_MAX_ATTEMPTS')) || M.DEFAULT_OPENAI_POLL_MAX_ATTEMPTS;

  let run = await getRunFn(threadId, runId);
  let n = 1;
  while (!TERMINAL_STATUSES.includes(run.status) && n < attempts) {
    await sleep(interval);
    run = await getRunFn(threadId, runId);
    n += 1;
  }
  if (!TERMINAL_STATUSES.includes(run.status)) return { ...run, timedOut: true };
  return run;
}

/**
 * High-level turn: resolve/create the thread, add the message, run the
 * assistant, poll to completion, and fetch the response text (design Steps
 * 6-7). All sub-calls are injectable via `deps` for offline tests.
 *
 * Returns one of:
 *   { ok: true, threadId, responseText }
 *   { ok: false, reason: 'thread_error' | 'run_failed' | 'run_timeout', threadId, error, runId? }
 */
async function runAssistantTurn({ threadId, message, additionalInstructions, deps = {} } = {}) {
  const getThreadFn = deps.getThread || getThread;
  const createThreadFn = deps.createThread || createThread;
  const addMessageFn = deps.addMessage || addMessage;
  const createRunFn = deps.createRun || createRun;
  const pollFn = deps.pollRunCompletion || pollRunCompletion;
  const getLatestFn = deps.getLatestAssistantMessage || getLatestAssistantMessage;
  const assistantId = M.getEnv('OPENAI_AMBASSADOR_ASSISTANT_ID');

  let resolvedThreadId;
  try {
    const existing = threadId ? await getThreadFn(threadId) : null;
    resolvedThreadId = existing ? existing.id : await createThreadFn();
  } catch (err) {
    return { ok: false, reason: 'thread_error', threadId: null, error: err.message };
  }

  try {
    await addMessageFn(resolvedThreadId, message);
  } catch (err) {
    return { ok: false, reason: 'thread_error', threadId: resolvedThreadId, error: err.message };
  }

  let run;
  try {
    run = await createRunFn(resolvedThreadId, { assistantId, additionalInstructions });
  } catch (err) {
    return { ok: false, reason: 'run_failed', threadId: resolvedThreadId, error: err.message };
  }

  const finalRun = await pollFn(resolvedThreadId, run.id, { deps });
  if (finalRun.timedOut) {
    return { ok: false, reason: 'run_timeout', threadId: resolvedThreadId, runId: run.id, error: 'run did not complete within the poll window' };
  }
  if (finalRun.status !== 'completed') {
    const detail = finalRun.last_error ? `${finalRun.last_error.code}: ${finalRun.last_error.message}` : finalRun.status;
    return { ok: false, reason: 'run_failed', threadId: resolvedThreadId, runId: run.id, error: detail };
  }

  try {
    const responseText = await getLatestFn(resolvedThreadId);
    return { ok: true, threadId: resolvedThreadId, responseText };
  } catch (err) {
    return { ok: false, reason: 'run_failed', threadId: resolvedThreadId, runId: run.id, error: err.message };
  }
}

module.exports = {
  createThread,
  getThread,
  addMessage,
  createRun,
  getRun,
  getLatestAssistantMessage,
  pollRunCompletion,
  runAssistantTurn,
  TERMINAL_STATUSES,
};

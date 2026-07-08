'use strict';

/**
 * Agent 1D tests — no network, no deps, no secrets.
 * Run: node __tests__/agent1d.test.js
 *
 * Covers §10.1: submission validation, audience-track routing (all 4 prefixes
 * + unknown), lead magnet link lookup (valid/invalid), dedup create vs update,
 * Claude opening sentence (all 4 tracks + failure fallback), delivery email
 * format, Agent 1A handoff webhook payload, and nightly cleanup recovery.
 */

const assert = require('assert');
const M = require('../manifest');
const { parseAndValidateSubmission } = require('../validate');
const { resolveAudienceTrack } = require('../routing');
const emailBuilder = require('../email');
const prompts = require('../prompts');
const claudeClient = require('../claude');
const { processSubmission } = require('../pipeline');
const { runNightlyCleanup } = require('../cleanup');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

function baseEnv() {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.PROSPECTS_MODULE_API_NAME = 'Ambassador_Leads';
  process.env.WORKDRIVE_FOLDER_06_ID = 'folder06';
  process.env.WORKDRIVE_FOLDER_08_ID = 'folder08';
  process.env.LEAD_MAGNET_MAP = JSON.stringify({
    lm_k12_selfcare: 'k12-educator/selfcare-guide.pdf',
  });
  process.env.LEAD_CAPTURE_FORM_IDS = JSON.stringify(['owner/k12form']);
  process.env.AGENT1D_DELIVERY_EMAIL_SUBJECT = 'Your [RESOURCE_NAME] from Gracelyn';
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
  process.env.MAKE_AGENT1A_FROM_1D_WEBHOOK_URL = 'https://hooks.example.com/1a';
  process.env.MAKE_AGENT1D_ERROR_WEBHOOK = 'https://hooks.example.com/error';
}
function clearEnv() {
  for (const k of ['ANTHROPIC_API_KEY', 'PROSPECTS_MODULE_API_NAME', 'WORKDRIVE_FOLDER_06_ID',
    'WORKDRIVE_FOLDER_08_ID', 'LEAD_MAGNET_MAP', 'LEAD_CAPTURE_FORM_IDS',
    'AGENT1D_DELIVERY_EMAIL_SUBJECT', 'PARMEET_ALERT_EMAIL',
    'MAKE_AGENT1A_FROM_1D_WEBHOOK_URL', 'MAKE_AGENT1D_ERROR_WEBHOOK']) {
    delete process.env[k];
  }
}

function makeDeps(overrides = {}) {
  const calls = { creates: [], updates: [], mails: [], webhooks: [], alerts: [] };
  const existingByEmail = overrides.existingByEmail || {};

  const fakeZoho = {
    resetToken() {},
    async getCrmToken() { return 'crm-token'; },
    async resolveModuleApiName() { return { apiName: 'Ambassador_Leads', divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async findByDedupKey(mod, field, value) { return existingByEmail[value] || null; },
    async createRecord(mod, record) { calls.creates.push(record); return { id: 'new-1', op: 'create' }; },
    async updateRecord(mod, id, record) { calls.updates.push({ id, record }); return { id, op: 'update' }; },
    ...overrides.zoho,
  };
  const fakeWorkdrive = {
    resetToken() {},
    async getWorkDriveToken() { return 'wd-token'; },
    async readBrandAsset() { return 'COPY RULES'; },
    async resolveLeadMagnetLink(folder, map, leadMagnetId) {
      const path = map[leadMagnetId];
      if (!path) return { url: null, resourceName: null, reason: 'lead_magnet_id not in LEAD_MAGNET_MAP' };
      return { url: `https://workdrive.example.com/share/${leadMagnetId}`, resourceName: path.split('/').pop(), reason: null };
    },
    ...overrides.workdrive,
  };
  const fakeMail = {
    resetToken() {},
    async getMailToken() { return 'mail-token'; },
    async sendMail(to, subject, body) { calls.mails.push({ to, subject, body }); return { status: { code: 200 } }; },
    ...overrides.mail,
  };
  const fakeClaude = {
    async generateOpeningSentence({ firstName }) {
      return { ok: true, sentence: `Hi ${firstName}, this one is for you.`, error: null };
    },
    ...overrides.claude,
  };
  const fakeWebhooks = {
    async fireWebhook(url, payload) { calls.webhooks.push({ url, payload }); return { ok: true, status: 200, attempts: 1 }; },
    ...overrides.webhooks,
  };
  const fakeAlerts = {
    async sendAlert(a) { calls.alerts.push(a); return { delivered: true }; },
    ...overrides.alerts,
  };

  const deps = {
    zoho: fakeZoho, workdrive: fakeWorkdrive, mail: fakeMail, claude: fakeClaude,
    webhooks: fakeWebhooks, alerts: fakeAlerts, wait: async () => {},
  };
  return { deps, calls };
}

function validSubmission(overrides = {}) {
  return {
    first_name: 'Taylor', email: 'taylor@example.com', role_category: 'K12 Educator',
    state: 'TX', lead_magnet_id: 'lm_k12_selfcare', utm_source: 'facebook', utm_campaign: 'summer26',
    ...overrides,
  };
}

// ─── Step 1: submission validation ───────────────────────────────────────────
test('validation fails on missing email', () => {
  const { valid, errors } = parseAndValidateSubmission({ lead_magnet_id: 'lm_k12_x' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => /email/.test(e)));
});

test('validation fails on missing lead_magnet_id', () => {
  const { valid, errors } = parseAndValidateSubmission({ email: 'a@b.com' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => /lead_magnet_id/.test(e)));
});

test('validation passes with email + lead_magnet_id present', () => {
  const { valid, submission } = parseAndValidateSubmission(validSubmission());
  assert.strictEqual(valid, true);
  assert.strictEqual(submission.email, 'taylor@example.com');
});

// ─── Step 3: audience track routing ──────────────────────────────────────────
test('audience track routing — all four prefixes + unknown', () => {
  assert.strictEqual(resolveAudienceTrack('lm_k12_test'), M.AUDIENCE_TRACKS.k12);
  assert.strictEqual(resolveAudienceTrack('lm_ec_test'), M.AUDIENCE_TRACKS.earlyChildhood);
  assert.strictEqual(resolveAudienceTrack('lm_faith_test'), M.AUDIENCE_TRACKS.faithCommunity);
  assert.strictEqual(resolveAudienceTrack('lm_youth_test'), M.AUDIENCE_TRACKS.youthServing);
  assert.strictEqual(resolveAudienceTrack('lm_unknown_test'), M.AUDIENCE_TRACKS.unknown);
  assert.strictEqual(resolveAudienceTrack(''), M.AUDIENCE_TRACKS.unknown);
});

// ─── prompts / Claude ─────────────────────────────────────────────────────────
test('opening prompt forbids em dashes and enforces one sentence', () => {
  const { system } = prompts.buildOpeningPrompt('Taylor', 'K12 Educator', M.AUDIENCE_TRACKS.k12, 'Self-Care Guide');
  assert.ok(/no em dashes/i.test(system));
  assert.ok(/exactly one sentence/i.test(system));
  assert.ok(!system.includes('—'));
});

test('opening prompt includes track tone framing for all four tracks', () => {
  for (const track of Object.values(M.AUDIENCE_TRACKS)) {
    if (track === M.AUDIENCE_TRACKS.unknown) continue;
    const { system } = prompts.buildOpeningPrompt('Taylor', 'Role', track, 'Resource');
    assert.ok(system.includes(M.DELIVERY_FRAMING[track].tone), `missing tone for ${track}`);
  }
});

test('claude.cleanSentence strips quotes and stray lines', () => {
  assert.strictEqual(claudeClient.cleanSentence('"Hello there."\nextra line'), 'Hello there.');
  assert.strictEqual(claudeClient.cleanSentence('"Hello there."'), 'Hello there.');
});

// ─── email builders ───────────────────────────────────────────────────────────
test('buildSubject substitutes [RESOURCE_NAME]', () => {
  assert.strictEqual(
    emailBuilder.buildSubject('Your [RESOURCE_NAME] from Gracelyn', 'Self-Care Guide'),
    'Your Self-Care Guide from Gracelyn',
  );
});

test('buildBody falls back to the design fallback message with no link', () => {
  const body = emailBuilder.buildBody({ openingSentence: 'Hi Taylor.', downloadUrl: null, resourceName: null, audienceTrack: M.AUDIENCE_TRACKS.k12 });
  assert.ok(body.includes(M.FALLBACK_LEAD_MAGNET_MESSAGE));
  assert.ok(body.includes('Hi Taylor.'));
});

test('buildBody includes the download link and track closing line', () => {
  const body = emailBuilder.buildBody({
    openingSentence: 'Hi Taylor.', downloadUrl: 'https://x.example.com/f', resourceName: 'selfcare-guide.pdf',
    audienceTrack: M.AUDIENCE_TRACKS.earlyChildhood,
  });
  assert.ok(body.includes('https://x.example.com/f'));
  assert.ok(body.includes(M.DELIVERY_FRAMING[M.AUDIENCE_TRACKS.earlyChildhood].closing));
});

// ─── pipeline: full run with injected fakes ──────────────────────────────────
test('new prospect: create with all Step 5a fields, email sent, handoff fired', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(calls.creates.length, 1);
  const rec = calls.creates[0];
  assert.strictEqual(rec[M.PROSPECT_FIELDS.email], 'taylor@example.com');
  assert.strictEqual(rec[M.PROSPECT_FIELDS.audienceTrack], M.AUDIENCE_TRACKS.k12);
  assert.strictEqual(rec[M.PROSPECT_FIELDS.outreachStatus], 'Standard');
  assert.strictEqual(rec[M.PROSPECT_FIELDS.recruitingSource], 'Agent 1D');
  assert.strictEqual(rec[M.PROSPECT_FIELDS.recruitingChannel], 'lm_k12_selfcare');
  assert.strictEqual(rec[M.PROSPECT_FIELDS.contactFound], true);
  assert.strictEqual(calls.mails.length, 1);
  assert.strictEqual(calls.webhooks.length, 1);
  assert.strictEqual(calls.webhooks[0].payload.audience_track, M.AUDIENCE_TRACKS.k12);
  assert.strictEqual(calls.webhooks[0].payload.type, 'lead_capture_new_contact');
  clearEnv();
});

test('duplicate prospect: update appends Lead_Magnets_Downloaded, no new record', async () => {
  baseEnv();
  const existing = {
    id: 'existing-1',
    [M.PROSPECT_FIELDS.leadMagnetsDownloaded]: 'lm_k12_other',
    [M.PROSPECT_FIELDS.audienceTrack]: M.AUDIENCE_TRACKS.k12,
  };
  const { deps, calls } = makeDeps({ existingByEmail: { 'taylor@example.com': existing } });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(calls.creates.length, 0);
  assert.strictEqual(calls.updates.length, 1);
  assert.strictEqual(calls.updates[0].record[M.PROSPECT_FIELDS.leadMagnetsDownloaded], 'lm_k12_other,lm_k12_selfcare');
  assert.strictEqual(calls.updates[0].record[M.PROSPECT_FIELDS.outreachStatus], undefined, 'must not overwrite Outreach_Status');
  assert.strictEqual(calls.updates[0].record[M.PROSPECT_FIELDS.recruitingSource], undefined, 'must not overwrite Recruiting_Source');
  clearEnv();
});

test('duplicate prospect: Audience_Track upgraded only when previously Unknown', async () => {
  baseEnv();
  const existing = { id: 'existing-2', [M.PROSPECT_FIELDS.audienceTrack]: M.AUDIENCE_TRACKS.unknown };
  const { deps, calls } = makeDeps({ existingByEmail: { 'taylor@example.com': existing } });
  await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(calls.updates[0].record[M.PROSPECT_FIELDS.audienceTrack], M.AUDIENCE_TRACKS.k12);
  clearEnv();
});

test('unrecognized lead_magnet_id prefix: Audience_Track Unknown, alert fires, record still created', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await processSubmission(validSubmission({ lead_magnet_id: 'lm_other_thing' }), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(calls.creates[0][M.PROSPECT_FIELDS.audienceTrack], M.AUDIENCE_TRACKS.unknown);
  assert.ok(calls.alerts.some((a) => a.errorType === 'Unrecognized lead_magnet_id prefix'));
  clearEnv();
});

test('lead magnet not found: fallback message used, alert fires, CRM record still created', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    workdrive: { async resolveLeadMagnetLink() { return { url: null, resourceName: null, reason: 'file not found at path "x"' }; } },
  });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(calls.creates.length, 1);
  assert.ok(calls.mails[0].body.includes(M.FALLBACK_LEAD_MAGNET_MESSAGE));
  assert.ok(calls.alerts.some((a) => a.errorType === 'Lead magnet file not found'));
  clearEnv();
});

test('Claude failure: fallback opening sentence used, send still proceeds', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    claude: { async generateOpeningSentence({ firstName }) { return { ok: false, sentence: M.FALLBACK_OPENING_SENTENCE(firstName), error: 'API down' }; } },
  });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.ok(calls.mails[0].body.startsWith('Hello Taylor'));
  clearEnv();
});

test('Claude opening sentence generated per track (all four)', async () => {
  baseEnv();
  for (const [magnetId, track] of [
    ['lm_k12_selfcare', M.AUDIENCE_TRACKS.k12],
    ['lm_ec_test', M.AUDIENCE_TRACKS.earlyChildhood],
    ['lm_faith_test', M.AUDIENCE_TRACKS.faithCommunity],
    ['lm_youth_test', M.AUDIENCE_TRACKS.youthServing],
  ]) {
    process.env.LEAD_MAGNET_MAP = JSON.stringify({ [magnetId]: `x/${magnetId}.pdf` });
    const seenTracks = [];
    const { deps } = makeDeps({
      claude: {
        async generateOpeningSentence(args) { seenTracks.push(args.audienceTrack); return { ok: true, sentence: 'Hi.', error: null }; },
      },
    });
    await processSubmission(validSubmission({ lead_magnet_id: magnetId }), { deps, fastRetry: true });
    assert.strictEqual(seenTracks[0], track);
  }
  clearEnv();
});

test('missing CRM fields are surfaced (not silently skipped), record still created', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    zoho: { async verifyFields() { return { missing: ['Audience_Track', 'UTM_Source'] }; } },
  });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.ok(result.errors.some((e) => /Missing Prospects fields/.test(e)));
  assert.ok(calls.alerts.some((a) => a.errorType === 'CRM field divergence'));
  clearEnv();
});

test('CRM create failure after retry: halts, alerts with submission data', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    zoho: { async createRecord() { throw new Error('CRM 500'); } },
  });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.halted, 'Step 5 CRM write');
  assert.ok(calls.alerts.some((a) => a.errorType === 'CRM create/update failure' && a.email === 'taylor@example.com'));
  clearEnv();
});

test('Agent 1A handoff webhook failure is alerted but the run still succeeds', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    webhooks: { async fireWebhook() { return { ok: false, status: 0, attempts: 2, error: 'timeout' }; } },
  });
  const result = await processSubmission(validSubmission(), { deps, fastRetry: true });
  assert.strictEqual(result.success, true);
  assert.ok(calls.alerts.some((a) => a.errorType === 'Agent 1A handoff webhook failure'));
  clearEnv();
});

test('invalid submission never touches CRM', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await processSubmission({ first_name: 'No Email' }, { deps, fastRetry: true });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.halted, 'Step 1 validation');
  assert.strictEqual(calls.creates.length, 0);
  assert.ok(calls.alerts.some((a) => a.errorType === 'Invalid form submission'));
  clearEnv();
});

// ─── nightly cleanup ──────────────────────────────────────────────────────────
test('nightly cleanup recovers a missed submission not yet in CRM', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const fakeForms = {
    async fetchRecentSubmissions() {
      return [{ first_name: 'Morgan', email: 'morgan@example.com', role_category: 'K12 Educator', state: 'TX', lead_magnet_id: 'lm_k12_selfcare', utm_source: '', utm_campaign: '' }];
    },
  };
  const summary = await runNightlyCleanup({ deps: { ...deps, forms: fakeForms }, fastRetry: true });
  assert.strictEqual(summary.checked, 1);
  assert.strictEqual(summary.recovered, 1);
  assert.strictEqual(calls.creates.length, 1);
  assert.ok(calls.alerts.some((a) => a.errorType === 'Nightly cleanup summary'));
  clearEnv();
});

test('nightly cleanup skips a submission already present in CRM', async () => {
  baseEnv();
  const existing = { id: 'already-there' };
  const { deps, calls } = makeDeps({ existingByEmail: { 'morgan@example.com': existing } });
  const fakeForms = {
    async fetchRecentSubmissions() {
      return [{ first_name: 'Morgan', email: 'morgan@example.com', lead_magnet_id: 'lm_k12_selfcare' }];
    },
  };
  const summary = await runNightlyCleanup({ deps: { ...deps, forms: fakeForms }, fastRetry: true });
  assert.strictEqual(summary.checked, 1);
  assert.strictEqual(summary.recovered, 0);
  assert.strictEqual(calls.creates.length, 0);
  clearEnv();
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 1D tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();

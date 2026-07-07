'use strict';

/**
 * Agent 1A test suite — pure logic + orchestration with injected fakes.
 * No network, no deps, no secrets. Run: node __tests__/agent1a.test.js
 */

const assert = require('assert');

const M = require('../manifest');
const criteria = require('../criteria');
const sequencing = require('../sequencing');
const subject = require('../subject');
const templateGuard = require('../template-guard');
const personalize = require('../personalize');
const templates = require('../templates');
const runSummary = require('../run-summary');
const mail = require('../mail');
const reconcile = require('../reconcile');
const alerts = require('../alerts');
const { withRetryOnce } = require('../retry');
const { postRunSummary } = require('../webhook');
const zohoMeta = require('../zoho'); // for monkeypatching in reconcile tests
const { runAgent1A } = require('../orchestrate');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── manifest.js ────────────────────────────────────────────────────────────

test('manifest: VIP suppression uses VIP_Prospect (doc\'s VIP_Flag does not exist)', () => {
  const vipField = M.PROSPECT_FIELDS.find((f) => f.api === 'VIP_Prospect');
  assert.ok(vipField, 'VIP_Prospect field must be declared');
  assert.strictEqual(vipField.docName, 'VIP_Flag');
});

test('manifest: Outreach_Status lifecycle values extend, not replace, Agent 0\'s values', () => {
  assert.deepStrictEqual(M.OUTREACH_STATUS_LIFECYCLE_VALUES, ['Outreach Sent', 'Follow-Up Sent', 'Unresponsive', 'Applied']);
  assert.strictEqual(M.OUTREACH_STATUS_NEW_PROSPECT_VALUE, 'Standard');
  assert.ok(!M.OUTREACH_STATUS_LIFECYCLE_VALUES.includes('Identified'), 'doc\'s "Identified" value does not exist live — must not be used');
});

// ─── criteria.js ────────────────────────────────────────────────────────────

test('criteria: newProspectsCriteria excludes VIP and requires Contact_Found + Standard status', () => {
  const c = criteria.newProspectsCriteria();
  assert.ok(c.includes('VIP_Prospect:equals:false'), c);
  assert.ok(c.includes('Contact_Found:equals:true'), c);
  assert.ok(c.includes('Outreach_Status:equals:Standard'), c);
});

test('criteria: followUpCriteria uses exactly the 7-day mark', () => {
  const today = new Date('2026-07-20T12:00:00Z');
  const c = criteria.followUpCriteria(today);
  assert.ok(c.includes('Sequence_Email_1_Sent_Date:equals:2026-07-13'), c);
  assert.ok(c.includes('Outreach_Status:equals:Outreach Sent'), c);
});

test('criteria: unresponsiveCriteria uses exactly the 14-day mark', () => {
  const today = new Date('2026-07-20T12:00:00Z');
  const c = criteria.unresponsiveCriteria(today);
  assert.ok(c.includes('Sequence_Email_2_Sent_Date:equals:2026-07-06'), c);
  assert.ok(c.includes('Outreach_Status:equals:Follow-Up Sent'), c);
});

test('criteria: dateOnly/daysAgo do not mutate the input Date', () => {
  const today = new Date('2026-07-20T12:00:00Z');
  criteria.daysAgo(today, 7);
  assert.strictEqual(today.toISOString(), '2026-07-20T12:00:00.000Z');
});

// ─── sequencing.js ──────────────────────────────────────────────────────────

test('sequencing: classifyRunMode accepts all four trigger types', () => {
  for (const t of sequencing.VALID_TRIGGER_TYPES) {
    const payload = t === 'lead_capture_new_contact'
      ? { trigger_type: t, prospect_crm_id: 'x', email: 'a@b.com', first_name: 'A', role_category: 'educator', lead_magnet_id: 'm', recruiting_source: 's' }
      : { trigger_type: t, triggered_at: '2026-07-20T09:00:00-06:00' };
    const r = sequencing.classifyRunMode(payload);
    assert.strictEqual(r.ok, true, `${t}: ${r.error}`);
  }
});

test('sequencing: classifyRunMode rejects unknown trigger_type', () => {
  const r = sequencing.classifyRunMode({ trigger_type: 'bogus' });
  assert.strictEqual(r.ok, false);
});

test('sequencing: classifyRunMode rejects lead_capture_new_contact missing required fields', () => {
  const r = sequencing.classifyRunMode({ trigger_type: 'lead_capture_new_contact', email: 'a@b.com' });
  assert.strictEqual(r.ok, false);
  assert.ok(/missing required fields/.test(r.error), r.error);
});

test('sequencing: markEmail1Sent stamps attribution for Agent 2 (design doc §9.2)', () => {
  const today = new Date('2026-07-20T00:00:00Z');
  const rec = sequencing.markEmail1Sent('abc123', today);
  assert.strictEqual(rec.Outreach_Status, 'Outreach Sent');
  assert.strictEqual(rec.Sequence_Email_1_Sent, true);
  assert.strictEqual(rec.Sequence_Email_1_Sent_Date, '2026-07-20');
  assert.strictEqual(rec.Recruiting_Source, 'Agent 1A');
  assert.strictEqual(rec.Recruiting_Channel, 'Email Sequence');
});

test('sequencing: markEmail2Sent sets Follow-Up Sent', () => {
  const rec = sequencing.markEmail2Sent('abc123', new Date('2026-07-20T00:00:00Z'));
  assert.strictEqual(rec.Outreach_Status, 'Follow-Up Sent');
  assert.strictEqual(rec.Sequence_Email_2_Sent, true);
});

test('sequencing: markUnresponsive only touches Outreach_Status', () => {
  const rec = sequencing.markUnresponsive('abc123');
  assert.deepStrictEqual(rec, { id: 'abc123', Outreach_Status: 'Unresponsive' });
});

// ─── subject.js ─────────────────────────────────────────────────────────────

test('subject: buildSubjectLine replaces [FIRST_NAME]', () => {
  assert.strictEqual(subject.buildSubjectLine('Hi [FIRST_NAME], join us', 'Dana'), 'Hi Dana, join us');
});

test('subject: buildSubjectLine falls back to Friend when no first name', () => {
  assert.strictEqual(subject.buildSubjectLine('Hi [FIRST_NAME]', ''), 'Hi Friend');
});

// ─── template-guard.js ──────────────────────────────────────────────────────

const TEMPLATE_3PARA = 'Mission hook paragraph.\n\nSocial proof paragraph.\n\nSimple ask paragraph.';

test('template-guard: same paragraph count, similar length → not a deviation', () => {
  const personalized = 'Rewritten hook paragraph for Dana.\n\nSocial proof paragraph.\n\nSimple ask paragraph.';
  assert.strictEqual(templateGuard.deviatesFromTemplate(TEMPLATE_3PARA, personalized), false);
});

test('template-guard: dropped paragraph → deviation', () => {
  const personalized = 'Rewritten hook paragraph.\n\nSimple ask paragraph.';
  assert.strictEqual(templateGuard.deviatesFromTemplate(TEMPLATE_3PARA, personalized), true);
});

test('template-guard: added paragraph → deviation', () => {
  const personalized = TEMPLATE_3PARA + '\n\nExtra paragraph Claude invented.';
  assert.strictEqual(templateGuard.deviatesFromTemplate(TEMPLATE_3PARA, personalized), true);
});

test('template-guard: empty output → deviation', () => {
  assert.strictEqual(templateGuard.deviatesFromTemplate(TEMPLATE_3PARA, ''), true);
});

// ─── personalize.js ─────────────────────────────────────────────────────────

test('personalize: system prompt embeds copy rules, voice, and motivation frames', () => {
  const p = personalize.buildEmailSystemPrompt({
    'ambassador_copy_rules.txt': 'RULE_X',
    'ambassador_voice_guidelines.txt': 'VOICE_Y',
    'ambassador_motivation_frames.txt': 'FRAME_Z',
  });
  assert.ok(p.includes('RULE_X') && p.includes('VOICE_Y') && p.includes('FRAME_Z'));
  assert.ok(/opening sentence only/.test(p));
});

test('personalize: user prompt includes recipient context', () => {
  const p = personalize.buildEmailUserPrompt('TEMPLATE_BODY', 'Dana', 'k12_educator', 'mission_impact', 'Lincoln Elementary');
  assert.ok(p.includes('Dana') && p.includes('k12_educator') && p.includes('mission_impact') && p.includes('Lincoln Elementary') && p.includes('TEMPLATE_BODY'));
});

test('personalize: personalizeEmail returns Claude output when structurally valid', async () => {
  const fakeCaller = async () => ({ status: 200, body: { content: [{ text: 'Rewritten hook.\n\nSocial proof paragraph.\n\nSimple ask paragraph.' }] } });
  const result = await personalize.personalizeEmail(
    { firstName: 'Dana', roleCategory: 'k12_educator', motivationHyp: 'mission_impact', organization: 'Lincoln Elementary' },
    TEMPLATE_3PARA, {}, fakeCaller
  );
  assert.strictEqual(result.personalized, true);
  assert.ok(result.body.includes('Rewritten hook'));
});

test('personalize: personalizeEmail falls back to template on non-200', async () => {
  const fakeCaller = async () => ({ status: 500, body: {} });
  const result = await personalize.personalizeEmail({ firstName: 'Dana' }, TEMPLATE_3PARA, {}, fakeCaller);
  assert.strictEqual(result.personalized, false);
  assert.strictEqual(result.body, TEMPLATE_3PARA);
});

test('personalize: personalizeEmail falls back to template on structural deviation', async () => {
  const fakeCaller = async () => ({ status: 200, body: { content: [{ text: 'Totally different single paragraph.' }] } });
  const result = await personalize.personalizeEmail({ firstName: 'Dana' }, TEMPLATE_3PARA, {}, fakeCaller);
  assert.strictEqual(result.personalized, false);
  assert.strictEqual(result.body, TEMPLATE_3PARA);
});

test('personalize: personalizeEmail falls back to template when the API call throws', async () => {
  const fakeCaller = async () => { throw new Error('network down'); };
  const result = await personalize.personalizeEmail({ firstName: 'Dana' }, TEMPLATE_3PARA, {}, fakeCaller);
  assert.strictEqual(result.personalized, false);
  assert.strictEqual(result.body, TEMPLATE_3PARA);
});

// ─── templates.js ───────────────────────────────────────────────────────────

test('templates: selectTemplate reads the right env keys per population + sequence', () => {
  const env = { AGENT1A_SEQ1_PROSPECT_SUBJECT: 'Subj1', AGENT1A_SEQ1_PROSPECT_BODY: 'Body1' };
  const t = templates.selectTemplate('prospect', 1, env);
  assert.strictEqual(t.subject, 'Subj1');
  assert.strictEqual(t.body, 'Body1');
});

test('templates: selectTemplate throws on unknown population', () => {
  assert.throws(() => templates.selectTemplate('bogus', 1, {}));
});

// ─── run-summary.js ─────────────────────────────────────────────────────────

test('run-summary: buildRunSummary shape matches design doc §4 Step 8', () => {
  const s = runSummary.buildRunSummary({
    triggeredAt: '2026-07-20T09:00:00Z', runType: 'agent0_complete',
    emailsSent: 3, emailsFailed: 1, contactsProcessed: 4, prospectSent: 3, testSegmentActive: true, status: 'Partial',
  });
  assert.strictEqual(s.trigger_source, 'agent_1a_run_complete');
  assert.strictEqual(s.emails_sent, 3);
  assert.strictEqual(s.run_status, 'Partial');
});

// ─── mail.js ────────────────────────────────────────────────────────────────

test('mail: buildMailPayload is always plain text, never HTML (CRITICAL RULE)', () => {
  const payload = mail.buildMailPayload('ambassadors@gracelyn.edu', 'dana@example.com', 'Subj', 'Body');
  assert.strictEqual(payload.mailFormat, 'text');
  assert.strictEqual(payload.fromAddress, 'ambassadors@gracelyn.edu');
});

// ─── retry.js ───────────────────────────────────────────────────────────────

test('retry: withRetryOnce returns immediately on first success without waiting', async () => {
  let waitCalls = 0;
  const result = await withRetryOnce(async () => 'ok', async () => { waitCalls++; }, 30000);
  assert.strictEqual(result, 'ok');
  assert.strictEqual(waitCalls, 0);
});

test('retry: withRetryOnce waits once then succeeds on the second attempt', async () => {
  let attempts = 0;
  let waitedMs = null;
  const fn = async () => { attempts++; if (attempts === 1) throw new Error('transient'); return 'ok'; };
  const result = await withRetryOnce(fn, async (ms) => { waitedMs = ms; }, 30000);
  assert.strictEqual(result, 'ok');
  assert.strictEqual(attempts, 2);
  assert.strictEqual(waitedMs, 30000);
});

test('retry: withRetryOnce throws after both attempts fail, tagging retriedOnce', async () => {
  let attempts = 0;
  const fn = async () => { attempts++; throw new Error('still down'); };
  await assert.rejects(
    withRetryOnce(fn, async () => {}, 30000),
    (err) => { assert.strictEqual(attempts, 2); assert.strictEqual(err.retriedOnce, true); return true; }
  );
});

// ─── alerts.js ──────────────────────────────────────────────────────────────

test('alerts: buildAlertEmail matches the design doc §7.1 format', () => {
  const { subject: subj, body } = alerts.buildAlertEmail({
    failureType: 'Test Failure', runDate: '2026-07-20T09:00:00Z', triggerType: 'agent0_complete',
    failedStep: 'Step 5', errorDetails: 'boom', emailsSentBeforeFailure: 3,
    contactsNeedingManualUpdate: ['111', '222'], recommendedAction: 'Do the thing.',
  });
  assert.strictEqual(subj, '[AGENT 1A ERROR] Test Failure - 2026-07-20T09:00:00Z');
  assert.ok(body.includes('Agent: Database and Email Agent (Agent 1A)'));
  assert.ok(body.includes('Trigger Type: agent0_complete'));
  assert.ok(body.includes('Contacts Needing Manual CRM Update: 111, 222'));
  assert.ok(body.includes('Recommended Action: Do the thing.'));
});

test('alerts: buildAlertEmail reports "None" when no contacts need manual update', () => {
  const { body } = alerts.buildAlertEmail({
    failureType: 'X', runDate: 'd', triggerType: 't', failedStep: 's', errorDetails: 'e',
    emailsSentBeforeFailure: 0, contactsNeedingManualUpdate: [], recommendedAction: 'r',
  });
  assert.ok(body.includes('Contacts Needing Manual CRM Update: None'));
});

test('alerts: thresholds match design doc §7 exactly (>10 Claude, >20 mail)', () => {
  assert.strictEqual(alerts.CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD, 10);
  assert.strictEqual(alerts.CONSECUTIVE_MAIL_FAILURE_THRESHOLD, 20);
});

// ─── webhook.js ─────────────────────────────────────────────────────────────

test('webhook: postRunSummary delivers on first attempt without retry', async () => {
  process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL = 'https://hooks.example.com/agent1a';
  let calls = 0;
  const fakePostJson = async () => { calls++; return { status: 200, body: '{}' }; };
  const result = await postRunSummary({ foo: 'bar' }, async () => {}, fakePostJson);
  assert.strictEqual(result.delivered, true);
  assert.strictEqual(calls, 1);
  delete process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL;
});

test('webhook: postRunSummary retries once on a non-2xx response, then succeeds', async () => {
  process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL = 'https://hooks.example.com/agent1a';
  let calls = 0;
  const fakePostJson = async () => { calls++; return calls === 1 ? { status: 500, body: 'err' } : { status: 200, body: '{}' }; };
  const result = await postRunSummary({ foo: 'bar' }, async () => {}, fakePostJson);
  assert.strictEqual(result.delivered, true);
  assert.strictEqual(calls, 2);
  delete process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL;
});

test('webhook: postRunSummary reports not-delivered after both attempts fail', async () => {
  process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL = 'https://hooks.example.com/agent1a';
  const fakePostJson = async () => ({ status: 500, body: 'err' });
  const result = await postRunSummary({ foo: 'bar' }, async () => {}, fakePostJson);
  assert.strictEqual(result.delivered, false);
  delete process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL;
});

test('webhook: postRunSummary reports not-delivered without throwing when URL is unset', async () => {
  delete process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL;
  const result = await postRunSummary({ foo: 'bar' });
  assert.strictEqual(result.delivered, false);
  assert.ok(/not set/.test(result.reason));
});

// ─── reconcile.js ───────────────────────────────────────────────────────────

test('reconcile: resolveModules resolves Prospects to Ambassador_Leads and flags env divergence', async () => {
  const byLabel = new Map([
    ['ambassador_leads', { api_name: 'Ambassador_Leads' }],
  ]);
  zohoMeta.fetchModules = async () => ({ raw: [], byLabel });
  process.env.PROSPECTS_MODULE_API_NAME = 'Prospects'; // wrong on purpose — divergence check
  const result = await reconcile.resolveModules();
  assert.strictEqual(result.resolved.prospects, 'Ambassador_Leads');
  assert.ok(result.divergences.some((d) => /PROSPECTS_MODULE_API_NAME/.test(d)));
  delete process.env.PROSPECTS_MODULE_API_NAME;
});

test('reconcile: resolveModules leaves unconfirmed modules (Para DB, Student/Alumni) unresolved without throwing', async () => {
  const byLabel = new Map([['ambassador_leads', { api_name: 'Ambassador_Leads' }]]);
  zohoMeta.fetchModules = async () => ({ raw: [], byLabel });
  const result = await reconcile.resolveModules();
  assert.strictEqual(result.resolved.paraDb, undefined);
  assert.strictEqual(result.resolved.studentAlumni, undefined);
  assert.ok(result.unresolved.find((u) => u.key === 'paraDb'));
});

test('reconcile: checkProspectFields distinguishes missing-existing from missing-new (not-yet-created) fields', async () => {
  zohoMeta.fetchFields = async () => ({
    byApi: new Map([
      ['Name', {}], ['Last_Name', {}], ['Email', {}], ['Company_Name', {}], ['Title', {}],
      ['Channel_Source', {}], ['Motivation_Tag', {}], ['Role_Category', {}], ['Contact_Found', {}],
      ['VIP_Prospect', {}], ['Outreach_Status', {}],
      // Sequence_Email_* / Recruiting_* deliberately omitted
    ]),
  });
  const result = await reconcile.checkProspectFields('Ambassador_Leads');
  assert.strictEqual(result.missingExisting.length, 0);
  assert.ok(result.missingNew.includes('Sequence_Email_1_Sent'));
  assert.ok(result.missingNew.includes('Recruiting_Source'));
});

// ─── index.js orchestration (full runs with injected fakes) ────────────────

function makeFakeDeps(overrides = {}) {
  const state = { crmUpdates: [], mailsSent: [], alertsSent: [], webhookCalls: [], waitCalls: 0 };
  const deps = {
    zoho: {
      getCrmToken: async () => 'crm-token',
      crmSearch: async () => [],
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
      crmGetRecord: async () => { throw new Error('not configured'); },
    },
    mail: {
      getMailToken: async () => 'mail-token',
      sendRecruitingEmail: async (to, subj, body) => { state.mailsSent.push({ to, subj, body }); },
      sendAlertEmail: async (subj, body) => { state.alertsSent.push({ subj, body }); },
    },
    workdrive: {
      getWorkdriveToken: async () => 'wd-token',
      readAllBrandAssets: async () => ({ assets: {}, missing: [] }),
    },
    personalize: {
      personalizeEmail: async (contact, template) => ({ body: template, personalized: false }),
    },
    reconcile: {
      resolveModules: async () => ({ resolved: { prospects: 'Ambassador_Leads' }, unresolved: [], divergences: [] }),
      checkProspectFields: async () => ({ ok: true, missingExisting: [], missingNew: [] }),
    },
    webhook: {
      postRunSummary: async (summary) => { state.webhookCalls.push(summary); return { delivered: true }; },
    },
    wait: async () => { state.waitCalls += 1; },
  };
  for (const k of Object.keys(overrides)) Object.assign(deps[k], overrides[k]);
  return { deps, state };
}

const TODAY = new Date('2026-07-20T09:00:00-05:00');
const PARA_ENV_BACKUP = {};
function withTemplateEnv(fn) {
  const keys = ['AGENT1A_SEQ1_PROSPECT_SUBJECT', 'AGENT1A_SEQ1_PROSPECT_BODY', 'AGENT1A_SEQ2_PROSPECT_SUBJECT', 'AGENT1A_SEQ2_PROSPECT_BODY'];
  for (const k of keys) PARA_ENV_BACKUP[k] = process.env[k];
  process.env.AGENT1A_SEQ1_PROSPECT_SUBJECT = 'Hi [FIRST_NAME]!';
  process.env.AGENT1A_SEQ1_PROSPECT_BODY = 'Mission hook.\n\nSocial proof.\n\nSimple ask.';
  process.env.AGENT1A_SEQ2_PROSPECT_SUBJECT = 'Following up, [FIRST_NAME]';
  process.env.AGENT1A_SEQ2_PROSPECT_BODY = 'Short warm hook.\n\nNo pressure.\n\nSimple ask.';
  return fn().finally(() => { for (const k of keys) process.env[k] = PARA_ENV_BACKUP[k]; });
}

test('index: rejects malformed trigger_type with 400', async () => {
  const { deps } = makeFakeDeps();
  const result = await runAgent1A({ trigger_type: 'nope' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 400);
});

test('index: aborts entire run on token refresh failure (design doc §7 row 1)', async () => {
  const { deps } = makeFakeDeps({ zoho: { getCrmToken: async () => { throw new Error('bad refresh token'); } } });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
  assert.ok(/aborted/.test(result.body.error));
});

test('index: aborts run when Prospects module cannot be resolved live', async () => {
  const { deps } = makeFakeDeps({ reconcile: { resolveModules: async () => ({ resolved: {}, unresolved: [{ key: 'prospects' }], divergences: [] }) } });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
});

test('index: agent0_complete happy path sends email 1, updates CRM immediately with attribution, uses VIP-suppressed criteria', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmSearch: async (moduleApi, crit) => {
        assert.strictEqual(moduleApi, 'Ambassador_Leads');
        assert.strictEqual(crit, criteria.newProspectsCriteria());
        return [{ id: '111', Name: 'Dana', Email: 'dana@example.com', Company_Name: 'Lincoln Elementary', Role_Category: 'k12_educator', Motivation_Tag: 'mission_impact' }];
      },
    },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.mailsSent.length, 1);
  assert.strictEqual(state.mailsSent[0].to, 'dana@example.com');
  assert.strictEqual(state.mailsSent[0].subj, 'Hi Dana!');
  assert.strictEqual(state.crmUpdates.length, 1);
  assert.strictEqual(state.crmUpdates[0].record.Outreach_Status, 'Outreach Sent');
  assert.strictEqual(state.crmUpdates[0].record.Recruiting_Source, 'Agent 1A');
  assert.strictEqual(result.body.summary.emails_sent, 1);
  assert.deepStrictEqual(result.body.skippedPopulations.sort(), ['paraDb', 'studentAlumni']);
  // test_segment_active is honestly false — Para DB querying isn't wired up yet, so no cap is ever enforced.
  assert.strictEqual(result.body.summary.test_segment_active, false);
  // Step 8: the run summary actually gets POSTed to the coordinator webhook, not just returned.
  assert.strictEqual(result.body.summaryWebhookDelivered, true);
  assert.strictEqual(state.webhookCalls.length, 1);
  assert.strictEqual(state.webhookCalls[0].emails_sent, 1);
}));

test('index: aborts run when a required Prospects field is missing (pre-flight check)', () => withTemplateEnv(async () => {
  const { deps } = makeFakeDeps({
    reconcile: { checkProspectFields: async () => ({ ok: false, missingExisting: ['VIP_Prospect'], missingNew: ['Recruiting_Source'] }) },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
  assert.deepStrictEqual(result.body.missingExistingFields, ['VIP_Prospect']);
  assert.deepStrictEqual(result.body.missingNewFields, ['Recruiting_Source']);
}));

test('index: retries a failed CRM search once (30s delay) and succeeds on the second attempt', () => withTemplateEnv(async () => {
  let attempts = 0;
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmSearch: async () => {
        attempts++;
        if (attempts === 1) throw new Error('transient CRM timeout');
        return [{ id: '999', Name: 'Riley', Email: 'riley@example.com' }];
      },
    },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(attempts, 2);
  assert.strictEqual(state.waitCalls, 1);
  assert.strictEqual(state.mailsSent.length, 1);
}));

test('index: aborts after a CRM search fails twice in a row (retry exhausted)', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: { crmSearch: async () => { throw new Error('CRM is down'); } },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
  assert.ok(/retry/.test(result.body.error));
  assert.strictEqual(state.waitCalls, 1);
}));

test('index: alerts Parmeet when a brand asset file is missing, even though the run still succeeds', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: { crmSearch: async () => [] },
    workdrive: { readAllBrandAssets: async () => ({ assets: {}, missing: ['ambassador_copy_rules.txt'] }) },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.alertsSent.length, 1);
  assert.ok(state.alertsSent[0].body.includes('ambassador_copy_rules.txt'));
}));

test('index: alerts Parmeet after more than 10 consecutive Claude personalization failures', () => withTemplateEnv(async () => {
  // makeFakeDeps' default personalize fake returns { personalized: false } — 11 contacts all "fail".
  const contacts = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, Name: `Contact${i}`, Email: `c${i}@example.com` }));
  const { deps, state } = makeFakeDeps({ zoho: { crmSearch: async () => contacts } });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.mailsSent.length, 11);
  assert.ok(state.alertsSent.some((a) => /consecutive Claude/.test(a.body)));
}));

test('index: alerts Parmeet after more than 20 consecutive mail send failures', () => withTemplateEnv(async () => {
  const contacts = Array.from({ length: 21 }, (_, i) => ({ id: `m${i}`, Name: `Contact${i}`, Email: `c${i}@example.com` }));
  const { deps, state } = makeFakeDeps({
    zoho: { crmSearch: async () => contacts },
    mail: { sendRecruitingEmail: async () => { throw new Error('account suspended'); } },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.summary.emails_failed, 21);
  assert.ok(state.alertsSent.some((a) => /consecutive mail/.test(a.body)));
}));

test('index: alerts Parmeet with the full summary when the run-summary webhook delivery fails', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: { crmSearch: async () => [] },
    webhook: { postRunSummary: async () => ({ delivered: false, reason: 'DNS failure' }) },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.summaryWebhookDelivered, false);
  assert.strictEqual(state.alertsSent.length, 1);
  assert.ok(/Webhook Delivery Failed/.test(state.alertsSent[0].subj));
  assert.ok(state.alertsSent[0].body.includes('DNS failure'));
}));

test('index: followup_schedule sends email 2 with the 7-day-mark criteria', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmSearch: async (moduleApi, crit) => {
        assert.strictEqual(crit, criteria.followUpCriteria(TODAY));
        return [{ id: '222', Name: 'Sam', Email: 'sam@example.com' }];
      },
    },
  });
  const result = await runAgent1A({ trigger_type: 'followup_schedule', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.crmUpdates[0].record.Outreach_Status, 'Follow-Up Sent');
}));

test('index: unresponsive_mark updates status but sends no email', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmSearch: async (moduleApi, crit) => {
        assert.strictEqual(crit, criteria.unresponsiveCriteria(TODAY));
        return [{ id: '333', Name: 'Robin', Email: 'robin@example.com' }];
      },
    },
  });
  const result = await runAgent1A({ trigger_type: 'unresponsive_mark', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.mailsSent.length, 0);
  assert.strictEqual(state.crmUpdates[0].record.Outreach_Status, 'Unresponsive');
}));

test('index: lead_capture_new_contact sends immediately without waiting for Monday cycle', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmGetRecord: async (moduleApi, id) => {
        assert.strictEqual(id, 'lead-1');
        return { id: 'lead-1', Name: 'Alex', Email: 'alex@example.com', Role_Category: 'faith_community' };
      },
    },
  });
  const payload = {
    trigger_type: 'lead_capture_new_contact', prospect_crm_id: 'lead-1', email: 'alex@example.com',
    first_name: 'Alex', role_category: 'faith_community', lead_magnet_id: 'm1', recruiting_source: 'Agent 1D',
  };
  const result = await runAgent1A(payload, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(state.mailsSent.length, 1);
  assert.strictEqual(state.mailsSent[0].to, 'alex@example.com');
}));

test('index: mail send failure retries once, is recorded per-contact, and does not abort the run (Partial status)', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: { crmSearch: async () => [{ id: '444', Name: 'Casey', Email: 'casey@example.com' }] },
    mail: { sendRecruitingEmail: async () => { throw new Error('mailbox full'); } },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.summary.run_status, 'Partial');
  assert.strictEqual(result.body.summary.emails_failed, 1);
  assert.strictEqual(state.crmUpdates.length, 0, 'no CRM update should happen when the send itself failed');
  assert.strictEqual(state.waitCalls, 1, 'mail send should have retried once before being logged as failed');
}));

test('index: CRM update failure after a successful send is logged, alerted, but the send still counts (email already went out)', () => withTemplateEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      crmSearch: async () => [{ id: '555', Name: 'Jordan', Email: 'jordan@example.com' }],
      crmUpdateRecord: async () => { throw new Error('CRM timeout'); },
    },
  });
  const result = await runAgent1A({ trigger_type: 'agent0_complete', triggered_at: '2026-07-20T09:00:00-06:00' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.summary.emails_sent, 1);
  assert.strictEqual(result.body.summary.crm_update_failures.length, 1);
  assert.strictEqual(state.waitCalls, 1, 'CRM update should have retried once before being logged as failed');
  assert.ok(state.alertsSent.some((a) => a.body.includes('555') && /manual/.test(a.body)));
}));

// ─── run ─────────────────────────────────────────────────────────────────────

console.log('Agent 1A tests\n');
(async () => {
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();

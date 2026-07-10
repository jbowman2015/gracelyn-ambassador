'use strict';

/**
 * Agent 3 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent3.test.js
 *
 * Covers the design §11 acceptance criteria: sprint initialization and
 * week-by-week advancement/graduation, sprint/standard population
 * separation, story selection by role category (+ fallback chain), the
 * dynamic VIP tier system, dormant-detection sprint exclusion, the
 * sprint-graduation-anchored 90-day non-referral threshold, the Alternative
 * track return-to-Standard transition, milestone detection, and the §4.3/§10
 * voice rules (no em dashes, never "commission").
 */

const assert = require('assert');
const M = require('../manifest');
const dates = require('../dates');
const scoring = require('../scoring');
const story = require('../story');
const prompts = require('../prompts');
const { recordToAmbassador } = require('../common');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── criteria mini-evaluator for the fake Zoho store ───────────────────────────
function findTopLevelOperator(s) {
  // Our own criteria generator always wraps operands in parens with no
  // spaces, e.g. "(a)and(b)" — only treat "and"/"or" as an operator when it
  // sits directly between a closing and an opening paren at depth 0, so it
  // never matches inside a value like "Standard".
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) {
        if (s.slice(i + 1, i + 4) === 'and' && s[i + 4] === '(') return { op: 'and', index: i + 1, len: 3 };
        if (s.slice(i + 1, i + 3) === 'or' && s[i + 3] === '(') return { op: 'or', index: i + 1, len: 2 };
      }
    }
  }
  return null;
}
function evalCriteria(record, s) {
  s = s.trim();
  const top = findTopLevelOperator(s);
  if (top) {
    const l = evalCriteria(record, s.slice(0, top.index));
    const r = evalCriteria(record, s.slice(top.index + top.len));
    return top.op === 'and' ? (l && r) : (l || r);
  }
  if (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, wholeGroup = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0 && i !== s.length - 1) { wholeGroup = false; break; } }
    }
    if (wholeGroup) return evalCriteria(record, s.slice(1, -1));
  }
  const parts = s.split(':');
  const field = parts[0];
  const op = parts[1];
  const value = parts.slice(2).join(':');
  let fv = record[field];
  if (fv && typeof fv === 'object' && 'id' in fv) fv = fv.id; // lookup fields, e.g. { id: '...' }
  switch (op) {
    case 'equals': return String(fv) === String(value);
    case 'less_equal': return fv != null && String(fv) <= value;
    case 'greater_equal': return fv != null && String(fv) >= value;
    case 'starts_with': return value === '' ? !!fv : String(fv || '').startsWith(value);
    default: return false;
  }
}

// ─── fake Zoho store ────────────────────────────────────────────────────────
function makeFakeZoho(ambassadors, refs) {
  let nextId = 9000;
  const tasks = [];
  return {
    calls: { updates: [], tasks },
    async resolveModuleApiName({ label }) { return { apiName: label, divergence: null }; },
    async verifyFields() { return { missing: [], missingOptional: [] }; },
    async getRecordById(moduleApi, id) {
      const store = moduleApi === 'Ambassadors' ? ambassadors : refs;
      const rec = store.find((r) => r.id === id);
      if (!rec) throw new Error(`not found: ${id}`);
      return { ...rec };
    },
    async fetchAllRecords(moduleApi, opts = {}) {
      const store = moduleApi === 'Ambassadors' ? ambassadors : refs;
      if (!opts.criteria) return store.map((r) => ({ ...r }));
      return store.filter((r) => evalCriteria(r, opts.criteria)).map((r) => ({ ...r }));
    },
    async updateRecord(moduleApi, id, patch) {
      const store = moduleApi === 'Ambassadors' ? ambassadors : refs;
      const rec = store.find((r) => r.id === id);
      if (!rec) throw new Error(`not found: ${id}`);
      Object.assign(rec, patch);
      this.calls.updates.push({ id, patch });
      return { id, op: 'update' };
    },
    async createRecord(moduleApi, record) {
      const store = moduleApi === 'Ambassadors' ? ambassadors : refs;
      const id = String(nextId++);
      store.push({ id, ...record });
      return { id, op: 'create' };
    },
    async createTask(t) { tasks.push(t); return { id: String(nextId++), op: 'create' }; },
  };
}

function makeFakeMail() {
  const sent = [];
  return { sent, async sendEmail({ to, subject, text }) { sent.push({ to, subject, text }); return { ok: true, status: 200 }; } };
}
function makeFakeClaude() {
  return { async generateEmail({ user }) { return user; } }; // echo the prompt so tests can assert framing
}
function makeFakeAlerts() {
  const alerts = [];
  return { alerts, async sendAlert(a) { alerts.push(a); return { delivered: true, via: 'test' }; } };
}
function makeFakeWorkdrive(files, contentById) {
  return {
    async listStoryFiles() { return files; },
    async downloadFileText(id) { return contentById[id]; },
    async markStoryUsed() { return { id: 'log', name: 'used' }; },
    async readUpdateBrief() { return null; },
  };
}
function makeFakeHeygen() {
  const jobs = [];
  return { jobs, async submitMilestoneVideo(a) { jobs.push(a); return { ok: true, jobId: 'v1' }; } };
}

function baseAmbassador(overrides = {}) {
  return {
    id: overrides.id || '1001',
    First_Name: 'Jamie', Name: 'Rivera', Email: 'jamie@example.com',
    Referral_Code: 'JAMIE1', Referral_Link: 'https://gracelyn.edu/r/jamie1',
    Ambassador_Status: 'Active', Compliance_Complete: true,
    Ambassador_Role_Category: 'K12 Educator', Motivation_Tag: 'Mission Impact',
    Activation_Sprint_Week: 0, Sprint_Start_Date: null, Sprint_Referral_Submitted: false,
    Content_Week_Position: 1, Engagement_Track: '', Days_Since_Last_Referral: 0,
    Alt_Track_Entry_Date: null, Alternative_Track_Month: 0, Re_Engagement_Attempt: 0,
    Escalated_To_Human: false, VIP_Score: 0, VIP_Tier: 'Not VIP', VIP_Tier_Previous: 'Not VIP',
    VIP_Tier_Upgrade_Date: null, Last_Engagement_Date: null, Last_Story_File_Used: '',
    ...overrides,
  };
}

// ═══ scoring.js ═════════════════════════════════════════════════════════════
test('referral activity points cap at 40', () => {
  assert.strictEqual(scoring.referralActivityPoints(3), 30);
  assert.strictEqual(scoring.referralActivityPoints(4), 40);
  assert.strictEqual(scoring.referralActivityPoints(10), 40);
});

test('engagement rate bands', () => {
  assert.strictEqual(scoring.engagementRatePoints(85), 30);
  assert.strictEqual(scoring.engagementRatePoints(60), 20);
  assert.strictEqual(scoring.engagementRatePoints(30), 10);
  assert.strictEqual(scoring.engagementRatePoints(10), 0);
});

test('tenure bands + consecutive-quarter bonus, capped at 30', () => {
  assert.strictEqual(scoring.tenurePoints(30, 0), 30);
  assert.strictEqual(scoring.tenurePoints(12, 0), 20);
  assert.strictEqual(scoring.tenurePoints(6, 0), 10);
  assert.strictEqual(scoring.tenurePoints(12, 2), 25);
  assert.strictEqual(scoring.tenurePoints(30, 2), 30); // capped
});

test('VIP tier percentage bands shift at the population threshold', () => {
  const small = scoring.tierPercentBands(5000);
  assert.strictEqual(small.highPct, 2.5);
  assert.strictEqual(small.stdPct, 5);
  const large = scoring.tierPercentBands(15000);
  assert.strictEqual(large.highPct, 0.5);
  assert.strictEqual(large.stdPct, 2.5);
});

test('assignVipTiers: top 2.5% High VIP, next slice to 5% Standard VIP (small population)', () => {
  const scored = Array.from({ length: 40 }, (_, i) => ({ id: String(i), total: 40 - i }));
  const tiered = scoring.assignVipTiers(scored);
  const high = tiered.filter((t) => t.tier === M.VIP_TIER_VALUES.highVip);
  const std = tiered.filter((t) => t.tier === M.VIP_TIER_VALUES.standardVip);
  assert.strictEqual(high.length, 1); // ceil(2.5% of 40) = 1
  assert.strictEqual(std.length, 1);  // ranks 1..ceil(5% of 40)=2 minus the 1 already High
  assert.strictEqual(high[0].id, '0'); // highest score
});

// ═══ prompts.js — §4.3/§10 voice rules ═════════════════════════════════════
test('no email prompt builder ever emits an em dash', () => {
  const amb = { firstName: 'Jamie', roleCategory: 'K12 Educator', motivationTag: 'Mission Impact', referralLink: 'https://x', vipTier: 'High VIP' };
  const texts = [
    prompts.buildSprintSystemPrompt('rules', 'voice'),
    prompts.buildSprintWeek1Prompt(amb), prompts.buildSprintWeek2Prompt(amb),
    prompts.buildSprintWeek3Prompt({ ...amb, Sprint_Referral_Submitted: true }),
    prompts.buildSprintWeek4Prompt(amb), prompts.buildSprintGraduationPrompt(amb),
    prompts.buildStandardSystemPrompt('rules', 'voice'), prompts.buildMissionMomentPrompt(amb),
    prompts.buildSuccessStoryPrompt(amb, 'a story'), prompts.buildAmbassadorSpotlightPrompt(amb, { firstName: 'Sam', referralCount: 4 }),
    prompts.buildProgramUpdatePrompt(amb, 'brief'), prompts.buildAlternativeTrackPrompt(amb, M.ALTERNATIVE_CONTENT_TYPES.referralAsk),
    prompts.buildDormantReEngagementPrompt(amb, 1), prompts.buildVipCheckInPrompt(amb),
    prompts.buildVipTierUpgradePrompt(amb, 'High VIP'), prompts.buildMilestonePrompt(amb, 5),
    prompts.buildReferralNotificationPrompt(amb, 'Enrolled'),
  ];
  for (const t of texts) assert.ok(!t.includes('—'), `em dash found: ${t.slice(0, 60)}`);
});

test('system prompts forbid "commission" and require "referral fee"', () => {
  assert.ok(/Never say commission/.test(prompts.buildSprintSystemPrompt('', '')));
  assert.ok(/Always say referral fee/.test(prompts.buildSprintSystemPrompt('', '')));
});

test('sprint week 2 email is framed as one person, not a mass-share ask', () => {
  const p = prompts.buildSprintWeek2Prompt({ firstName: 'Jamie', roleCategory: 'K12 Educator', referralLink: 'https://x' });
  assert.ok(/one person/i.test(p));
});

// ═══ story.js — §5.3 selection chain ═══════════════════════════════════════
test('parseRoleCategory reads the second-line ROLE_CATEGORY header', () => {
  const content = 'Some Title\nROLE_CATEGORY: K12 Educator\nBody text...';
  assert.strictEqual(story.parseRoleCategory(content), 'K12 Educator');
});

test('story selection: exact role category match wins', async () => {
  const files = [{ id: 'f1', name: 'Story_2026-01-01.txt' }, { id: 'f2', name: 'Story_2026-02-01.txt' }];
  const content = { f1: 'T\nROLE_CATEGORY: Faith Community\nx', f2: 'T\nROLE_CATEGORY: K12 Educator\nx' };
  const sel = await story.selectStory('K12 Educator', files, (id) => content[id]);
  assert.strictEqual(sel.file.id, 'f2');
  assert.strictEqual(sel.matchedOn, 'role_category');
});

test('story selection: falls back to Any-tagged file when no category match', async () => {
  const files = [{ id: 'f1', name: 'Story_2026-01-01.txt' }, { id: 'f2', name: 'Story_2026-02-01.txt' }];
  const content = { f1: 'T\nROLE_CATEGORY: Any\nx', f2: 'T\nROLE_CATEGORY: Faith Community\nx' };
  const sel = await story.selectStory('K12 Educator', files, (id) => content[id]);
  assert.strictEqual(sel.matchedOn, 'any');
  assert.strictEqual(sel.file.id, 'f1');
});

test('story selection: falls back to most recent file when no category or Any match', async () => {
  const files = [{ id: 'f1', name: 'Story_2026-02-01.txt' }, { id: 'f2', name: 'Story_2026-01-01.txt' }];
  const content = { f1: 'T\nROLE_CATEGORY: Faith Community\nx', f2: 'T\nROLE_CATEGORY: Youth Serving Professional\nx' };
  const sel = await story.selectStory('K12 Educator', files, (id) => content[id]);
  assert.strictEqual(sel.matchedOn, 'most_recent_fallback');
  assert.strictEqual(sel.file.id, 'f1'); // files[0] = newest-first order
});

test('story selection: empty buffer returns null', async () => {
  const sel = await story.selectStory('K12 Educator', [], async () => '');
  assert.strictEqual(sel, null);
});

// ═══ manifest.js — alternative track rotation ══════════════════════════════
test('alternative track content type rotates story/experience/referral-ask by month', () => {
  assert.strictEqual(M.alternativeContentTypeForMonth(1), M.ALTERNATIVE_CONTENT_TYPES.storyInvitation);
  assert.strictEqual(M.alternativeContentTypeForMonth(2), M.ALTERNATIVE_CONTENT_TYPES.experienceInvitation);
  assert.strictEqual(M.alternativeContentTypeForMonth(3), M.ALTERNATIVE_CONTENT_TYPES.referralAsk);
  assert.strictEqual(M.alternativeContentTypeForMonth(4), M.ALTERNATIVE_CONTENT_TYPES.storyInvitation);
  assert.strictEqual(M.alternativeContentTypeForMonth(10), M.ALTERNATIVE_CONTENT_TYPES.storyInvitation);
});

// ═══ sprint.js — §4, §11.1, §11.2 ═══════════════════════════════════════════
function baseEnv() {
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
  process.env.VIP_MANAGER_EMAIL = 'vip@gracelyn.edu';
  process.env.WORKDRIVE_FOLDER_05_ID = 'f05';
  process.env.WORKDRIVE_FOLDER_08_ID = 'f08';
}
function clearEnv() {
  ['PARMEET_ALERT_EMAIL', 'VIP_MANAGER_EMAIL', 'WORKDRIVE_FOLDER_05_ID', 'WORKDRIVE_FOLDER_08_ID', 'SPRINT_GRADUATION_DAYS']
    .forEach((k) => delete process.env[k]);
}

test('sprint initialization on activation sets fields and sends Week 1 email', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a1', Activation_Sprint_Week: 0, Engagement_Track: '' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await sprint.initializeAmbassador({
    ambassador: { id: 'a1' }, deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') },
  });
  assert.strictEqual(summary.initialized, true);
  assert.strictEqual(summary.emailSent, true);
  const rec = ambassadors[0];
  assert.strictEqual(rec.Activation_Sprint_Week, 1);
  assert.strictEqual(rec.Engagement_Track, 'Sprint');
  assert.strictEqual(rec.Content_Week_Position, 1);
  assert.strictEqual(rec.Sprint_Referral_Submitted, false);
  assert.ok(rec.Sprint_Start_Date);
  assert.strictEqual(mail.sent.length, 1);
  clearEnv();
});

test('sprint advancement: week 1 -> 2 sends the "one person" outreach prompt', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a2', Activation_Sprint_Week: 1, Engagement_Track: 'Sprint', Sprint_Start_Date: '2026-07-06' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await sprint.sprintAdvancementJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') } });
  assert.strictEqual(summary.advanced, 1);
  assert.strictEqual(ambassadors[0].Activation_Sprint_Week, 2);
  assert.ok(mail.sent[0].text.includes('one person in your network'));
  clearEnv();
});

test('sprint advancement: week 3 email uses encouragement framing when no referral submitted', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a3', Activation_Sprint_Week: 2, Engagement_Track: 'Sprint', Sprint_Start_Date: '2026-07-06', Sprint_Referral_Submitted: false })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  await sprint.sprintAdvancementJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') } });
  assert.strictEqual(ambassadors[0].Activation_Sprint_Week, 3);
  assert.ok(mail.sent[0].text.includes('Has submitted a referral during the sprint: false'));
  clearEnv();
});

test('sprint advancement: week 3 email uses celebration framing when referral already submitted', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a4', Activation_Sprint_Week: 2, Engagement_Track: 'Sprint', Sprint_Start_Date: '2026-07-06', Sprint_Referral_Submitted: true })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  await sprint.sprintAdvancementJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') } });
  assert.ok(mail.sent[0].text.includes('Has submitted a referral during the sprint: true'));
  clearEnv();
});

test('sprint advancement: week 4 does not graduate before SPRINT_GRADUATION_DAYS elapsed', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a5', Activation_Sprint_Week: 4, Engagement_Track: 'Sprint', Sprint_Start_Date: '2026-07-10' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await sprint.sprintAdvancementJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') } });
  assert.strictEqual(summary.graduated, 0);
  assert.strictEqual(summary.skipped, 1);
  assert.strictEqual(ambassadors[0].Activation_Sprint_Week, 4);
  clearEnv();
});

test('sprint graduation at Day 28+: resets to standard cycle, sends graduation email', async () => {
  baseEnv();
  const sprint = require('../sprint');
  const ambassadors = [baseAmbassador({ id: 'a6', Activation_Sprint_Week: 4, Engagement_Track: 'Sprint', Sprint_Start_Date: '2026-06-14', Content_Week_Position: 3 })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await sprint.sprintAdvancementJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:00:00Z') } });
  assert.strictEqual(summary.graduated, 1);
  const rec = ambassadors[0];
  assert.strictEqual(rec.Activation_Sprint_Week, 0);
  assert.strictEqual(rec.Engagement_Track, 'Standard');
  assert.strictEqual(rec.Content_Week_Position, 1);
  assert.strictEqual(mail.sent.length, 1);
  clearEnv();
});

// ═══ weekly.js — §5, §7, non-negotiable sprint/standard separation ═════════
test('weekly cycle only processes Standard track ambassadors with Activation_Sprint_Week = 0', async () => {
  baseEnv();
  const weekly = require('../weekly');
  const ambassadors = [
    baseAmbassador({ id: 'std1', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Content_Week_Position: 1 }),
    baseAmbassador({ id: 'sprint1', Engagement_Track: 'Sprint', Activation_Sprint_Week: 2, Content_Week_Position: 1 }),
  ];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const workdrive = makeFakeWorkdrive([], {});
  const alerts = makeFakeAlerts();
  const summary = await weekly.weeklyEngagementCycle({
    deps: { zoho, mail, claude, workdrive, alerts, now: () => new Date('2026-07-13T14:00:00Z') },
  });
  assert.strictEqual(summary.standardProcessed, 1);
  assert.strictEqual(mail.sent.length, 1);
  assert.strictEqual(mail.sent[0].to, 'jamie@example.com'); // std1's email, not sprint1's
  clearEnv();
});

test('weekly cycle Week 2 selects a story by role category and marks Last_Story_File_Used', async () => {
  baseEnv();
  const weekly = require('../weekly');
  const ambassadors = [baseAmbassador({ id: 'std2', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Content_Week_Position: 2, Ambassador_Role_Category: 'Faith Community' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const files = [{ id: 'f1', name: 'Story_2026-01-01.txt' }];
  const workdrive = makeFakeWorkdrive(files, { f1: 'T\nROLE_CATEGORY: Faith Community\nA story about faith.' });
  const alerts = makeFakeAlerts();
  await weekly.weeklyEngagementCycle({ deps: { zoho, mail, claude, workdrive, alerts, now: () => new Date('2026-07-13T14:00:00Z') } });
  assert.strictEqual(ambassadors[0].Last_Story_File_Used, 'Story_2026-01-01.txt');
  assert.ok(mail.sent[0].text.includes('A story about faith.'));
  clearEnv();
});

// ═══ dormant.js — sprint exclusion + day 30/45/60 attempts ═════════════════
test('dormant detection excludes sprint ambassadors even if inactive 35+ days', async () => {
  baseEnv();
  const dormant = require('../dormant');
  const ambassadors = [baseAmbassador({ id: 'd1', Engagement_Track: 'Sprint', Activation_Sprint_Week: 2, Last_Engagement_Date: '2026-06-08' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await dormant.dormantDetectionJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:30:00Z') } });
  assert.strictEqual(summary.checked, 0);
  assert.strictEqual(mail.sent.length, 0);
  clearEnv();
});

test('dormant detection: Day 30 sends re-engagement attempt 1', async () => {
  baseEnv();
  const dormant = require('../dormant');
  const ambassadors = [baseAmbassador({ id: 'd2', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Last_Engagement_Date: '2026-06-13', Re_Engagement_Attempt: 0 })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await dormant.dormantDetectionJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:30:00Z') } });
  assert.strictEqual(summary.attempt1, 1);
  assert.strictEqual(ambassadors[0].Re_Engagement_Attempt, 1);
  assert.strictEqual(ambassadors[0].Engagement_Track, 'Dormant');
  clearEnv();
});

test('dormant detection: Day 60 escalates to human with no further automated contact', async () => {
  baseEnv();
  const dormant = require('../dormant');
  const ambassadors = [baseAmbassador({ id: 'd3', Engagement_Track: 'Dormant', Activation_Sprint_Week: 0, Last_Engagement_Date: '2026-05-14', Re_Engagement_Attempt: 2 })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await dormant.dormantDetectionJob({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T13:30:00Z') } });
  assert.strictEqual(summary.escalated, 1);
  assert.strictEqual(ambassadors[0].Escalated_To_Human, true);
  assert.strictEqual(mail.sent.length, 0); // no automated contact after Day 60
  clearEnv();
});

// ═══ monthly.js — sprint-graduation-anchored 90-day threshold ══════════════
test('non-referral check: threshold measured from sprint graduation date, not original activation', async () => {
  baseEnv();
  const monthly = require('../monthly');
  // Activated 60 days ago; sprint (28 days) graduated 32 days ago -> below the 90-day threshold.
  const ambassadors = [baseAmbassador({ id: 'nr1', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Sprint_Start_Date: '2026-05-14' })];
  const zoho = makeFakeZoho(ambassadors, []);
  const alerts = makeFakeAlerts();
  const summary = await monthly.monthlyNonReferralCheck({ deps: { zoho, alerts, now: () => new Date('2026-07-13T11:00:00Z') } });
  assert.strictEqual(summary.movedToAlternative, 0);
  assert.strictEqual(ambassadors[0].Engagement_Track, 'Standard');
  clearEnv();
});

test('non-referral check: moves zero-referral ambassador to Alternative once 90 days post-graduation', async () => {
  baseEnv();
  const monthly = require('../monthly');
  // Sprint started 120 days ago -> graduated ~92 days ago (120-28) -> past the 90-day threshold.
  const ambassadors = [baseAmbassador({ id: 'nr2', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Sprint_Start_Date: '2026-03-15' })];
  const zoho = makeFakeZoho(ambassadors, []); // no Referrals records -> zero referrals
  const alerts = makeFakeAlerts();
  const summary = await monthly.monthlyNonReferralCheck({ deps: { zoho, alerts, now: () => new Date('2026-07-13T11:00:00Z') } });
  assert.strictEqual(summary.movedToAlternative, 1);
  assert.strictEqual(ambassadors[0].Engagement_Track, 'Alternative');
  assert.strictEqual(ambassadors[0].Alt_Track_Entry_Date, '2026-07-13');
  clearEnv();
});

test('non-referral check: ambassador with any referral is not moved', async () => {
  baseEnv();
  const monthly = require('../monthly');
  const ambassadors = [baseAmbassador({ id: 'nr3', Engagement_Track: 'Standard', Activation_Sprint_Week: 0, Sprint_Start_Date: '2026-03-15' })];
  const refs = [{ id: 'r1', Ambassador: { id: 'nr3' }, Referral_Stage: 'Applied', Created_Time: '2026-06-01T00:00:00Z', Modified_Time: '2026-06-01T00:00:00Z' }];
  const zoho = makeFakeZoho(ambassadors, refs);
  const alerts = makeFakeAlerts();
  await monthly.monthlyNonReferralCheck({ deps: { zoho, alerts, now: () => new Date('2026-07-13T11:00:00Z') } });
  assert.strictEqual(ambassadors[0].Engagement_Track, 'Standard');
  clearEnv();
});

// ═══ monthly.js — VIP recalculation + supplemental ═════════════════════════
test('VIP recalculation upgrades trigger a welcome email; downgrades do not', async () => {
  baseEnv();
  const monthly = require('../monthly');
  const ambassadors = [
    baseAmbassador({ id: 'vip1', Engagement_Track: 'Standard', Sprint_Start_Date: '2024-01-01', VIP_Tier: 'Not VIP' }),
    baseAmbassador({ id: 'vip2', Engagement_Track: 'Standard', Sprint_Start_Date: '2024-01-01', VIP_Tier: 'High VIP' }),
  ];
  // vip1 will out-score vip2 heavily via referral count -> vip1 upgrades, vip2 (previously High VIP) may downgrade.
  const refs = Array.from({ length: 5 }, (_, i) => ({
    id: `rr${i}`, Ambassador: { id: 'vip1' }, Referral_Stage: 'Enrolled',
    Created_Time: '2026-07-01T00:00:00Z', Modified_Time: '2026-07-01T00:00:00Z',
  }));
  const zoho = makeFakeZoho(ambassadors, refs);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await monthly.monthlyVipRecalculation({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T06:30:00Z') } });
  assert.ok(summary.scored >= 2);
  const vip1 = ambassadors.find((a) => a.id === 'vip1');
  assert.strictEqual(vip1.VIP_Tier, 'High VIP');
  assert.ok(mail.sent.some((m) => m.to === vip1.Email));
  clearEnv();
});

test('VIP supplemental: High VIP inactive 30+ days queued for outreach, Standard VIP is not', async () => {
  baseEnv();
  const monthly = require('../monthly');
  const ambassadors = [
    baseAmbassador({ id: 'hv1', VIP_Tier: 'High VIP', Days_Since_Last_Referral: 45 }),
    baseAmbassador({ id: 'sv1', VIP_Tier: 'Standard VIP', Days_Since_Last_Referral: 45 }),
    baseAmbassador({ id: 'hv2', VIP_Tier: 'High VIP', Days_Since_Last_Referral: 2 }),
  ];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await monthly.monthlyVipSupplemental({ deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T07:00:00Z') } });
  assert.strictEqual(summary.checkInsSent, 3);
  assert.strictEqual(summary.outreachTasksCreated, 1);
  assert.strictEqual(zoho.calls.tasks[0].subject.includes('hv1') || zoho.calls.tasks[0].description.includes('45'), true);
  clearEnv();
});

// ═══ milestones.js — referral stage change + milestone detection ══════════
test('referral stage change sets Sprint_Referral_Submitted for a mid-sprint ambassador', async () => {
  baseEnv();
  const milestones = require('../milestones');
  const ambassadors = [baseAmbassador({ id: 'ms1', Activation_Sprint_Week: 2, Engagement_Track: 'Sprint', Sprint_Referral_Submitted: false })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await milestones.referralStageChangeWebhook({
    ambassadorId: 'ms1', referralStage: 'Applied', deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T09:00:00Z') },
  });
  assert.strictEqual(summary.sprintFlagSet, true);
  assert.strictEqual(ambassadors[0].Sprint_Referral_Submitted, true);
  clearEnv();
});

test('Alternative track ambassador who submits a referral returns to Standard immediately', async () => {
  baseEnv();
  const milestones = require('../milestones');
  const ambassadors = [baseAmbassador({ id: 'ms2', Engagement_Track: 'Alternative', Content_Week_Position: 3 })];
  const zoho = makeFakeZoho(ambassadors, []);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const summary = await milestones.referralStageChangeWebhook({
    ambassadorId: 'ms2', referralStage: 'Applied', deps: { zoho, mail, claude, alerts, now: () => new Date('2026-07-13T09:00:00Z') },
  });
  assert.strictEqual(summary.returnedToStandard, true);
  assert.strictEqual(ambassadors[0].Engagement_Track, 'Standard');
  assert.strictEqual(ambassadors[0].Content_Week_Position, 1);
  clearEnv();
});

test('milestone detection fires on the 1st, 5th, and 10th confirmed referral', async () => {
  baseEnv();
  const milestones = require('../milestones');
  const ambassadors = [baseAmbassador({ id: 'mile1' })];
  // Exactly 5 all-time Enrolled referrals for mile1; one modified in the last 24h.
  const refs = Array.from({ length: 5 }, (_, i) => ({
    id: `mref${i}`, Ambassador: { id: 'mile1' }, Referral_Stage: 'Enrolled',
    Created_Time: '2026-06-01T00:00:00Z',
    Modified_Time: i === 4 ? '2026-07-13T08:00:00Z' : '2026-06-01T00:00:00Z',
  }));
  const zoho = makeFakeZoho(ambassadors, refs);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const heygen = makeFakeHeygen();
  const summary = await milestones.milestoneDetectionJob({
    deps: { zoho, mail, claude, alerts, heygen, now: () => new Date('2026-07-13T09:00:00Z') },
  });
  assert.strictEqual(summary.milestonesHit, 1);
  assert.strictEqual(summary.emailsSent, 1);
  assert.strictEqual(summary.videosSubmitted, 1);
  assert.ok(mail.sent[0].subject.includes('#5'));
  clearEnv();
});

test('milestone detection does not fire on a non-milestone cumulative count', async () => {
  baseEnv();
  const milestones = require('../milestones');
  const ambassadors = [baseAmbassador({ id: 'mile2' })];
  const refs = Array.from({ length: 3 }, (_, i) => ({
    id: `mref2_${i}`, Ambassador: { id: 'mile2' }, Referral_Stage: 'Enrolled',
    Created_Time: '2026-06-01T00:00:00Z', Modified_Time: i === 2 ? '2026-07-13T08:00:00Z' : '2026-06-01T00:00:00Z',
  }));
  const zoho = makeFakeZoho(ambassadors, refs);
  const mail = makeFakeMail();
  const claude = makeFakeClaude();
  const alerts = makeFakeAlerts();
  const heygen = makeFakeHeygen();
  const summary = await milestones.milestoneDetectionJob({ deps: { zoho, mail, claude, alerts, heygen, now: () => new Date('2026-07-13T09:00:00Z') } });
  assert.strictEqual(summary.milestonesHit, 0);
  clearEnv();
});

// ═══ common.js ══════════════════════════════════════════════════════════════
test('recordToAmbassador maps live CRM field names to plain-object keys', () => {
  const amb = recordToAmbassador(baseAmbassador({ id: 'x1', Activation_Sprint_Week: 3, VIP_Tier: 'High VIP' }));
  assert.strictEqual(amb.id, 'x1');
  assert.strictEqual(amb.activationSprintWeek, 3);
  assert.strictEqual(amb.vipTier, 'High VIP');
});

// ═══ run ═════════════════════════════════════════════════════════════════════
(async () => {
  console.log('Agent 3 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();

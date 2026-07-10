'use strict';

/**
 * Standard four-week content calendar + Alternative track processing (design
 * §5, §7). Monday 9:00 AM CST job. Sprint ambassadors (Activation_Sprint_Week
 * > 0) are excluded from every query here — the sprint and standard cycle are
 * separate populations (design §2 non-negotiable rule).
 */

const M = require('./manifest');
const dates = require('./dates');
const { recordToAmbassador, ambassadorPatch, sendWithRetry } = require('./common');
const prompts = require('./prompts');
const story = require('./story');
const referrals = require('./referrals');
const { moduleAndVerify } = require('./sprint');

const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultClaude = require('./claude');
const defaultWorkdrive = require('./workdrive');
const defaultAlerts = require('./alerts');

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho,
    mail: d.mail || defaultMail,
    claude: d.claude || defaultClaude,
    workdrive: d.workdrive || defaultWorkdrive,
    alerts: d.alerts || defaultAlerts,
    now: (d.now && d.now()) || new Date(),
  };
}

/** Find the standard-cycle theme for a 1-4 content week position. */
function themeForPosition(position) {
  const entry = M.CONTENT_CALENDAR.find((c) => c.week === position) || M.CONTENT_CALENDAR[0];
  return entry.theme;
}

/**
 * Resolve the Week 3 Ambassador Spotlight target: the ambassador with the
 * most referrals in the past 30 days. Computed once per run (design §5.2:
 * a single spotlight, not per-recipient).
 */
async function resolveSpotlight({ zoho, referralsModuleApi, moduleApi, now }) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recent = await referrals.fetchReferralsSince(zoho, referralsModuleApi, since);
  const top = referrals.topReferrerId(recent);
  if (!top) return null;
  try {
    const rec = await zoho.getRecordById(moduleApi, top.ambassadorId);
    const amb = recordToAmbassador(rec);
    return { firstName: amb.firstName, referralCount: top.count };
  } catch {
    return { firstName: null, referralCount: top.count };
  }
}

async function buildStandardEmail(amb, theme, ctx) {
  const { claude, workdrive, alerts, deps } = ctx;
  const system = prompts.buildStandardSystemPrompt('', '');
  if (theme === 'Mission Moment') {
    return { subject: 'A mission moment', user: prompts.buildMissionMomentPrompt(amb) };
  }
  if (theme === 'Success Story') {
    let storyContent = null;
    let storyFile = null;
    try {
      const files = await workdrive.listStoryFiles(ctx.folder05Id, { prefix: M.STORY_FILE_PREFIX, suffix: M.STORY_FILE_SUFFIX });
      if (files.length < M.storyBufferMinimum() && !ctx.lowBufferAlerted.value) {
        ctx.lowBufferAlerted.value = true;
        await alerts.sendAlert({
          errorType: 'story buffer low', detail: `Only ${files.length} story file(s) in Folder 05 (minimum ${M.storyBufferMinimum()}).`,
          action: 'Add more story files via Agent 6 intake.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
        }, { deps });
      }
      const selected = await story.selectStory(amb.roleCategory, files, (id) => workdrive.downloadFileText(id));
      if (selected) { storyContent = selected.content; storyFile = selected.file.name; }
    } catch (err) {
      ctx.errors.push(`story selection failed: ${err.message}`);
    }
    if (!storyContent) {
      if (!ctx.emptyBufferAlerted.value) {
        ctx.emptyBufferAlerted.value = true;
        await alerts.sendAlert({
          errorType: 'story buffer empty', detail: 'Folder 05 contains no usable story files.',
          action: 'Add story files via Agent 6 intake. Using a Claude-generated placeholder in the meantime.',
          runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
        }, { deps });
      }
      storyContent = 'No story is available this cycle. Write a short, general placeholder that still centers a Gracelyn student\'s success without inventing specific details.';
    }
    return { subject: 'A story worth sharing', user: prompts.buildSuccessStoryPrompt(amb, storyContent), storyFile };
  }
  if (theme === 'Ambassador Spotlight') {
    return { subject: 'Ambassador spotlight', user: prompts.buildAmbassadorSpotlightPrompt(amb, ctx.spotlight) };
  }
  return { subject: 'Program update', user: prompts.buildProgramUpdatePrompt(amb, ctx.updateBrief) };
}

async function processStandardAmbassador(rec, moduleApi, ctx) {
  const { zoho, mail, claude, alerts, deps } = ctx;
  const amb = recordToAmbassador(rec);
  const theme = themeForPosition(amb.contentWeekPosition);
  const { subject, user, storyFile } = await buildStandardEmail(amb, theme, ctx);

  let body;
  try {
    body = await claude.generateEmail({ system: prompts.buildStandardSystemPrompt('', ''), user, maxTokens: 400 });
  } catch (err) {
    ctx.errors.push(`Claude generation failed for ${amb.id}: ${err.message}`);
    return { sent: false };
  }

  const res = await sendWithRetry({
    mail, alerts, to: amb.email, subject, text: body, ambassadorName: amb.firstName,
    errorType: 'standard cycle email failure', action: 'Ambassador marked for next cycle retry.',
    ctx, deps,
  });

  const nextPosition = amb.contentWeekPosition >= 4 ? 1 : amb.contentWeekPosition + 1;
  const patch = { contentWeekPosition: nextPosition };
  if (storyFile) patch.lastStoryFileUsed = storyFile;
  try {
    await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch(patch));
    if (storyFile) {
      await ctx.workdrive.markStoryUsed(ctx.folder05Id, { roleCategory: amb.roleCategory, filename: storyFile, today: ctx.date });
    }
  } catch (err) {
    ctx.errors.push(`CRM update failed for ${amb.id}: ${err.message}`);
  }

  return { sent: res.ok };
}

async function processAlternativeAmbassador(rec, moduleApi, ctx) {
  const { zoho, mail, claude, alerts, deps } = ctx;
  const amb = recordToAmbassador(rec);
  const month = amb.alternativeTrackEntryDate
    ? dates.monthsBetween(amb.alternativeTrackEntryDate, ctx.date) + 1
    : 1;
  const contentType = M.alternativeContentTypeForMonth(month);
  const user = prompts.buildAlternativeTrackPrompt(amb, contentType);
  const subjectByType = {
    [M.ALTERNATIVE_CONTENT_TYPES.storyInvitation]: 'Do you know a story worth sharing?',
    [M.ALTERNATIVE_CONTENT_TYPES.experienceInvitation]: 'Tell us about your Gracelyn experience',
    [M.ALTERNATIVE_CONTENT_TYPES.referralAsk]: 'One person, one message',
  };

  let body;
  try {
    body = await claude.generateEmail({ system: prompts.buildStandardSystemPrompt('', ''), user, maxTokens: 300 });
  } catch (err) {
    ctx.errors.push(`Claude generation failed for ${amb.id}: ${err.message}`);
    return { sent: false };
  }
  const res = await sendWithRetry({
    mail, alerts, to: amb.email, subject: subjectByType[contentType], text: body, ambassadorName: amb.firstName,
    errorType: 'alternative track email failure', action: 'Ambassador marked for next cycle retry.', ctx, deps,
  });
  try {
    await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch({ alternativeTrackMonth: month }));
  } catch (err) {
    ctx.errors.push(`CRM update failed for ${amb.id}: ${err.message}`);
  }
  return { sent: res.ok };
}

/**
 * Monday 9:00 AM CST job (design §7 batch processing). Standard track:
 * `Engagement_Track = Standard AND Activation_Sprint_Week = 0`. Alternative
 * track sends bi-weekly (gated on ISO week parity — every other Monday).
 */
async function weeklyEngagementCycle(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, workdrive, alerts, now } = deps;
  const today = dates.dateStr(now);
  const runCtx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = {
    standardProcessed: 0, standardSent: 0, alternativeProcessed: 0, alternativeSent: 0,
    halted: null, errors: [],
  };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, runCtx);
    moduleApi = v.moduleApi;
    if (v.missing.length) {
      summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`;
      return summary;
    }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  const referralsModuleApi = (await zoho.resolveModuleApiName(M.REFERRALS_MODULE)).apiName;
  const folder05Id = M.getEnv('WORKDRIVE_FOLDER_05_ID');
  const folder08Id = M.getEnv('WORKDRIVE_FOLDER_08_ID');

  let updateBrief = null;
  try { updateBrief = await workdrive.readUpdateBrief(folder08Id); } catch { /* fall through to Claude generation in prompt */ }

  const F = M.AMBASSADOR_FIELDS;

  const ctx = {
    zoho, mail, claude, workdrive, alerts, deps: input.deps,
    runType: 'scheduled', date: today, timeCst: dates.timeCst(now),
    folder05Id, updateBrief, errors: summary.errors,
    lowBufferAlerted: { value: false }, emptyBufferAlerted: { value: false },
    spotlight: null,
  };

  // Standard track — excludes sprint ambassadors (non-negotiable per design §2).
  let standardRecords = [];
  try {
    const criteria = `(${F.engagementTrack}:equals:${M.ENGAGEMENT_TRACK_VALUES.standard})and(${F.activationSprintWeek}:equals:0)`;
    standardRecords = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    summary.halted = `standard track query: ${err.message}`;
    await alerts.sendAlert({
      errorType: 'CRM query failure', detail: err.message,
      action: 'Weekly cycle did not run. Retry the Monday 9:00 AM job.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    return summary;
  }

  if (standardRecords.some((r) => Number(r[F.contentWeekPosition]) === 3 || !r[F.contentWeekPosition])) {
    try { ctx.spotlight = await resolveSpotlight({ zoho, referralsModuleApi, moduleApi, now }); } catch { /* spotlight optional */ }
  }

  const batchSize = M.weeklyBatchSize();
  for (let i = 0; i < standardRecords.length; i += batchSize) {
    const batch = standardRecords.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((rec) => processStandardAmbassador(rec, moduleApi, ctx).catch((err) => {
      summary.errors.push(`ambassador processing failed: ${err.message}`);
      return { sent: false };
    })));
    summary.standardProcessed += batch.length;
    summary.standardSent += results.filter((r) => r.sent).length;
  }

  // Alternative track — bi-weekly cadence gated on ISO week parity.
  if (dates.isoWeekNumber(now) % 2 === 0) {
    let altRecords = [];
    try {
      const criteria = `(${F.engagementTrack}:equals:${M.ENGAGEMENT_TRACK_VALUES.alternative})`;
      altRecords = await zoho.fetchAllRecords(moduleApi, { criteria });
    } catch (err) {
      summary.errors.push(`alternative track query failed: ${err.message}`);
    }
    for (const rec of altRecords) {
      const res = await processAlternativeAmbassador(rec, moduleApi, ctx).catch((err) => {
        summary.errors.push(`alternative ambassador processing failed: ${err.message}`);
        return { sent: false };
      });
      summary.alternativeProcessed += 1;
      if (res.sent) summary.alternativeSent += 1;
    }
  }

  return summary;
}

module.exports = { weeklyEngagementCycle, themeForPosition, resolveSpotlight, processStandardAmbassador, processAlternativeAmbassador };

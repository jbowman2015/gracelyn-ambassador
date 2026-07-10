'use strict';

/**
 * Plain-text email builders for every Agent 2 message: A, B, B-VIP, C (day 2/7/14),
 * the win-back email + its four survey-response paths, the day-75 reactivation,
 * and D / D-VIP (design §3, §5, §6). Kept separate from the function modules so
 * the orchestration logic and the copy can be reviewed independently.
 *
 * Every builder returns { subject, content } for mail.sendMail().
 */

const M = require('./manifest');

function formUrl(formId) {
  const base = M.getEnv('ZOHO_FORMS_BASE_URL');
  return base && formId ? `${base.replace(/\/+$/, '')}/${formId}` : (formId || '');
}

const REFERRAL_FEE_UNDERGRAD = '$100';
const REFERRAL_FEE_GRAD = '$200';

// ─── Function A2 — Email A: application received ──────────────────────────────
function buildEmailA(ambassador) {
  const subject = 'Your Gracelyn Ambassador application has been received';
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `Thank you for applying to the Gracelyn University Ambassador Program. We have received your application and it is now in review.`,
    ``,
    `You will hear back from our team soon with next steps. If you have any questions in the meantime, just reply to this email.`,
    ``,
    `Thank you for your interest in Gracelyn.`,
  ].join('\n');
  return { subject, content };
}

// ─── Function B4-Standard — Email B ────────────────────────────────────────────
function buildEmailB(ambassador) {
  const portal = M.getEnv('AMBASSADOR_PORTAL_URL');
  const subject = 'You are approved — welcome to the Gracelyn Ambassador Program';
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `Congratulations — your application has been approved. We are excited to have you join the Gracelyn Ambassador Program.`,
    ``,
    `Next step: complete the combined compliance form (the Ambassador Agreement, Code of Ethics, and Training Guide, all in one short form — about 10 minutes).`,
    formUrl(M.getEnv('COMBINED_FORM_ID')) && `Complete it here: ${formUrl(M.getEnv('COMBINED_FORM_ID'))}`,
    portal && `Your ambassador portal: ${portal}`,
    ``,
    `Your referral link becomes available in the portal as soon as compliance is complete.`,
  ].filter(Boolean).join('\n');
  return { subject, content };
}

// ─── Function B4-VIP — Email B-VIP ─────────────────────────────────────────────
function buildEmailBVip(ambassador, personalizationParagraph) {
  const portal = M.getEnv('AMBASSADOR_PORTAL_URL');
  const vipManagerEmail = M.getEnv('VIP_MANAGER_EMAIL');
  const subject = 'Welcome to Gracelyn — a personal note for you';
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `Congratulations — your application has been approved, and we are thrilled to welcome you to the Gracelyn Ambassador Program.`,
    ``,
    personalizationParagraph,
    ``,
    vipManagerEmail && `Your relationship manager, reachable at ${vipManagerEmail}, will be in touch personally to help you get started.`,
    `A short welcome video is on its way to you as well.`,
    ``,
    `Next step: complete the combined compliance form when you have a few minutes — your relationship manager is glad to walk through it with you.`,
    formUrl(M.getEnv('COMBINED_FORM_ID')) && `Complete it here: ${formUrl(M.getEnv('COMBINED_FORM_ID'))}`,
    portal && `Your ambassador portal: ${portal}`,
  ].filter(Boolean).join('\n');
  return { subject, content };
}

// ─── Function C3 — Email C reminders (day 2 / 7 / 14) ──────────────────────────
function buildEmailC(ambassador, tier) {
  const portal = M.getEnv('AMBASSADOR_PORTAL_URL');
  const link = formUrl(M.getEnv('COMBINED_FORM_ID'));
  const byTier = {
    day2: {
      subject: 'A quick reminder — finish your Gracelyn compliance form',
      body: `Just a brief reminder to complete your combined compliance form (the three-part Ambassador Agreement, Code of Ethics, and Training Guide) when you get a chance.`,
    },
    day7: {
      subject: 'Still time to complete your Gracelyn compliance form',
      body: `Completing the combined compliance form takes about 10 minutes. Once it's done, your referral link and portal access unlock right away.`,
    },
    day14: {
      subject: 'Final reminder — your Gracelyn referral link is waiting',
      body: `Your referral link becomes available as soon as your compliance form is complete. This is your final standard reminder — we would love to see you get started.`,
    },
  };
  const t = byTier[tier];
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    t.body,
    link && `Complete it here: ${link}`,
    portal && `Your ambassador portal: ${portal}`,
  ].filter(Boolean).join('\n');
  return { subject: t.subject, content };
}

// ─── Function C4 — Win-Back email + one-tap survey (design §3.1) ──────────────
function buildWinBackEmail(ambassador) {
  const surveyLink = formUrl(M.getEnv('WINBACK_SURVEY_FORM_ID'));
  const subject = 'No pressure — just checking in';
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `We know paperwork can be a real barrier, even when the intent is there. We would love to know what is getting in the way so we can help.`,
    ``,
    `Would you mind a quick one-tap answer?`,
    `(A) Too busy right now`,
    `(B) Confused about what to do`,
    `(C) Not sure I want to participate`,
    `(D) I had a technical problem`,
    surveyLink && `Tell us here: ${surveyLink}`,
    ``,
    `Whatever the answer, we are glad you applied and want to make this easy for you.`,
  ].filter(Boolean).join('\n');
  return { subject, content };
}

// ─── Function C5 — the four win-back survey response paths ────────────────────
function buildWinBackResponsePath(responseType, ambassador) {
  const supportEmail = M.getEnv('SUPPORT_COORDINATOR_EMAIL');
  const walkthroughUrl = M.getEnv('WINBACK_WALKTHROUGH_VIDEO_URL');
  const byType = {
    'Too Busy': {
      subject: 'Let\'s knock this out together — 10 minutes, on a call',
      content: [
        `Hi ${ambassador.firstName},`,
        ``,
        `Totally understand — life is busy. Would a quick 10-minute guided call help? Our coordinator can complete the compliance form with you live, so it is one and done.`,
        supportEmail && `Reply to this email or reach out to ${supportEmail} to find a time that works.`,
      ].filter(Boolean).join('\n'),
    },
    Confused: {
      subject: 'Here is a quick walkthrough for your compliance form',
      content: [
        `Hi ${ambassador.firstName},`,
        ``,
        `No worries at all — here is a short walkthrough video showing exactly how to complete the combined form, step by step.`,
        walkthroughUrl && `Watch it here: ${walkthroughUrl}`,
        `Reach out any time if you get stuck.`,
      ].filter(Boolean).join('\n'),
    },
    'Not Sure': {
      subject: 'A story worth remembering why you applied',
      content: [
        `Hi ${ambassador.firstName},`,
        ``,
        `We wanted to share something with you, not a reminder about paperwork, just a reminder of why this program exists.`,
        `Every ambassador who joins helps a student get access to an education they might not otherwise have. That is the whole mission, and it is worth being part of when you are ready.`,
        `No pressure at all. We are glad you applied, and the door stays open.`,
      ].filter(Boolean).join('\n'),
    },
    'Technical Problem': {
      subject: 'Let\'s fix that — reaching out personally',
      content: [
        `Hi ${ambassador.firstName},`,
        ``,
        `Sorry you ran into a technical problem. Our coordinator has been notified and will reach out to you personally to get this resolved.`,
        supportEmail && `You can also reach us directly at ${supportEmail}.`,
      ].filter(Boolean).join('\n'),
    },
  };
  return byType[responseType] || null;
}

// ─── Function C6 — Day 75 dormant reactivation ─────────────────────────────────
function buildDormantReactivationEmail(ambassador) {
  const link = formUrl(M.getEnv('COMBINED_FORM_ID'));
  const subject = 'Still thinking about Gracelyn?';
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `It has been a while since you applied to the Gracelyn Ambassador Program, and we have not wanted to crowd your inbox. This is the last note we will send about getting started.`,
    ``,
    `If you would still like to join, your application and compliance form are right where you left them.`,
    link && `Pick it back up here: ${link}`,
    ``,
    `If this is not the right season, that is completely understood. We are grateful you considered Gracelyn.`,
  ].filter(Boolean).join('\n');
  return { subject, content };
}

// ─── Function D3 — Email D activation ──────────────────────────────────────────
function buildEmailD(ambassador, { welcomeKitLinks = [], failures = [] } = {}) {
  const portal = M.getEnv('AMBASSADOR_PORTAL_URL');
  const subject = 'You are active — your Gracelyn referral link is ready';
  const kitLines = welcomeKitLinks.map((l) => `- ${l.name}: ${l.url}`);
  const failureLines = failures.map((f) => `- ${f.name}: unavailable right now, we will follow up with this file separately.`);
  const content = [
    `Hi ${ambassador.firstName},`,
    ``,
    `Your compliance steps are complete and your Gracelyn Ambassador account is now active.`,
    portal && `Your referral link and recruiting link are available in your portal: ${portal}`,
    ``,
    `Referral fee: ${REFERRAL_FEE_UNDERGRAD} per undergraduate referral, ${REFERRAL_FEE_GRAD} per graduate referral, paid once your referral completes 4 months of enrollment.`,
    ``,
    welcomeKitLinks.length && `Your welcome kit:`,
    ...kitLines,
    ...failureLines,
  ].filter(Boolean).join('\n');
  return { subject, content };
}

// ─── Function D3 (VIP variant) ─────────────────────────────────────────────────
function buildEmailDVip(ambassador, kit) {
  const base = buildEmailD(ambassador, kit);
  const vipManagerEmail = M.getEnv('VIP_MANAGER_EMAIL');
  const content = [
    base.content,
    ``,
    vipManagerEmail && `As always, your relationship manager is available at ${vipManagerEmail} — we would love to talk with you about co-creating content together.`,
  ].filter(Boolean).join('\n');
  return { subject: base.subject, content };
}

module.exports = {
  buildEmailA,
  buildEmailB,
  buildEmailBVip,
  buildEmailC,
  buildWinBackEmail,
  buildWinBackResponsePath,
  buildDormantReactivationEmail,
  buildEmailD,
  buildEmailDVip,
};

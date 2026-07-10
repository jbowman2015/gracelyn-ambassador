'use strict';

/**
 * Claude system + user prompts for Agent 3 (design §4.3, §5, §6.3).
 *
 * Voice rules are load-bearing across every email this agent generates:
 *   - Never use em dashes.
 *   - Never say commission. Always say referral fee.
 *   - Address the ambassador by first name.
 *   - End with a single clear next step, not a list.
 * The sprint system prompt (§4.3) is transcribed verbatim; the standard-cycle
 * and other email prompts extend the same rules to the rest of the calendar.
 */

const VOICE_RULES = `Rules:
- Never use em dashes
- Never say commission. Always say referral fee.
- Address the ambassador by first name
- Keep the email under 200 words
- End with a single clear next step, not a list`;

// ─── §4.3 — 30-Day Activation Sprint (shared system prompt, verbatim) ──────────
function buildSprintSystemPrompt(copyRules, voiceGuidelines) {
  return `You write personalized 30-Day Activation Sprint emails for Gracelyn University ambassadors. These emails are warmer and more personally direct than standard engagement emails. Each email addresses the ambassador at a specific moment in their first month. The tone is supportive, specific, and mission-aligned. ${VOICE_RULES}
No sprint email contains a mass-share ask. Every outreach prompt is framed as one person, one conversation.
COPY RULES: ${copyRules || ''}
VOICE GUIDELINES: ${voiceGuidelines || ''}`;
}

function buildSprintWeek1Prompt(ambassador) {
  return `Ambassador first name: ${ambassador.firstName}
Role category: ${ambassador.roleCategory || 'Unknown'}
Referral link: ${ambassador.referralLink || ''}
Write the Sprint Week 1 email. This is sent immediately on activation. Confirm compliance is complete and the referral link is active. Introduce the ambassador portal and where to find everything. Introduce the ambassador community and encourage first engagement. Warm and celebratory tone. This is the first impression of active membership; it must feel like a genuine welcome, not a checklist.`;
}

function buildSprintWeek2Prompt(ambassador) {
  return `Ambassador first name: ${ambassador.firstName}
Role category: ${ambassador.roleCategory || 'Unknown'}
Referral link: ${ambassador.referralLink || ''}
Write the Sprint Week 2 email. Acknowledge that Week 1 was orientation. Week 2 is about taking the first step. Provide a specific, concrete suggestion: think of one person in your network right now who is already doing the work of teaching but does not have the credential. Share your referral link with them specifically. Include the referral link prominently. Frame this as one person, not a campaign. Soft and specific, not a mass-share ask.`;
}

// §4.3 — Week 3 user prompt, verbatim (adjusts framing on Sprint_Referral_Submitted).
function buildSprintWeek3Prompt(ambassador) {
  const hasReferred = !!(ambassador.sprintReferralSubmitted != null ? ambassador.sprintReferralSubmitted : ambassador.Sprint_Referral_Submitted);
  return `Ambassador first name: ${ambassador.firstName}
Role category: ${ambassador.roleCategory}
Motivation tag: ${ambassador.motivationTag}
Has submitted a referral during the sprint: ${hasReferred}
Write the Sprint Week 3 email. If has_referred is true: open with genuine celebration of their referral. Acknowledge they are already making an impact. Encourage them to continue. Include referral link. If has_referred is false: open with a success story angle. Share what it looks like when an ambassador refers someone who goes on to succeed. Include a pre-written forwarding message they can send to one specific person. Include referral link.`;
}

function buildSprintWeek4Prompt(ambassador) {
  return `Ambassador first name: ${ambassador.firstName}
Role category: ${ambassador.roleCategory || 'Unknown'}
Referral link: ${ambassador.referralLink || ''}
Write the Sprint Week 4 email. This is the final sprint week before the standard cycle begins. Invite the ambassador to reflect on what they want to accomplish in their first 90 days as an active ambassador. Prompt them to think about how many people they could realistically introduce to Gracelyn, and whether there are community events, conversations, or contexts where this naturally fits. Frame the standard weekly cycle as ongoing support for their personal goal. Warm close with mission reconnection.`;
}

function buildSprintGraduationPrompt(ambassador) {
  return `Ambassador first name: ${ambassador.firstName}
Write the sprint graduation email, sent on Day 30. Brief, warm, mission-aligned. Acknowledge the first month and look forward to what comes next. Do not include a referral ask.`;
}

// ─── §5 — Standard four-week content calendar ─────────────────────────────────
function buildStandardSystemPrompt(copyRules, voiceGuidelines) {
  return `You write personalized weekly engagement emails for Gracelyn University ambassadors as part of the standard four-week content calendar. The tone is warm, mission-aligned, and consistent with Gracelyn's voice. ${VOICE_RULES}
COPY RULES: ${copyRules || ''}
VOICE GUIDELINES: ${voiceGuidelines || ''}`;
}

function buildMissionMomentPrompt(ambassador) {
  const framing = {
    'Mission Impact': 'a student-centered story framing',
    'Professional Growth': 'a teacher development framing',
    'Kingdom Calling': 'a faith and calling framing',
  }[ambassador.motivationTag] || 'a general mission-connection framing';
  return `Ambassador first name: ${ambassador.firstName}
Motivation tag: ${ambassador.motivationTag || 'Unknown'}
Referral link: ${ambassador.referralLink || ''}
Write the Week 1 Mission Moment email: a brief reflection on the Gracelyn mission and why it matters, personalized with ${framing}. Include the referral link with a soft invitation to share.`;
}

function buildSuccessStoryPrompt(ambassador, storyContent) {
  return `Ambassador first name: ${ambassador.firstName}
Referral link: ${ambassador.referralLink || ''}
Source story (from the WorkDrive story buffer, summarize and personalize, do not copy verbatim):
${storyContent}
Write the Week 2 Success Story email: summarize and personalize this student success story for this ambassador. Include the referral link with a mission-connect framing.`;
}

function buildAmbassadorSpotlightPrompt(ambassador, spotlight) {
  return `Ambassador first name: ${ambassador.firstName}
Spotlighted ambassador first name: ${spotlight && spotlight.firstName ? spotlight.firstName : 'a fellow ambassador'}
Spotlighted ambassador referral count (past 30 days): ${spotlight && spotlight.referralCount != null ? spotlight.referralCount : 'several'}
Write the Week 3 Ambassador Spotlight email: recognize the spotlighted ambassador's referral activity, celebrate the community, and include a soft referral encouragement for the recipient.`;
}

function buildProgramUpdatePrompt(ambassador, updateBrief) {
  return `Ambassador first name: ${ambassador.firstName}
Referral link: ${ambassador.referralLink || ''}
Program update brief (may be empty; if empty, generate a mission-aligned forward-looking message instead):
${updateBrief || ''}
Write the Week 4 Program Update email: share program news and a forward-looking message from the university. Include the referral link.`;
}

// ─── §5.4 — Alternative track content ──────────────────────────────────────────
function buildAlternativeTrackPrompt(ambassador, contentType) {
  const M = require('./manifest');
  if (contentType === M.ALTERNATIVE_CONTENT_TYPES.storyInvitation) {
    return `Ambassador first name: ${ambassador.firstName}
Write a warm invitation for this ambassador to share a student success story they know about. Link to the Agent 6 story intake form. Do not include a referral ask.`;
  }
  if (contentType === M.ALTERNATIVE_CONTENT_TYPES.experienceInvitation) {
    return `Ambassador first name: ${ambassador.firstName}
Write a warm invitation for this ambassador to share their own Gracelyn experience for the asset library. Do not include a referral ask.`;
  }
  return `Ambassador first name: ${ambassador.firstName}
Referral link: ${ambassador.referralLink || ''}
Write a one-tap referral ask: a pre-written message the ambassador can forward to one specific person. Frame it as one person, one message, no pressure. Include the referral link.`;
}

// ─── §5.1 — Dormant track re-engagement ────────────────────────────────────────
function buildDormantReEngagementPrompt(ambassador, attemptNumber) {
  const tone = attemptNumber === 1
    ? 'a gentle check-in, assuming they are simply busy, not disengaged'
    : 'a warmer, more direct check-in that asks honestly whether now is the right season for them to stay active';
  return `Ambassador first name: ${ambassador.firstName}
Re-engagement attempt number: ${attemptNumber}
Write a re-engagement email with ${tone}. Do not guilt or pressure. End with a single easy next step.`;
}

// ─── §6.3 — VIP supplemental cycle ─────────────────────────────────────────────
function buildVipCheckInPrompt(ambassador) {
  return `Ambassador first name: ${ambassador.firstName}
VIP tier: ${ambassador.vipTier || 'Standard VIP'}
Write a warm, personal monthly check-in email for a VIP ambassador. Acknowledge their impact specifically. No generic mass-program language.`;
}

function buildVipTierUpgradePrompt(ambassador, newTier) {
  return `Ambassador first name: ${ambassador.firstName}
New VIP tier: ${newTier}
Write a personal recognition message celebrating this ambassador's upgrade to ${newTier}. Warm, specific, and mission-aligned.`;
}

// ─── §2.2 — Referral stage-change notifications (Email E / Email F) ───────────
function buildReferralNotificationPrompt(ambassador, stage) {
  if (stage === 'Enrolled') {
    return `Ambassador first name: ${ambassador.firstName}
Write Email F: notify this ambassador that a referral they made has enrolled at Gracelyn University. Celebrate the outcome specifically. Do not use the word commission; use referral fee if payment is mentioned.`;
  }
  return `Ambassador first name: ${ambassador.firstName}
Write Email E: notify this ambassador that a referral they made has applied to Gracelyn University. Warm, encouraging update. Do not use the word commission; use referral fee if payment is mentioned.`;
}

// ─── Milestone recognition (design §2.2 daily milestone detection) ────────────
function buildMilestonePrompt(ambassador, milestoneNumber) {
  return `Ambassador first name: ${ambassador.firstName}
Milestone: referral number ${milestoneNumber}
Write a milestone recognition email celebrating this specific referral milestone. Warm and specific, not generic.`;
}

module.exports = {
  VOICE_RULES,
  buildSprintSystemPrompt,
  buildSprintWeek1Prompt,
  buildSprintWeek2Prompt,
  buildSprintWeek3Prompt,
  buildSprintWeek4Prompt,
  buildSprintGraduationPrompt,
  buildStandardSystemPrompt,
  buildReferralNotificationPrompt,
  buildMissionMomentPrompt,
  buildSuccessStoryPrompt,
  buildAmbassadorSpotlightPrompt,
  buildProgramUpdatePrompt,
  buildAlternativeTrackPrompt,
  buildDormantReEngagementPrompt,
  buildVipCheckInPrompt,
  buildVipTierUpgradePrompt,
  buildMilestonePrompt,
};

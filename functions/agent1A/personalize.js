'use strict';

/**
 * Claude API email personalization (design doc §5.2, §5.3). Prompt builders
 * are pure functions — unit-testable without network. personalizeEmail() is
 * the thin I/O wrapper that calls the Anthropic Messages API and applies the
 * template-guard (falls back to the unmodified template on any deviation or
 * API failure, per design doc §7 error handling).
 */

const https = require('https');
const { deviatesFromTemplate } = require('./template-guard');

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const ANTHROPIC_API_HOST = process.env.ANTHROPIC_API_HOST || 'api.anthropic.com';

function buildEmailSystemPrompt(assets) {
  const rules = assets['ambassador_copy_rules.txt'] || '(not available this run)';
  const voice = assets['ambassador_voice_guidelines.txt'] || '(not available this run)';
  const frames = assets['ambassador_motivation_frames.txt'] || '(not available this run)';
  return `You are personalizing ambassador recruiting emails for Gracelyn University. ` +
    `Your job is to make ONE targeted change to the provided email template: rewrite the ` +
    `opening sentence only to feel personal to this specific recipient. Do not change the ` +
    `structure, the mission framing, the simple ask, or the referral fee mention. Do not add ` +
    `or remove paragraphs. The opening sentence should reference the recipient's role or ` +
    `community in a way that feels specific, not generic. Use the motivation hypothesis to ` +
    `select the right angle: mission impact, professional growth, kingdom calling, ` +
    `recognition, or pride and gratitude.\n\n` +
    `COPY RULES (follow all of these without exception):\n${rules}\n\n` +
    `VOICE GUIDELINES (match this voice throughout):\n${voice}\n\n` +
    `MOTIVATION FRAMES (use the relevant frame for the opening sentence):\n${frames}\n\n` +
    `Return the complete personalized email body as plain text. No preamble. No explanation. ` +
    `Just the email body.`;
}

function buildEmailUserPrompt(templateBody, firstName, roleCategory, motivationHyp, organization) {
  const orgContext = organization
    ? `They work at or are associated with: ${organization}.`
    : 'Organization not known.';
  return `Personalize this email for the following recipient.\n\n` +
    `RECIPIENT:\nFirst name: ${firstName}\nRole category: ${roleCategory}\n` +
    `Motivation hypothesis: ${motivationHyp}\n${orgContext}\n\n` +
    `EMAIL TEMPLATE TO PERSONALIZE:\n${templateBody}\n\n` +
    `Rewrite only the opening sentence to feel personal to this recipient. Return the ` +
    `complete email body with your personalized opening sentence replacing the original ` +
    `first sentence. Everything else stays identical.`;
}

function callAnthropic(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const req = https.request({
      hostname: ANTHROPIC_API_HOST,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch { /* leave as string */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Personalizes one email. Returns { body, personalized: boolean, reason? }.
 * Falls back to the unmodified template on non-200, malformed response, or
 * structural deviation — never throws (design doc §7: individual Claude
 * failures don't abort the run).
 */
async function personalizeEmail(contact, emailTemplate, assets, anthropicCaller = callAnthropic) {
  const motivationHyp = contact.motivationHyp || 'Unknown';
  const roleCategory = contact.roleCategory || 'educator';
  const firstName = contact.firstName || 'Friend';
  const organization = contact.organization || '';

  let res;
  try {
    res = await anthropicCaller(
      buildEmailSystemPrompt(assets),
      buildEmailUserPrompt(emailTemplate, firstName, roleCategory, motivationHyp, organization)
    );
  } catch (err) {
    return { body: emailTemplate, personalized: false, reason: `Claude API request failed: ${err.message}` };
  }

  if (res.status !== 200 || !res.body || !Array.isArray(res.body.content) || !res.body.content[0]) {
    return { body: emailTemplate, personalized: false, reason: `Claude API non-200 or malformed response (HTTP ${res.status})` };
  }

  const candidate = res.body.content[0].text;
  if (deviatesFromTemplate(emailTemplate, candidate)) {
    return { body: emailTemplate, personalized: false, reason: 'Personalized output deviated from template structure' };
  }

  return { body: candidate, personalized: true };
}

module.exports = { buildEmailSystemPrompt, buildEmailUserPrompt, personalizeEmail };

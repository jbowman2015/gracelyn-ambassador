'use strict';

/**
 * Pure run-mode classification and CRM record/payload builders for Agent 1B
 * (design doc §4.1/§4.2). No network — index.js/orchestrate.js hand these
 * plain objects to zoho.crmCreateRecord()/crmUpdateRecord(). Mirrors
 * functions/agent1A/sequencing.js.
 */

const M = require('./manifest');

const VALID_TRIGGER_TYPES = ['post_cycle', 'intelligence_cycle'];

function classifyRunMode(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Missing request body.' };
  }
  const { trigger_type: triggerType } = payload;
  if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
    return { ok: false, error: `Unknown trigger_type "${triggerType}". Expected one of: ${VALID_TRIGGER_TYPES.join(', ')}.` };
  }
  return { ok: true, triggerType, payload };
}

/** Design doc §4.2 Step 4: new prospect record from a community-monitoring discovery. */
function buildProspectRecord({ name, socialProfileUrl, channelSource, roleCategory }) {
  return {
    Name: name || 'Unknown',
    Social_Profile_URL: socialProfileUrl,
    Channel_Source: channelSource || '',
    Outreach_Status: M.OUTREACH_STATUS_NEW_PROSPECT_VALUE,
    Contact_Found: false,
    Role_Category: roleCategory || '',
  };
}

/** Design doc §4.2 Step 5: flag an existing (or newly-created) prospect as high engagement. */
function buildHighEngagementUpdate(recordId) {
  return { id: recordId, High_Engagement_Flag: true };
}

/** Design doc §5 Stage 4: VIP Prospect accepted and transitioned to Ambassador. */
function buildConvertedUpdate(recordId) {
  return { id: recordId, Outreach_Status: M.OUTREACH_STATUS_CONVERTED_VALUE };
}

/**
 * Design doc §4.1 Step 6: one Social Post Log record per platform. Field
 * names are provisional — the module does not exist live yet (manifest.js
 * divergence #7) so these were never reconciled against real Zoho metadata;
 * confirm/adjust once the module is created (see DEPLOY.md).
 */
function buildSocialPostLogRecord({ platform, postId, captionText, assetFilename, postedAt, status }) {
  return {
    Platform: platform,
    Post_ID: postId || '',
    Caption_Text: captionText || '',
    Asset_Filename: assetFilename || '',
    Posted_At: postedAt,
    Status: status,
  };
}

/** Design doc §5.1: the warm-follow engagement alert payload sent to Make.com Scenario 3. */
function buildWarmFollowAlertPayload({ prospectName, postUrl, matchedKeywords, suggestedResponse, prospectRecordId }) {
  return {
    trigger_source: 'agent_1b_warm_follow',
    prospect_name: prospectName,
    prospect_record_id: prospectRecordId || null,
    post_url: postUrl,
    matched_keywords: matchedKeywords,
    relevance_summary: `Posted content matching: ${matchedKeywords.join(', ')}.`,
    suggested_engagement_response: suggestedResponse,
  };
}

module.exports = {
  VALID_TRIGGER_TYPES,
  classifyRunMode,
  buildProspectRecord,
  buildHighEngagementUpdate,
  buildConvertedUpdate,
  buildSocialPostLogRecord,
  buildWarmFollowAlertPayload,
};

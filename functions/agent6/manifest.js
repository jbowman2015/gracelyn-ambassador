'use strict';

/**
 * Agent 6 — Story Content Intake: canonical constants.
 *
 * Agent 6's actual content pipeline (Zoho Forms -> Zoho Flow -> WorkDrive
 * Folder 05) runs as a native Zoho Flow with Deluge scripting, not as
 * Catalyst code (design doc §1, §5). The single Catalyst function this repo
 * ships is the daily buffer-monitoring job (design doc §6). `filename.js` and
 * `storyFile.js` are JS ports of the Flow's Deluge logic (design doc §5.1,
 * §5.2) kept here as the tested, reconciled specification the Flow itself
 * must match — not because Catalyst runs them at intake time.
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - ENV-VAR names are the canonical strings from agent5A/manifest.js /
 *     Ambassador_Master_Reference_Sheet.md §1 and the design doc §10.
 *   - Coordination Point #1 (ROLE_CATEGORY header): confirmed 2026-07-10 by
 *     the Agent 3 session (see docs/planning/Agent_Build_Playbook.md, Agent 6
 *     entry, and functions/agent3/manifest.js ROLE_CATEGORY_HEADER). The
 *     literal label is `ROLE_CATEGORY` — must stay byte-identical here.
 *   - ROLE_CATEGORIES vocabulary: the design doc v2 §3.1 Role Category
 *     dropdown lists only five values (K12 Educator, Early Childhood, Faith
 *     Community, Youth Serving Professional, Any). That is stale. Agent 0
 *     (functions/agent0/manifest.js) and Agent 3 (functions/agent3/manifest.js)
 *     both already use the reconciled six-category vocabulary plus the
 *     separate "Any" catch-all value — confirmed live and explicitly called
 *     out in the Agent Build Playbook's Agent 6 entry ("Confirmed 2026-07-10
 *     by the Agent 3 session"). Agent 6 builds to that reconciled truth: the
 *     Zoho Forms Role Category dropdown must offer all six ROLE_CATEGORIES
 *     below plus the literal "Any", not the doc's five. Flagged for Parmeet
 *     to configure the form dropdown accordingly (see README.md).
 *   - Agent 6 does not interact with Zoho CRM for story intake itself (design
 *     doc §2.3). The one exception is the buffer job's "used file exclusion"
 *     (design doc §6): it reads `Last_Story_File_Used` across Ambassador
 *     records to avoid counting stories Agent 3 already consumed this week.
 *     The design doc's own §1/§10 credential tables omit CRM credentials
 *     entirely, so this is treated as best-effort: the CRM trio below is
 *     OPTIONAL, and the buffer job degrades gracefully (counts without
 *     used-file exclusion, and says so in the alert) when it's absent,
 *     the same defensive pattern Agent 3 uses for Agent 2's not-yet-created
 *     fields. `Last_Story_File_Used` is Agent 3's field (created live
 *     2026-07-10 on Ambassadors) — reused here verbatim, not re-declared.
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
const ENV_SPEC = [
  // Zoho WorkDrive OAuth trio — Folder 05 story buffer scan (design §1, §10).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_05_ID', required: true, group: 'WorkDrive',
    note: 'Must be the same folder id Agent 3 uses (design §9.1). Confirm with the Agent 3 developer and Parmeet.' },

  // Zoho Mail OAuth trio — buffer alert emails only (design §1, §6).
  { key: 'ZOHO_MAIL_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'AMBASSADOR_MAIL_FROM_ADDRESS', required: false, group: 'Zoho',
    note: 'Default ambassadors@gracelyn.edu, same as Agent 3.' },

  // Zoho CRM OAuth trio — OPTIONAL. Only used for the buffer job's "used file
  // exclusion" read of Last_Story_File_Used across Ambassadors (design §6).
  // The design doc's own credential tables (§1, §10) omit CRM entirely, so
  // this degrades gracefully rather than being treated as required.
  { key: 'ZOHO_CRM_CLIENT_ID', required: false, group: 'Zoho',
    note: 'Optional. Enables used-file exclusion in the buffer count (design §6). Needs Ambassadors read scope.' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: false, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: false, group: 'Zoho' },
  { key: 'AMBASSADORS_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Confirmed live (Agent 3, 2026-07-10): Ambassadors.' },

  // Policy thresholds (Ambassador_Master_Reference_Sheet.md §5, design §6).
  { key: 'STORY_BUFFER_MINIMUM', required: false, group: 'Policy', note: 'Default 4. Parmeet may adjust without developer help.' },

  // Alert routing (design §1, §10).
  { key: 'PARMEET_ALERT_EMAIL', required: true, group: 'Alerts', note: 'Buffer alerts + Flow error notifications.' },
  { key: 'STORY_INTAKE_FORM_URL', required: true, group: 'Config', note: 'Included in every buffer alert for one-click submission.' },
  { key: 'MAKE_BUFFER_ALERT_WEBHOOK', required: false, group: 'Make.com', note: 'Buffer alert routing scenario.' },
  { key: 'ZOHO_FLOW_ID', required: false, group: 'Config', note: 'Manual-trigger reference only; the Flow itself runs outside Catalyst.' },
];

/** Resolve an env value by canonical key, then any documented alias. */
function getEnv(key) {
  const spec = ENV_SPEC.find((e) => e.key === key);
  const names = [key, ...((spec && spec.aliases) || [])];
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

function getEnvInt(key, fallback) {
  const v = getEnv(key);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function storyBufferMinimum() { return getEnvInt('STORY_BUFFER_MINIMUM', 4); }

// ─── CRM (optional; used-file exclusion only) ─────────────────────────────────
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };
// Reused verbatim from functions/agent3/manifest.js AMBASSADOR_FIELDS — both
// created live on Ambassadors 2026-07-10. Do not re-derive; Agent 3 owns these
// fields. LAST_ENGAGEMENT_DATE_FIELD approximates "used this week" (see zoho.js
// doc-comment for the caveat — confirm this date mapping with Agent 3).
const LAST_STORY_FILE_USED_FIELD = 'Last_Story_File_Used';
const LAST_ENGAGEMENT_DATE_FIELD = 'Last_Engagement_Date';

// ─── Story file convention (Coordination Point #1 with Agent 3) ──────────────
// The second line of every story file in WorkDrive Folder 05 is a metadata
// header of the exact form `ROLE_CATEGORY: <value>`. This literal label
// must stay byte-identical to functions/agent3/manifest.js ROLE_CATEGORY_HEADER.
const ROLE_CATEGORY_HEADER = 'ROLE_CATEGORY';
const ROLE_CATEGORY_ANY = 'Any';
const STORY_FILE_PREFIX = 'Story_';
const STORY_FILE_SUFFIX = '.txt';
const MAX_FILENAME_LENGTH = 100;
const MAX_SANITIZED_TITLE_LENGTH = 80;

// Six controlled role categories (matches functions/agent0/manifest.js and
// functions/agent3/manifest.js ROLE_CATEGORIES — the reconciled live vocabulary,
// not the design doc v2's stale five-value list). "Any" is a separate literal,
// selectable in the form as its own catch-all option (design doc §3.1 note).
const ROLE_CATEGORIES = [
  'K12 Educator', 'Early Childhood', 'Faith Community',
  'Youth Serving Professional', 'Mission Aligned Influencer', 'Gracelyn Community',
];

// All values the Role Category form dropdown must offer (design §3.1 + Coordination #1).
const FORM_ROLE_CATEGORY_VALUES = [...ROLE_CATEGORIES, ROLE_CATEGORY_ANY];

// Buffer categories the daily job counts per-category (design §6).
const BUFFER_CATEGORIES = FORM_ROLE_CATEGORY_VALUES;

const MAX_STORIES_PER_SUBMISSION = 5;
const MAX_TITLE_LENGTH = 80;

// Header line order, in exact order (design §4).
const HEADER_FIELDS = ['STORY TITLE', 'ROLE_CATEGORY', 'TARGET WEEK', 'SUBMITTED BY', 'SUBMITTED AT'];
const FILE_SEPARATOR = '---';

module.exports = {
  ENV_SPEC,
  getEnv,
  getEnvInt,
  storyBufferMinimum,
  AMBASSADORS_MODULE,
  LAST_STORY_FILE_USED_FIELD,
  LAST_ENGAGEMENT_DATE_FIELD,
  ROLE_CATEGORY_HEADER,
  ROLE_CATEGORY_ANY,
  STORY_FILE_PREFIX,
  STORY_FILE_SUFFIX,
  MAX_FILENAME_LENGTH,
  MAX_SANITIZED_TITLE_LENGTH,
  ROLE_CATEGORIES,
  FORM_ROLE_CATEGORY_VALUES,
  BUFFER_CATEGORIES,
  MAX_STORIES_PER_SUBMISSION,
  MAX_TITLE_LENGTH,
  HEADER_FIELDS,
  FILE_SEPARATOR,
};

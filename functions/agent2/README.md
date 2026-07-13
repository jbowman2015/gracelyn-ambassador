# Agent 2 — Onboarding

Moves an approved ambassador from application submission to active status:
routes each applicant to the Standard or VIP track, manages the combined
compliance form and its reminder/win-back sequence, runs Phase 1 (manual) or
Phase 2 (auto-approve) approval, and activates successful ambassadors into
Agent 3's engagement cycle. Built against
`docs/design/Gracelyn_Agent_2_Onboarding_v2.md`. The most complex agent in the
program — largest CRM surface, first agent to send mail directly.

## What it does (design §6)

- **Function A — Application Received.** Reads the Ambassador CRM record the
  existing blueprint workflow already created from the Zoho Forms submission,
  sends Email A, marks a matching Prospect `Outreach_Status = Applied` (no
  duplicate creation), and writes the approval-queue date.
- **Function B — Approval and Track Routing.** Phase 1 (`APPROVAL_MODE=MANUAL`)
  takes no action until a coordinator manually approves. Phase 2 (`AUTO`) runs
  all five auto-approve criteria; any failure routes to the exception queue.
  `VIP_Prospect_Origin = true` always overrides AUTO and routes to human
  review — never auto-approved. Branches on `VIP_Flag` for the welcome email;
  VIP adds a Claude-personalized paragraph, a HeyGen video job, and a
  relationship-manager notification.
- **Function C — Compliance Reminders and Win-Back.** Daily 8:30 AM CST sweep:
  day 2/7/14 reminders with a 5-day minimum gap, day 15 win-back (replaces
  reminders entirely), and day 75 dormant transition with a final reactivation
  email. A separate route handles the four win-back survey response paths
  (calendar call, walkthrough video, mission re-engagement, support contact).
- **Function D — Activation.** Classifies motivation via Claude (max_tokens
  10, retry once, falls back to `Unknown` and flags for review), generates
  30-day welcome-kit share links, **upgrades the WordPress role before
  sending Email D** (the design's hard gate — the referral link must never be
  shared before portal access is confirmed), notifies Agent 3, notifies the
  VIP relationship manager for co-creation follow-up (VIP only), and writes
  the compliance form version audit field.
- **Threshold alerts.** Daily active-ambassador count check — alerts at 800
  (approaching) and 1,000 (decision required). Never flips `APPROVAL_MODE`
  itself; that is always Parmeet's action.

## CRM reconciliation (completed live 2026-07-10)

Per `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`, the Ambassadors
module was pulled live before any code was written. It is the existing custom
module **`Ambassadors`** (`CustomModule37`) — confirm `AMBASSADORS_MODULE_API_NAME`
is set to `Ambassadors`. At reconciliation time it had only 60 fields; four of
the design doc's field names mapped onto existing fields under a **different**
name (not duplicated), and 23 fields were missing and created live.

**Mapped to an existing field (no duplicate created):**

| Design doc name | Live Zoho field |
| --- | --- |
| `Ethics_Acknowledged` | `Ethics_Signed` |
| `Training_Complete` | `Training_Completed` |
| `Approval_Date` | `Approved_Date` |
| `Status` (generic) | `Ambassador_Status` (Applicant/Approved/Active/Suspended/Terminated) |
| `Agreement_Signed` | `Agreement_Signed` (exact match) |
| `Compliance_Complete` | `Compliance_Complete` (exact match) |

**Created live (23) — three renamed to fit Zoho's 25-character field-label limit,
one created as text instead of picklist for the same reason Agent 0 hit on
`Role_Category` (two of the six controlled role values exceed the 25-char
picklist-option limit):**

- `VIP_Flag`, `VIP_Prospect_Origin`, `Fraud_Flag`, `Motivation_Tag`,
  **`Motivation_Response`** (design doc: `Motivation_Discovery_Response`),
  **`Ambassador_Role_Category`** (text, not picklist), `Audience_Track`,
  `Auto_Approved`, `Auto_Approve_Timestamp`,
  **`Auto_Approve_Version`** (design doc: `Auto_Approve_Criteria_Version`),
  **`Compliance_Form_Version`** (design doc: `Last_Compliance_Form_Version`),
  `Win_Back_Sent`, `Win_Back_Survey_Response`, `Win_Back_Response_Date`,
  `Dormant_Compliance`, `Last_Reminder_Sent_Date`, `VIP_HeyGen_Job_ID`,
  `VIP_Relationship_Manager`, `Recruited_By`, `Approval_Queue_Added_Date`,
  `Needs_Exception_Review`, `Exception_Reason`, `Consent_Given`.

`Fraud_Flag` did not exist anywhere in the org — Agent 2 establishes it now;
Agent 4 (not yet built) should reuse this exact name per the design doc §12.2.

The full map is `functions/agent2/manifest.js` → `AMBASSADORS_FIELDS`. At
startup, every route calls `zoho.verifyFields` against the live module and
alerts Parmeet on any divergence — see `index.js` → `resolveContext`.

**Ambassador_Leads (Prospects) — no change needed.** Function A3 sets
`Outreach_Status = Applied`; that value already existed as a valid picklist
option on the existing `Outreach_Status` field (confirmed live, no edit made).

**Known open item:** a live re-fetch during this build also showed 16 fields
on the Ambassadors module this session did not create (`Engagement_Track`,
`VIP_Score`, `VIP_Tier`, `Last_Engagement_Date`, etc.) — these read as Agent
3/4 fields, meaning another session was concurrently editing the same live
module. Nothing here depends on them; flagged for awareness only.

## Routes

```
POST /application-received     Function A — Make.com Scenario 1
POST /approval                 Function B — Make.com Scenario 2
POST /compliance-check         Function C daily sweep — Catalyst job, 8:30 AM CST
POST /winback-survey-response  Function C survey routing — Make.com Scenario 4
POST /activation                Function D — Make.com Scenario 5
POST /threshold-check          Active-ambassador threshold alerts — Catalyst daily job
GET  /health                   liveness
```

## Environment variables

Canonical names (aliases accepted for design-doc spellings):

- **AI:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-20250514`)
- **Zoho CRM:** `ZOHO_CRM_*` trio
- **Zoho Mail:** `ZOHO_MAIL_*` trio + `ZOHO_MAIL_ACCOUNT_ID` (not in the design
  doc's env table — required by the Zoho Mail send API; flag for Parmeet) +
  `ZOHO_MAIL_FROM_ADDRESS` (default `ambassadors@gracelyn.edu`)
- **Zoho WorkDrive:** `ZOHO_WORKDRIVE_*` trio, `WORKDRIVE_FOLDER_03_ID` (welcome
  kits), `WORKDRIVE_FOLDER_08_ID` (brand voice for VIP personalization)
- **WordPress:** `WORDPRESS_API_BASE_URL` (alias `WORDPRESS_SITE_URL`),
  `WP_ADMIN_USER` (alias `WORDPRESS_APP_USERNAME`), `WP_ADMIN_APP_PASSWORD`
  (alias `WORDPRESS_APP_PASSWORD`) — design doc wants a dedicated `wp-agent2`
  user; Master Reference Sheet §1 still has this open, aliases accepted either way
- **HeyGen:** `HEYGEN_API_KEY`, `HEYGEN_TEMPLATE_ID`, `HEYGEN_FLIPPEN_AVATAR_ID`
- **Policy:** `APPROVAL_MODE` (MANUAL default), `AUTO_APPROVE_CRITERIA_VERSION`
  (default v2.0), `ACTIVE_AMBASSADOR_THRESHOLD_ALERT` (800),
  `ACTIVE_AMBASSADOR_THRESHOLD_AUTO` (1000), `AMBASSADORS_MODULE_API_NAME`,
  `PROSPECTS_MODULE_API_NAME`, `COMBINED_FORM_ID`, `WINBACK_SURVEY_FORM_ID`,
  `ZOHO_FORMS_BASE_URL`, `WINBACK_WALKTHROUGH_VIDEO_URL`
- **Make.com:** `MAKE_AGENT3_WEBHOOK_URL` (alias `MAKE_AGENT3_ACTIVATION_WEBHOOK`),
  `MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL` (alias `MAKE_VIP_ACTIVATION_WEBHOOK`),
  `MAKE_COORDINATOR_QUEUE_WEBHOOK_URL`, `MAKE_WINBACK_SURVEY_WEBHOOK`,
  `MAKE_AGENT2_ERROR_WEBHOOK`
- **Alerts:** `PARMEET_ALERT_EMAIL`, `VIP_MANAGER_EMAIL` (alias
  `VIP_RELATIONSHIP_MANAGER_EMAIL`), `SUPPORT_COORDINATOR_EMAIL`

## Known scope decisions / gaps

- **"No response after Day 75 closes the application record"** (design §3.1)
  is *not* implemented — the design doc gives no explicit trigger timing for
  that closure beyond the Day 75 email itself, so auto-closing was left out
  rather than guessed at. It is a manual coordinator decision for now.
- **Monthly cadence after Day 75** is not implemented — the design doc
  describes the Day 75 email's content but not a recurring monthly template;
  a follow-up monthly job can be added once that copy exists.
- **Threshold alerts (800/1,000)** fire on every daily run while the count
  remains at/above a threshold — there is no CRM field in the design doc to
  suppress a repeat alert. This is an intentional escalating nag consistent
  with "Coordinator Decision Required," not a bug; a dedup field can be added
  later if it proves noisy.
- **Audience_Track picklist values** (`K12 Educator`, `Early Childhood`,
  `Faith Community`, `Youth Serving`, `General`) are a build-time
  interpretation — the design doc names the field but never enumerates its
  values. Confirm with Parmeet before relying on it for welcome-kit routing.

## Local test

```bash
node __tests__/agent2.test.js   # no network, no deps, no secrets
```

31 cases: reminder-tier day math + 5-day gap, win-back/dormant timing, all
five auto-approve criteria (pass + each failure), VIP_Prospect_Origin
override, Phase 1 manual no-op, all four win-back survey response paths,
WordPress-upgrade-gates-Email-D, the Agent 3 webhook payload shape,
motivation classification fallback, and threshold alert selection.

## Files

- `manifest.js` — env-var spec, live-reconciled Ambassadors/Prospects field
  names, controlled vocabularies, timing constants.
- `zoho.js` — CRM metadata + records (search, compound-condition fetch, update).
- `mail.js` — Zoho Mail sender (new — Agent 0 didn't need one).
- `workdrive.js` — brand-voice read + welcome-kit share-link generation.
- `wordpress.js` — role-upgrade gate for Email D.
- `heygen.js` — VIP welcome video job submission.
- `claude.js` / `prompts.js` — motivation classification + VIP personalization.
- `webhooks.js` — Make.com delivery with one retry.
- `alerts.js` — Parmeet alert formatting + delivery.
- `dates.js` — pure day-math (reminder tier, win-back, dormant).
- `emails.js` — every email's plain-text copy (A, B, B-VIP, C x3, win-back +
  4 response paths, day-75 reactivation, D, D-VIP).
- `autoApprove.js` — the five Phase 2 criteria.
- `functionA.js` / `functionB.js` / `functionC.js` / `functionD.js` — orchestration.
- `thresholds.js` — 800/1,000 active-ambassador alerts.
- `index.js` — Express app; resolves + verifies CRM names live on every route.

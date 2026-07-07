# Agent 1A — Database and Email Agent (Recruiting)

Sends personalized outbound email sequences to three populations: Agent 0's
prospect pipeline, the paraprofessional database, and current
students/alumni. Full spec: `docs/design/Gracelyn_Agent_1A_Database_Email_v1.md`.

## What it does

- **Weekly (`agent0_complete`)**: queries the Prospects module
  (`Ambassador_Leads`, confirmed live — see `manifest.js`) for new,
  VIP-suppressed, email-contactable prospects and sends sequence email 1.
  Paraprofessional DB and student/alumni querying is not implemented yet —
  neither module is confirmed in Zoho, and there's no query/send path for
  them even when resolved (see DEPLOY.md open item #1).
- **Daily follow-up (`followup_schedule`)**: sends sequence email 2 to
  contacts exactly 7 days past email 1 with no application.
- **Daily unresponsive mark (`unresponsive_mark`)**: sets
  `Outreach_Status = Unresponsive` for contacts exactly 14 days past email 2
  with no application. No email sent.
- **Lead capture handoff (`lead_capture_new_contact`)**: sends email 1
  immediately for a single prospect handed off by Agent 1D, without waiting
  for the next Monday cycle.

Every contact's CRM record is updated immediately after its email sends —
never batched — so a mid-run failure can't cause a duplicate send on retry.

## VIP suppression (critical rule)

Agent 1A never contacts a VIP prospect. The design doc calls this field
`VIP_Flag`; the live field Agent 0 actually created is `VIP_Prospect`. Every
prospect query filters `VIP_Prospect:equals:false` — see `criteria.js`.

## CRM reconciliation

Per `ClaudeCode_Zoho_API_Names_Instruction`, nothing is hardcoded from the
design doc. `reconcile.js` resolves the Prospects module and confirms its
fields live against Zoho on every run, the same pattern Agent 5A uses for the
project-wide gate. See `manifest.js` for the full list of design-doc-name →
live-field-name divergences discovered and resolved during this build, and
`DEPLOY.md` for the CRM field/picklist changes made live on 2026-07-07.

## Files

- `manifest.js` — canonical env vars + CRM field spec, with every
  design-doc-to-live-Zoho divergence documented inline.
- `zoho.js` — CRM metadata + data-plane helper (token refresh, module/field
  metadata, search, record update/get). Copied from `functions/agent5A/zoho.js`
  with search/update added — each Catalyst function deploys independently.
- `reconcile.js` — resolves modules/fields live at runtime; used by
  `orchestrate.js` as a pre-flight check.
- `criteria.js` — pure CRM search-criteria builders (VIP suppression,
  7-day/14-day windows).
- `sequencing.js` — pure run-mode classification + CRM update payload builders.
- `templates.js` — selects the right of 6 template pairs from env vars.
- `subject.js` — subject-line `[FIRST_NAME]` substitution.
- `personalize.js` — Claude prompt builders + the personalization call
  (falls back to the unmodified template on any failure or structural
  deviation — see `template-guard.js`).
- `template-guard.js` — pure structural-deviation detector (paragraph count +
  length ratio) enforcing the "opening sentence only" rule.
- `mail.js` — Zoho Mail send (plain text only — `mailFormat: 'text'`, never
  HTML) plus `sendAlertEmail` for direct Parmeet alerts.
- `workdrive.js` — WorkDrive Folder 08 brand asset reads.
- `run-summary.js` — pure run-summary payload builder for the coordinator
  webhook.
- `alerts.js` — pure §7.1-format alert-email builder + the >10 Claude /
  >20 mail consecutive-failure thresholds from §7.
- `retry.js` / `wait.js` — generic retry-once-after-30s helper (§7: CRM
  query, mail send, and CRM update failures each retry once before the
  caller decides abort vs. log-and-continue).
- `webhook.js` — POSTs the run summary to `MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL`
  (design doc §4 Step 8), retries once, alerts Parmeet with the full summary
  on a second failure.
- `orchestrate.js` — the Express-free core orchestration (`runAgent1A`),
  deps-injected so `__tests__` can exercise it with fakes.
- `index.js` — thin Express wrapper (`POST /run`, `GET /health`).

## Routes

```
POST /run       → { trigger_type, triggered_at, ... } → { success, runType, summary, ... }
GET  /health    → liveness
```

`trigger_type` is one of `agent0_complete`, `followup_schedule`,
`unresponsive_mark`, `lead_capture_new_contact` (see `sequencing.js`).

## Local test

```bash
node __tests__/agent1a.test.js   # no network, no deps, no secrets — 57 cases
```

Covers: run-mode classification, VIP-suppressed/date-windowed search
criteria, CRM update payload shapes, subject-line substitution, the
structural-deviation guard, Claude personalization fallback paths, template
selection, the plain-text mail payload rule, live-CRM reconciliation (module
resolution + divergence detection, field presence + pre-flight abort), the
retry-once helper, the §7.1 alert-email format, the run-summary webhook POST
(success, retry-then-succeed, both-attempts-fail), and full end-to-end
orchestration for all four trigger types with injected fakes — happy paths,
token-refresh abort, unresolved-module abort, missing-field abort, CRM-search
retry-then-succeed and retry-exhausted-abort, per-contact mail/CRM-update
failure (each retried once), the >10 Claude and >20 mail consecutive-failure
alerts, the missing-brand-asset alert, and the webhook-delivery-failure
alert.

## Deploy

Not yet deployed — see `DEPLOY.md` for the Week 2 gate, the live CRM changes
already applied, the design-doc §7 error handling now implemented, and
what's still genuinely open (Para DB/Student-Alumni querying isn't built yet,
email template copy, Make.com scenarios).

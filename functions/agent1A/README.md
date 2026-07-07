# Agent 1A — Database and Email Agent (Recruiting)

Sends personalized outbound email sequences to three populations: Agent 0's
prospect pipeline, the paraprofessional database, and current
students/alumni. Full spec: `docs/design/Gracelyn_Agent_1A_Database_Email_v1.md`.

## What it does

- **Weekly (`agent0_complete`)**: queries the Prospects module
  (`Ambassador_Leads`, confirmed live — see `manifest.js`) for new,
  VIP-suppressed, email-contactable prospects and sends sequence email 1.
  Also queries the paraprofessional DB and student/alumni modules if those
  are resolvable in Zoho (neither is confirmed yet — see DEPLOY.md).
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
  HTML).
- `workdrive.js` — WorkDrive Folder 08 brand asset reads.
- `run-summary.js` — pure run-summary payload builder for the coordinator
  webhook.
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
node __tests__/agent1a.test.js   # no network, no deps, no secrets — 40 cases
```

Covers: run-mode classification, VIP-suppressed/date-windowed search
criteria, CRM update payload shapes, subject-line substitution, the
structural-deviation guard, Claude personalization fallback paths, template
selection, the plain-text mail payload rule, live-CRM reconciliation
(module resolution + divergence detection, field presence), and full
end-to-end orchestration for all four trigger types with injected fakes
(happy paths, token-refresh abort, unresolved-module abort, per-contact mail
failure, post-send CRM update failure).

## Deploy

Not yet deployed — see `DEPLOY.md` for the Week 2 gate, the live CRM changes
already applied, and what's still open (Para DB/Student-Alumni module
confirmation, email template copy, Make.com scenarios).

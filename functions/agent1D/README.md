# Agent 1D — Lead Capture

Processes lead-capture form submissions across four audience tracks (K-12
educators, early childhood/childcare, faith and community leaders,
youth-serving professionals), delivers the requested lead magnet, seeds a
Prospect record in Zoho CRM, and hands the new lead off to Agent 1A for
email-sequence initiation. Full spec:
`docs/design/Gracelyn_Agent_1D_Lead_Capture_v2.md`.

Agent 1D creates Prospect records only — it never creates Ambassador
records, sends recruiting sequence emails itself, or onboards anyone.
Agent 1A owns everything after the handoff webhook fires.

## Process (design §4 Steps 1-8, `pipeline.js`)

1. **Validate** the submission — email present and well-formed, `lead_magnet_id`
   present. Either missing exits without touching CRM and alerts Parmeet.
2. **Refresh tokens** — CRM, WorkDrive, Mail. Failure halts + alerts.
3. **Resolve Audience_Track** from the `lead_magnet_id` prefix (`routing.js`).
   An unrecognized prefix sets `Unknown`, alerts Parmeet, but never blocks
   record creation.
4. **Lead magnet link** — resolve the file at `LEAD_MAGNET_MAP[lead_magnet_id]`
   inside WorkDrive Folder 06 (which may be one subfolder deep) and generate a
   time-limited (default 7-day) share link. A miss falls back to the design's
   placeholder message in the delivery email and alerts Parmeet — never blocks.
5. **CRM upsert**, keyed on `Email` — resolves the Prospects module (`Ambassador_Leads`,
   same module Agent 0 and Agent 1A write to) live and verifies the fields Agent 1D
   writes actually exist, same pattern as Agent 0's Step 4. New prospects are
   created with the full Step 5a field set; existing prospects only get
   `Lead_Magnets_Downloaded` appended and `Audience_Track` upgraded if it was
   previously `Unknown` — **never** overwriting `Outreach_Status`,
   `Recruiting_Source`, or UTM fields (design §4 Step 5b). Retries once after
   30 seconds on failure; a second failure halts and alerts Parmeet with the
   full submission so the record can be created by hand.
6. **Claude opening sentence** — one personalized sentence per audience track's
   tone framing (design §5). Any failure falls back to the design's plain
   opening line; the send never aborts for this.
7. **Delivery email** — plain text, `ambassadors@gracelyn.edu`, subject from
   `AGENT1D_DELIVERY_EMAIL_SUBJECT` (`[RESOURCE_NAME]` placeholder supported).
8. **Agent 1A handoff webhook** — fires for both new and updated records with
   `email, first_name, role_category, audience_track, lead_magnet_id`. Retries
   once after 60 seconds; a final failure alerts Parmeet with the prospect data.

## Nightly cleanup (`cleanup.js`, design §7 Scenario 3)

Runs at 2:00 AM CST (`POST /cleanup`, wired to a Catalyst Job Schedule). For
every form in `LEAD_CAPTURE_FORM_IDS`, pulls the last 24 hours of Zoho Forms
submissions, skips any email already in CRM, and reprocesses the rest through
the exact same `processSubmission` pipeline as the real-time trigger. Sends
Parmeet a morning summary of how many submissions it recovered.

**Not yet live-confirmed:** the Zoho Forms API addresses a form as
`owner/formLinkName`, not a bare numeric ID — see the note atop `forms.js`.
Confirm the exact `LEAD_CAPTURE_FORM_IDS` entry shape with Parmeet before
relying on this in production; it degrades gracefully (per-form fetch
failures are alerted and skipped, not fatal to the whole run) if wrong.

## CRM reconciliation

Per `ClaudeCode_Zoho_API_Names_Instruction`, no field/module API name is
hardcoded from the design doc. `manifest.js` documents every divergence
between the doc and the live Zoho fields Agent 0 and Agent 1A already
reconciled on 2026-07-07 — most importantly:

- The "Prospects module" is `Ambassador_Leads` (Agent 0's module).
- `First_Name` → live `Name`.
- `Outreach_Status` is written as `Standard` on a new lead, not the doc's
  literal `Identified` — that value does not exist on the live picklist and
  Agent 1A's weekly query depends on `Standard` to pick up new leads.
- `Audience_Track`, `Lead_Magnets_Downloaded`, `UTM_Source`, `UTM_Campaign`
  are new fields this design doc introduces; `verifyFields()` surfaces (never
  silently swallows) any not yet created live.

## Files

- `manifest.js` — canonical env vars + CRM field spec, with every divergence
  documented inline.
- `validate.js` — Step 1, pure submission parsing/validation.
- `routing.js` — Step 3, pure `lead_magnet_id` → `Audience_Track` resolution.
- `zoho.js` — CRM metadata + record helper (token refresh, module/field
  metadata, search, dedup lookup, create/update). Copied from
  `functions/agent0/zoho.js` — each Catalyst function deploys independently.
- `workdrive.js` — Folder 08 brand asset read + Folder 06 lead magnet lookup
  and time-limited share link generation (Step 4).
- `mail.js` — Zoho Mail send (plain text only).
- `claude.js` / `prompts.js` — Step 6 opening-sentence generation with the
  design's fallback line on any API failure.
- `email.js` — pure delivery-email subject/body builders.
- `webhooks.js` — generic Make.com POST + one-retry helper.
- `alerts.js` — routes every error through `MAKE_AGENT1D_ERROR_WEBHOOK`
  (Scenario 4), centralizing alert delivery to Parmeet.
- `retry.js` / `wait.js` — the design's retry-once-after-a-delay helper.
- `pipeline.js` — `processSubmission`, the Express-free Steps 1-8 core, used
  by both the real-time route and the nightly cleanup job.
- `forms.js` — Zoho Forms client for the nightly cleanup job only.
- `cleanup.js` — nightly cleanup orchestration (Scenario 3).
- `index.js` — thin Express wrapper (`POST /webhook`, `POST /cleanup`, `GET /health`).

## Routes

```
POST /webhook   → { first_name, email, role_category, state, lead_magnet_id,
                    utm_source, utm_campaign } → processSubmission result
POST /cleanup   → nightly recovery run → { success, checked, recovered, ... }
GET  /health    → liveness
```

## Local test

```bash
node __tests__/agent1d.test.js   # no network, no deps, no secrets — 23 cases
```

Covers submission validation, all four audience-track routing prefixes plus
unknown, lead magnet link lookup (valid + not-found fallback), new-vs-duplicate
CRM upsert (including the "never overwrite Outreach_Status/Recruiting_Source/UTM"
rule and the Audience_Track-upgrade-only-from-Unknown rule), missing-field
divergence surfacing, CRM write retry-then-halt, Claude opening sentence for
all four tracks plus its failure fallback, the delivery email builders, the
Agent 1A handoff webhook payload shape and its failure alerting, and nightly
cleanup recovery/skip behavior.

## Deploy

Not yet deployed — see `DEPLOY.md`.

# Agent 6 — Story Content Intake

Removes all manual file-management burden from Parmeet when supplying story
content for Agent 3's weekly engagement emails. Built against
`docs/design/Gracelyn_Agent_6_Story_Intake_v2.md`.

## What actually runs where

The story pipeline itself (Zoho Forms submission → Zoho Flow → WorkDrive
Folder 05) is a **native Zoho Flow with Deluge scripting** (design §5) —
Parmeet's team builds and owns it in Zoho One, and it does not run on
Catalyst. The **one Catalyst function** this repo ships is the **daily
buffer-monitoring job** (design §6), which is what `index.js` exposes.

`filename.js`, `storyFile.js`, and `intake.js` are a tested, JS port of the
Flow's Deluge logic (design §5.1, §5.2, and the failure-scenario table in
§7). They exist as the **reconciled specification the Flow must match** —
a known-correct reference to validate the Deluge script against before it
goes live — not as code Catalyst executes at intake time. There is no HTTP
route for them; wiring the actual Flow is Parmeet's/the no-code build.

## Buffer-monitoring job (design §6)

Runs daily at **5:30 AM CST**, before Agent 3's Monday 9:00 AM CST cycle:

1. List `Story_*.txt` files in WorkDrive Folder 05 and download each.
2. **Used-file exclusion** (best-effort, see "Coordination gaps" below): read
   `Last_Story_File_Used` across Ambassador records via Zoho CRM and exclude
   filenames used this week from the available count. If CRM credentials
   are absent, the job degrades gracefully — counts every file instead of
   crashing — and says so in the alert body.
3. Count total available + per role-category (the six controlled categories
   plus `Any`).
4. Alert `PARMEET_ALERT_EMAIL` if the total is below `STORY_BUFFER_MINIMUM`
   **or** any category has zero available files. The alert includes the
   total, the per-category breakdown, stories used this week, and a direct
   link to the intake form (`STORY_INTAKE_FORM_URL`).
5. If the job itself fails (e.g. WorkDrive token failure), it still attempts
   to alert Parmeet about the failure — the daily buffer alert is skipped
   for that day, but the failure is never silent (design §7).

## Routes

```
POST /buffer-check   daily 5:30 AM CST scheduled job
GET  /health         liveness
```

## Coordination Point #1 — ROLE_CATEGORY header (with Agent 3)

Confirmed 2026-07-10 by the Agent 3 session (see
`docs/planning/Agent_Build_Playbook.md`, Agent 6 entry, and
`functions/agent3/manifest.js`): the literal header written on the **second
line** of every story file is `ROLE_CATEGORY: <value>` — uppercase,
underscore, colon-space — read by Agent 3's `parseRoleCategory()` regex.
`functions/agent6/__tests__/agent6.test.js` cross-checks this byte-for-byte
against `functions/agent3/manifest.js` at test time so a future edit to
either side that breaks the contract fails loudly instead of silently.

**Role category vocabulary correction:** the design doc v2 §3.1 Role
Category dropdown lists only five values (K12 Educator, Early Childhood,
Faith Community, Youth Serving Professional, Any). That is stale — Agent 0
and Agent 3 both already use the reconciled **six**-category vocabulary
(adding Mission Aligned Influencer and Gracelyn Community), confirmed live
and called out explicitly in the Agent Build Playbook's Agent 6 entry.
**Parmeet's Zoho Forms Role Category dropdown must offer all six categories
below plus the literal `Any` (seven options total), not the doc's five:**

- K12 Educator
- Early Childhood
- Faith Community
- Youth Serving Professional
- Mission Aligned Influencer
- Gracelyn Community
- Any (category-agnostic fallback)

## Coordination gaps flagged for reconciliation

- **Used-file exclusion "this week" window:** the design doc says the buffer
  count should exclude files "used this week" (§6), but Agent 3's schema has
  no separate "date `Last_Story_File_Used` was set" field. This code
  approximates it using Agent 3's `Last_Engagement_Date` field (updated
  whenever Agent 3 records engagement, including a story send). **Confirm
  this mapping with the Agent 3 developer before relying on it in
  production** — until confirmed, treat used-file exclusion as best-effort,
  not authoritative (see `zoho.js` doc-comment).
- **`WORKDRIVE_FOLDER_05_ID`** must be the exact same folder id Agent 3 uses
  (design §9.1) — confirm with the Agent 3 developer and Parmeet before
  deploy.
- Agent 6's own design doc (§1, §10) never lists Zoho CRM credentials, yet
  §6 requires a CRM read for used-file exclusion. This code treats the CRM
  trio as **optional** for exactly that reason — see `manifest.js` for the
  full rationale.

## Environment variables

- **Zoho WorkDrive:** `ZOHO_WORKDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `WORKDRIVE_FOLDER_05_ID` (required — read-only)
- **Zoho Mail:** `ZOHO_MAIL_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `AMBASSADOR_MAIL_FROM_ADDRESS` (default `ambassadors@gracelyn.edu`)
- **Zoho CRM (optional):** `ZOHO_CRM_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `AMBASSADORS_MODULE_API_NAME` (confirmed live: `Ambassadors`) — enables
  used-file exclusion; the job degrades gracefully without it.
- **Policy:** `STORY_BUFFER_MINIMUM` (default 4)
- **Alerts/config:** `PARMEET_ALERT_EMAIL`, `STORY_INTAKE_FORM_URL`,
  `MAKE_BUFFER_ALERT_WEBHOOK` (optional), `ZOHO_FLOW_ID` (optional,
  documentation only — the Flow runs outside Catalyst)

## Local test

```bash
node __tests__/agent6.test.js   # no network, no deps, no secrets
```

Covers filename sanitization + duplicate `_v2`/`_v3` suffixing, the five
header lines in exact order, role-category parsing/validation, intake slot
validation (missing title/category/target week, empty-slot skip, past-date
warning, batch of five), buffer counting + per-category gap alerting, the
daily job with injected WorkDrive/Mail/CRM fakes (including a CRM-absent
degrade path and a WorkDrive-failure alert path), and the Coordination
Point #1 cross-check against Agent 3's manifest.

## Files

- `manifest.js` — env-var spec, ROLE_CATEGORY header/vocabulary, filename/header constants.
- `filename.js` — title sanitization, target-Monday resolution, filename + duplicate-suffix generation.
- `storyFile.js` — file content assembly (5-line header + separators) and parsing.
- `intake.js` — per-slot + per-submission validation and confirmation-email summary (Flow reference spec).
- `workdrive.js` — read-only Folder 05 scan (list + download).
- `zoho.js` — optional, read-only used-file exclusion query.
- `mail.js` — buffer alert email delivery.
- `buffer.js` — buffer counting + alert-decision logic.
- `job.js` — the daily run cycle wiring the above together.
- `index.js` — Express app (`POST /buffer-check`, `GET /health`).

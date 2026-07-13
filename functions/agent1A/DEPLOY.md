# Agent 1A — Deploy Notes

**Status: Week 1 build complete. NOT deployed.** Per the Week 2 gate in
CLAUDE.md, this function is written, tested, and staged in `catalyst.json`
targets but has not been run through `catalyst deploy`. Deployment happens in
Week 2 once Agent 5A returns a `GO` verdict.

## Live CRM changes made during this build (2026-07-07)

Per `ClaudeCode_Zoho_API_Names_Instruction`, Agent 1A's dependencies on the
`Ambassador_Leads` module (the live `Prospects` module — see manifest.js §1)
were reconciled against Zoho directly, not assumed from the design doc. Two
live changes were required and applied via the Zoho CRM Module Connector:

### 1. Six new fields created on `Ambassador_Leads`

| Field label | api_name | data_type | Zoho field id |
|---|---|---|---|
| Sequence Email 1 Sent | `Sequence_Email_1_Sent` | boolean | 4849477000258350002 |
| Sequence Email 1 Sent Date | `Sequence_Email_1_Sent_Date` | date | 4849477000258350011 |
| Sequence Email 2 Sent | `Sequence_Email_2_Sent` | boolean | 4849477000258350020 |
| Sequence Email 2 Sent Date | `Sequence_Email_2_Sent_Date` | date | 4849477000258350028 |
| Recruiting Source | `Recruiting_Source` | text(100) | 4849477000258350036 |
| Recruiting Channel | `Recruiting_Channel` | text(100) | 4849477000258350044 |

None of these existed before this build. Confirmed live via
`GET /crm/v6/settings/fields?module=Ambassador_Leads` after creation — all six
return with the expected `api_name`/`data_type`.

### 2. `Outreach_Status` picklist extended (not forked)

Agent 0 had already set up `Outreach_Status` (field id
`4849477000258319129`) with two values: `Standard` and `VIP Pipeline`. The
design doc's lifecycle values (`Identified`, `Outreach Sent`, `Follow-Up
Sent`, `Unresponsive`, `Applied`) did not exist. Rather than create a second,
overlapping status field — which would recreate the exact silent-failure risk
CLAUDE.md warns about — the existing picklist was extended with four new
values via `updateField`:

- `Outreach Sent`
- `Follow-Up Sent`
- `Unresponsive`
- `Applied`

`Standard` now serves double duty: it is both Agent 0's "not VIP" signal and
Agent 1A's "new prospect ready for outreach" state (the doc's `Identified`).
See `manifest.js` divergence note #6 for the full reasoning. Confirmed live at
the time of this build — `Outreach_Status` returned all 7 values (`-None-`,
`Standard`, `VIP Pipeline`, `Outreach Sent`, `Follow-Up Sent`, `Unresponsive`,
`Applied`).

**No other agent's fields were touched.** `First_Name`→`Name` and
`Organization`→`Company_Name` reuse Agent 0's pre-existing fields; no
duplicates were created.

### Re-reconciliation at merge time (2026-07-08)

By the time this branch was merged, Agents 0, 1B, 1C, 2, 3, 4, 5, and 6 had
all landed on `main` independently. Re-checked all 17 fields Agent 1A depends
on directly against live Zoho — every one still exists with the expected
`api_name`/`data_type`, no drift. One additive change: `Outreach_Status` now
has an 8th live value, `Converted` (not created by Agent 1A — most likely
Agent 2/Onboarding, marking a prospect who became an ambassador). Agent 1A's
code never enumerates or validates against a fixed picklist value set, so
this is not a breaking change — noted here for anyone auditing the shared
field later.

## Required environment variables

Full list with severities and notes: `manifest.js` → `ENV_VARS`. Summary:

- **AI**: `ANTHROPIC_API_KEY` (canonical — not `CLAUDE_API_KEY`)
- **Zoho CRM OAuth**: `ZOHO_CRM_CLIENT_ID/SECRET/REFRESH_TOKEN`
- **Zoho Mail OAuth**: `ZOHO_MAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` (canonical —
  design doc v1's `AMBASSADOR_MAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` are
  aliases, do not use), plus `AMBASSADOR_MAIL_ACCOUNT_ID` and
  `AMBASSADOR_MAIL_FROM_ADDRESS` (mailbox identity, not OAuth — kept as-is)
- **Zoho WorkDrive OAuth**: `ZOHO_WORKDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `WORKDRIVE_FOLDER_08_ID`
- **CRM module resolution**: `PROSPECTS_MODULE_API_NAME` (confirmed →
  `Ambassador_Leads`), `PARA_DB_MODULE_NAME` + `PARA_DB_TEST_SEGMENT_SIZE`
  (not yet confirmed in Zoho — warn, not blocking), `STUDENT_ALUMNI_MODULE` +
  `STUDENT_AMBASSADOR_STATUS_FIELD` (same, not yet confirmed)
- **Templates**: 12 vars (`AGENT1A_SEQ{1,2}_{PARA,PROSPECT,STUDENT}_{SUBJECT,BODY}`)
  — Parmeet writes the copy per the design doc's rules (mission before fee,
  exact referral amounts, three-layer structure); Agent 1A never writes copy.
- **Make.com** (warn — Week 2): `MAKE_AGENT1A_WEBHOOK_URL`,
  `MAKE_AGENT1A_FROM_1D_WEBHOOK_URL`, `MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL`
- **Alerts**: `PARMEET_ALERT_EMAIL`, `SUPPORT_COORDINATOR_EMAIL` (canonical —
  design doc v1's `COORDINATOR_ALERT_EMAIL` is an alias, do not use)

Secrets are never committed. Set them in `catalyst-config.json`
`env_variables` locally at deploy time, run `catalyst deploy`, then
`git checkout catalyst-config.json` so they never land in the repo.

## Error handling coverage (design doc §7)

Implemented: OAuth token refresh abort, retry-once-after-30s on CRM
search/get/update and mail send (`retry.js`, `wait.js`), consecutive-failure
alerting at >10 Claude personalization failures and >20 mail failures
(`alerts.js`), a pre-flight field-existence check before any query/write
(`reconcile.checkProspectFields`, called every run), a direct Parmeet alert
for missing brand assets and for contacts needing manual CRM update (both
non-aborting conditions a bare HTTP status wouldn't surface to Make.com), and
the coordinator run-summary webhook POST with its own retry-once and
delivery-failure alert (`webhook.js`). Self-audited and fixed 2026-07-07 —
these were gaps in the initial build that passing tests didn't catch because
the original tests only covered what was built, not everything the doc
required.

## Still open before Week 2 deploy (not blocking this build)

1. **Para DB and Student/Alumni querying is not implemented**, not just
   skipped. Neither module is confirmed in Zoho (Master Reference Sheet §4,
   both ⬜) so `criteria.paraDbCriteria()`/`studentAlumniCriteria()` exist as
   pure functions but `orchestrate.js` never calls them — there is no
   query/send loop for those populations yet, and therefore no
   `PARA_DB_TEST_SEGMENT_SIZE` cap enforcement either. `test_segment_active`
   in the run summary is hardcoded `false` for this reason — it would be
   dishonest to report a cap that isn't in effect. Once those modules are
   confirmed, this needs real implementation (a query loop per population
   mirroring the Prospects one, plus the segment-size slice), not just a
   `skippedPopulations` flip.
2. **Email templates are not yet written.** All 12 `AGENT1A_SEQ*` env vars
   are currently unset. `templates.selectTemplate()` returns empty
   subject/body until Parmeet writes them; `sendSequenceEmail()` will report
   `sent: false` with reason "Template env vars ... not set" until then —
   this fails loudly per contact, it does not silently no-op.
3. **Make.com scenarios not built** (Scenario 1 trigger, Scenario 2 daily
   follow-up/unresponsive schedule, Scenario 3 coordinator summary). See
   design doc §6. `MAKE_*` vars stay `warn` severity until built.
4. **Title→Role_Title mapping** (manifest.js divergence #5) should be
   confirmed with Parmeet — `Title` was a pre-existing field on
   `Ambassador_Leads`, not one Agent 0 created for this purpose.
5. **Alert email verbosity**: all non-aborting alerts currently reuse the
   ambassadors@gracelyn.edu mailbox (`mail.sendAlertEmail`) since there's no
   separate ops mailbox defined anywhere in the docs. Confirm with Parmeet
   this is acceptable or if alerts should route elsewhere.
6. **Run Agent 5A** after all of the above to get a `GO` verdict before
   `catalyst deploy`.

## Local test

```bash
cd functions/agent1A
node __tests__/agent1a.test.js   # no network, no deps, no secrets — 57 cases
```

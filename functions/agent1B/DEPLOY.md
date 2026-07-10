# Agent 1B — Deploy Notes

**Status: Week 1 build complete. NOT deployed.** Per the Week 2 gate in
CLAUDE.md, this function is written, tested, and staged in `catalyst.json`
targets but has not been run through `catalyst deploy`. Deployment happens in
Week 2 once Agent 5A returns a `GO` verdict.

## Live CRM changes made during this build (2026-07-08)

Per `ClaudeCode_Zoho_API_Names_Instruction`, Agent 1B's dependencies on the
`Ambassador_Leads` module (the live `Prospects` module — see manifest.js §1)
were reconciled against Zoho directly, not assumed from the design doc.
Changes were applied via the Zoho CRM Module Connector:

### 1. New field created on `Ambassador_Leads`

| Field label | api_name | data_type | Zoho field id |
|---|---|---|---|
| High Engagement Flag | `High_Engagement_Flag` | boolean | 4849477000258337026 |

Did not exist before this build. Confirmed live via
`GET /crm/v6/settings/fields?module=Ambassador_Leads` after creation.

### 2. `Outreach_Status` picklist extended (not forked)

Following Agent 1A's precedent, the existing `Outreach_Status` field (id
`4849477000258319129`) was extended with one new value via `updateField`:

- `Converted` — design doc §5 Stage 4: written when a VIP Prospect accepts
  and transitions to Ambassador.

Confirmed live — `Outreach_Status` now returns all 8 values (`-None-`,
`Standard`, `VIP Pipeline`, `Outreach Sent`, `Follow-Up Sent`, `Unresponsive`,
`Applied`, `Converted`). No other agent's fields were touched.

### 3. `Social Post Log` module created

`GET /crm/v6/settings/modules` initially confirmed no such module existed —
the Master Reference Sheet §4 already listed it as unconfirmed (⬜). Explicitly
authorized and created live via `ZohoCRM_createModules`:

- **Module**: singular label "Social Post Log", plural "Social Post Logs",
  org-based access, profiles Administrator + Standard (module id
  `4849477000258275044`). Zoho auto-generated the **plural** api_name —
  **`Social_Post_Logs`**, not the singular form — this is the value
  `SOCIAL_POST_LOG_MODULE_API_NAME` must resolve to (or is auto-discovered
  live by `reconcile.resolveModules()` if the env var is unset).
- **Display field**: autonumber, prefix `SPL-`, e.g. `SPL-1`.
- **Fields** (all confirmed via `GET /crm/v6/settings/fields?module=Social_Post_Logs`
  — every api_name matches what `sequencing.buildSocialPostLogRecord()`
  already wrote, no code changes were needed):

| Field label | api_name | data_type | Zoho field id |
|---|---|---|---|
| Platform | `Platform` | picklist (linkedin/facebook/instagram) | 4849477000258336020 |
| Post ID | `Post_ID` | text(100) | 4849477000258336032 |
| Caption Text | `Caption_Text` | textarea (large) | 4849477000258336041 |
| Asset Filename | `Asset_Filename` | text(255) | 4849477000258336049 |
| Posted At | `Posted_At` | datetime | 4849477000258336057 |
| Status | `Status` | picklist (success/failed) | 4849477000258336066 |

Agent 1B still resolves this module live every run via
`reconcile.resolveModules()` rather than hardcoding the api_name (per
`ClaudeCode_Zoho_API_Names_Instruction`), and the post cycle still degrades
gracefully (skip + alert, posting unaffected) if it's ever unresolved —
this is defensive resilience against a future rename/deletion, not an
admission the module is missing today.

## Required environment variables

Full list with severities and notes: `manifest.js` → `ENV_VARS`. Summary:

- **AI**: `ANTHROPIC_API_KEY` (shared with other agents)
- **Zoho CRM OAuth**: `ZOHO_CRM_CLIENT_ID/SECRET/REFRESH_TOKEN`
- **Zoho WorkDrive OAuth**: `ZOHO_WORKDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `WORKDRIVE_FOLDER_02_ID` (critical), `WORKDRIVE_FOLDER_08_ID` (critical),
  `WORKDRIVE_FOLDER_07_ID` / `WORKDRIVE_FOLDER_09_ID` (warn — degrade
  gracefully if missing)
- **Zoho Social**: `ZOHO_SOCIAL_ACCESS_TOKEN`, `ZOHO_SOCIAL_PORTAL_ID` (warn)
- **Ayrshare**: `AYRSHARE_API_KEY` (static key, critical)
- **Community monitoring**: `FACEBOOK_READ_TOKEN`, `LINKEDIN_READ_TOKEN` (warn, read-only)
- **CRM module resolution**: `PROSPECTS_MODULE_API_NAME` (confirmed →
  `Ambassador_Leads`), `SOCIAL_POST_LOG_MODULE_API_NAME` (confirmed →
  `Social_Post_Logs`, warn severity — see above)
- **Policy**: `MISSION_KEYWORDS` (critical — Parmeet-maintained, comma-separated)
- **Make.com** (warn — Week 2): `MAKE_VIP_WARM_FOLLOW_WEBHOOK`,
  `MAKE_LOW_CONTENT_WEBHOOK`, `MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK` (inferred
  name — see "Still open" #4), `MAKE_AGENT1B_ALERT_WEBHOOK` (inferred name —
  see "Still open" #4), `MAKE_AGENT1B_INTELLIGENCE_WEBHOOK` (trigger
  registration only, not POSTed to by this code)
- **Alerts**: `PARMEET_ALERT_EMAIL`, `VIP_MANAGER_EMAIL` (canonical — design
  doc v2's `VIP_RELATIONSHIP_MANAGER_EMAIL` is an alias, do not use)

Secrets are never committed. Set them in `catalyst-config.json`
`env_variables` locally at deploy time, run `catalyst deploy`, then
`git checkout catalyst-config.json` so they never land in the repo.

## Error handling coverage (design doc §9)

Every row of §9 is implemented **and called from the real run path** in
`orchestrate.js` (`runPostCycle` / `runIntelligenceCycle`), not just written
and tested in isolation — confirmed by a deliberate second-pass audit after
the initial build (the same self-audit lesson from Agent 1A applies here):

| §9 row | Implementation |
|---|---|
| Token refresh fails | Explicit `Promise.all([getWorkdriveToken, getCrmToken])` up front in both cycles; halts with a 502 + ops alert on failure, before any other WorkDrive/CRM call can mistake a stale-credential error for "empty/missing." |
| Folder 02 empty | `workdrive.listUnpostedAssets` empty → low-content webhook (`MAKE_LOW_CONTENT_WEBHOOK`) + graceful 200 exit. |
| Folder 08 brand asset missing | `workdrive.readBrandAssets` missing → halt post cycle + ops alert, no Claude/Ayrshare call made. |
| Ayrshare fails one platform | Per-platform Social Post Log write (`status: failed`) + per-platform ops alert; other platforms already posted (single Ayrshare call covers all three). |
| Ayrshare fails all platforms | Asset is **not** renamed `_POSTED` (stays available for manual retry); all failures logged + alerted with an explicit "do not retry automatically" note. |
| Claude returns non-JSON captions | `claude.generateCaptions` returns `ok:false`; raw response (truncated) is included in the alert; post cycle skips — no Ayrshare call. A separate Claude API/network failure (distinct code path) gets its own alert and also skips. |
| CRM write fails for new prospect | Failed writes collected, retried once via `retry.retryFailedWritesOnce` immediately after the discovery loop (no artificial delay — the design doc gives no delay value for 1B, unlike Agent 1A's explicit 30s); still-failed writes land in `crm_write_failures` in the run summary. |
| VIP account detected in standard monitoring | Discovered profiles matching an existing `VIP_Prospect=true` record are never created/written; counted in `vip_accounts_suppressed` in the run summary. |
| Gap report missing | `workdrive.readMostRecentGapReport` null → `DEFAULT_COMMUNITIES` fallback + ops alert. |

Also implemented, beyond the literal §9 table:
- **§5 Stage 5 (Declined) 12-month re-approach suppression** — computed from
  the existing `Prospect_Declined_Date` field (no new field forked) and the
  live `VIP_Pipeline_Stage='Declined'` value; both checked in the
  high-engagement-flagging step so a declined account is never re-touched
  during its suppression window (`criteria.isReapproachSuppressed`,
  `criteria.isStage5Declined` — both called from `orchestrate.js`, not left
  as unused tested functions).
- **§5.1 max one warm-follow alert per VIP Prospect per run**, enforced via
  `manifest.MAX_WARM_FOLLOW_ALERTS_PER_PROSPECT_PER_RUN` (not a bare loop
  `break`).
- **Run summary webhook delivery failure** gets its own ops alert with the
  full summary payload, mirroring Agent 1A's `MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL`
  pattern (§8 Scenario 5 here).
- **Social Post Log module** now exists live (see "Live CRM changes" #3
  above) — the post cycle writes one record per platform every run;
  the resolve-live-and-degrade path only matters as defensive resilience now.

## Still open before Week 2 deploy (not blocking this build)

Tracked as a Zoho Projects subtask under the Agent 1B task (Week 1 — Build
tasklist) — see that subtask for live status; summarized here for repo
readers:

1. **Ayrshare response shape is an assumption.** `ayrshare.js`'s
   `parsePostResponse` expects a `posts: [{platform, status, id, errors}]`
   array and `platformOptions` for per-platform captions in the request. This
   was not verified against a real Ayrshare account/API version — confirm
   before Week 2 (`parsePostResponse` is the single place to adjust if the
   real shape differs).
2. **Facebook/LinkedIn community search and profile-post endpoints are
   unconfirmed.** The design doc names the read-only tokens and their
   purpose but not an endpoint/query schema (unlike Ayrshare/Zoho CRM, which
   are conventional and already used elsewhere in this codebase).
   `social-monitoring.js` implements a reasonable interpretation
   (`normalizeCandidate`/`fetchRecentPostsForProfile` are the isolation
   points) — needs a real integration test against Parmeet's actual
   Graph API app / LinkedIn access before Week 2.
3. **Zoho Social engagement endpoint is unconfirmed** for the same reason —
   see `zoho-social.js`'s `normalizeEngager`.
4. **`MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK` and `MAKE_AGENT1B_ALERT_WEBHOOK` are
   inferred env var names, not in the design doc.** §8 lists a Scenario 5
   (Run Summary) and §6/§9 require Parmeet alerts for token-refresh/brand-
   asset/post-failure/Claude-parse conditions, but §12's env var table has no
   corresponding webhook URL for either — a real gap in the design doc, not
   an oversight in this build. Confirm the exact names/Make.com scenario
   config with Parmeet before Week 2 (see manifest.js for the full reasoning).
5. **§5.1 Stage 1 detection uses the live `VIP_Pipeline_Stage` CRM field, not
   a literal parse of Folder 09 briefing text**, despite the design doc's
   wording ("Agent 1B checks Folder 09... to identify which accounts are in
   Stage 1"). Agent 0's actual briefing generator (`functions/agent0/pipeline.js`
   `generateAndSaveBriefing`) produces free-text Claude narratives that
   reference a profile URL in the *prompt context* it was given, not
   necessarily in a reliably parseable line in the *output* — and it never
   includes the VIP_Pipeline_Stage value at all. The CRM field is
   authoritative and reliable; Folder 09 is still read every run for
   supplementary human-facing context (`briefingsRead` in the response body)
   but is not used to derive the Stage 1 list. Confirm this approach is
   acceptable, or coordinate with the Agent 0 developer on a structured
   briefing format if literal Folder 09 parsing is required.
6. **Ayrshare `mediaUrl` relies on WorkDrive's file `permalink` attribute
   being public.** Ayrshare needs a publicly reachable image URL; this build
   passes through whatever `permalink` WorkDrive's file-list API returns
   without confirming it is actually public (vs. requiring the same OAuth
   token to view). Verify during the integration test (§10.2).
7. **Caption generation passes only the asset filename as "asset
   description"** to Claude (design doc §7.1's prompt takes copy rules +
   voice guidelines + the template/asset, but doesn't specify how an image
   asset's *content* should be described in text). Consider having Parmeet
   supply a short caption/alt-text per asset in Folder 02 if captions need to
   reference the image's actual content more specifically.
8. **`criteria.estimateRoleCategory`** is a simple keyword heuristic over the
   community name a prospect was discovered in, not a classifier — the
   design doc only asks for a "best estimate from profile context." Sanity
   check the mapping with Parmeet.
9. **The warm-follow "CRM task" is created entirely by Make.com Scenario 3**,
   not by this code — Agent 1B only POSTs the alert payload
   (`sequencing.buildWarmFollowAlertPayload`). Confirm Scenario 3 actually
   creates a Zoho Projects/CRM **Task** record type (not a generic activity
   or note) assigned to the VIP Relationship Manager, per design doc §5.1.
10. **Run Agent 5A** after all of the above to get a `GO` verdict before
    `catalyst deploy`.

## Local test

```bash
cd functions/agent1B
node __tests__/agent1b.test.js   # no network, no deps, no secrets — 54 cases
```

# Agent 1B — Social Outreach Agent (Recruiting)

Manages Gracelyn's organic social presence across LinkedIn, Facebook, and
Instagram: posts prescribed recruiting content on a weekly schedule,
monitors educator/mission-aligned communities for prospecting signals, and
supports the VIP Prospect Pipeline with warm-follow engagement alerts. Full
spec: `docs/design/Gracelyn_Agent_1B_Social_Outreach_v2.md`.

Agent 1B never sends direct messages or emails to an individual — it posts
public content, monitors communities read-only, writes prospecting
intelligence to CRM, and creates coordinator alerts. Direct outreach is
Agent 1A's job (email) or the human relationship manager's (VIP Prospects).

## What it does

- **Post Cycle** (`post_cycle`, Tue/Thu 10:00 AM CST via Make.com Scenario 1):
  selects the oldest unposted asset from WorkDrive Folder 02, generates
  platform-native captions via Claude, posts to LinkedIn/Facebook/Instagram
  in a single Ayrshare call, logs each platform's result, and renames the
  asset `_POSTED` — but only if at least one platform actually succeeded.
- **Intelligence Cycle** (`intelligence_cycle`, after Agent 0's weekly
  complete webhook via Make.com Scenario 2): reads Agent 0's gap report to
  prioritize communities, searches those communities read-only, writes
  net-new prospect discoveries to CRM (deduped, VIP-suppressed), flags
  high-engagement educators, checks Stage 1 VIP Prospects for mission-keyword
  posts (warm-follow alerts), and reflects Stage 4 (VIP Onboarding)
  completions onto `Outreach_Status = Converted`.

## VIP suppression (critical rule)

Agent 1B never routes a `VIP_Prospect = true` account to standard automated
outreach — not for prospect creation, not for high-engagement flagging. If a
VIP-flagged account is discovered during community monitoring, it is
suppressed immediately: no CRM write, only a count in the run summary. The
design doc calls this field `VIP_Flag`; the live field is `VIP_Prospect`
(same divergence Agent 0/1A already documented). A separate 12-month
re-approach suppression applies to declined Stage 5 accounts, computed from
the existing `Prospect_Declined_Date` field — see `manifest.js` and
`criteria.isReapproachSuppressed`/`isStage5Declined`.

## CRM reconciliation

Per `ClaudeCode_Zoho_API_Names_Instruction`, nothing is hardcoded from the
design doc. `reconcile.js` resolves the Prospects and Social Post Log
modules and confirms fields live against Zoho on every run — the same
pattern Agent 5A/1A use. See `manifest.js` for the full list of
design-doc-to-live-Zoho divergences discovered during this build, and
`DEPLOY.md` for the CRM field/picklist/module changes made live on
2026-07-08 (including creating the `Social_Post_Logs` module, which did not
exist at the start of this build).

## Files

- `manifest.js` — canonical env vars + CRM field/module spec, with every
  design-doc-to-live-Zoho divergence documented inline.
- `zoho.js` — CRM metadata + data-plane helper (token refresh, module/field
  metadata, search, create/update/get). Copied from `functions/agent5A/zoho.js`
  with search/create/update/get added — each Catalyst function deploys
  independently.
- `reconcile.js` — resolves modules/fields live at runtime; used by
  `orchestrate.js` as a pre-flight check before any CRM query/write.
- `workdrive.js` — Folder 02 (approved assets, list/select-oldest/rename
  `_POSTED`), Folder 07 (most recent gap report), Folder 08 (brand assets,
  both required), Folder 09 (VIP briefings, read-only, supplementary context).
- `ayrshare.js` — single-call multi-platform posting + per-platform response
  parsing (isolated in `parsePostResponse` since the real response shape is
  unconfirmed — see DEPLOY.md).
- `social-monitoring.js` — read-only Facebook/LinkedIn community search +
  per-profile recent-post fetch for warm-follow monitoring (endpoints are a
  documented best-effort interpretation — see DEPLOY.md).
- `zoho-social.js` — read-only engagement (likes/comments/shares) on
  Gracelyn's own posted content.
- `prompts.js` / `claude.js` — the exact §7.1 caption-generation system
  prompt + the Claude call with tolerant JSON parsing (falls back to
  skip-and-alert on non-JSON or API failure — never posts without valid
  captions).
- `criteria.js` — pure logic: gap-report parsing (tallies Agent 0's real
  per-prospect `No_Email` gaps by channel, since Agent 0's actual gap report
  format has no pre-aggregated category breakdown), mission-keyword matching,
  VIP pipeline stage predicates, dedup criteria, role-category estimation.
- `sequencing.js` — pure run-mode classification (`post_cycle` |
  `intelligence_cycle`) + CRM record/payload builders.
- `alerts.js` — pure alert-payload builders (general ops alert, low content,
  post failure).
- `run-summary.js` — pure run-summary payload builder for Scenario 5,
  including the actual list of high-engagement names/URLs (design doc §6),
  not just a count.
- `retry.js` — the design doc's specific "retry once at end of the
  intelligence cycle" batch retry for failed CRM prospect writes (distinct
  from Agent 1A's inline 30-second-delay retry — the design doc gives no
  delay value for 1B).
- `webhook.js` — POSTs to `MAKE_VIP_WARM_FOLLOW_WEBHOOK`,
  `MAKE_LOW_CONTENT_WEBHOOK`, `MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK`, and
  `MAKE_AGENT1B_ALERT_WEBHOOK` with one retry, never throws.
- `orchestrate.js` — the Express-free core (`runPostCycle`,
  `runIntelligenceCycle`, `runAgent1B`), deps-injected so `__tests__` can
  exercise it with fakes.
- `index.js` — thin Express wrapper (`POST /run`, `GET /health`).

## Routes

```
POST /run       → { trigger_type: "post_cycle" | "intelligence_cycle" } → { success, cycleType, summary, ... }
GET  /health    → liveness
```

## Local test

```bash
node __tests__/agent1b.test.js   # no network, no deps, no secrets — 54 cases
```

Covers: gap-report parsing against Agent 0's real format, mission-keyword
matching, VIP stage predicates + 12-month re-approach suppression, dedup,
role-category estimation, run-mode classification, CRM record builders,
Claude JSON extraction + caption validation (both non-JSON and network-
failure paths), Ayrshare payload/response parsing (single-platform and
all-platform failure), WorkDrive `_POSTED` renaming + days-since-last-post,
alert/run-summary payload shapes, the end-of-cycle retry helper, webhook
retry-once, live-CRM reconciliation (module resolution + field pre-flight),
and full end-to-end orchestration for both cycles — every §9 error-handling
row, VIP suppression, high-engagement flagging (including declined-account
suppression), warm-follow alert capping, and Stage 4 → Converted.

## Deploy

Not yet deployed — see `DEPLOY.md` for the Week 2 gate, the live CRM changes
already applied (including creating the `Social_Post_Logs` module), the
design-doc §9 error handling now implemented and wired into the real run
path, and what's still genuinely open (tracked as a Zoho Projects subtask):
several third-party API shape assumptions and inferred Make.com webhook names.

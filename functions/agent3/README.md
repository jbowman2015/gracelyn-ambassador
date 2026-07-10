# Agent 3 — Engagement

The heartbeat of the ambassador program. Manages every ambassador's journey
from activation through the 30-Day Activation Sprint, the standard four-week
content calendar, the non-referral Alternative track, dormant re-engagement,
and the dynamic VIP tier system. Built against
`docs/design/Gracelyn_Agent_3_Engagement_v2.md` (v2.1).

## The 30-Day Activation Sprint (design §4)

Every newly activated ambassador enters the sprint on Agent 2's activation
webhook. Four weekly milestone emails (`sprint.js`):

| Week | Purpose |
| --- | --- |
| 1 | Certify and connect — sent immediately on activation |
| 2 | First outreach — one specific person, not a mass-share ask |
| 3 | First lead — celebration or encouragement framing based on `Sprint_Referral_Submitted` |
| 4 | 90-day goal — reflective, mission reconnection |

Day 28+ (configurable via `SPRINT_GRADUATION_DAYS`, min 21) graduates the
ambassador to the standard cycle: `Activation_Sprint_Week = 0`,
`Engagement_Track = Standard`, `Content_Week_Position = 1`, graduation email.

**Non-negotiable:** the standard weekly cycle never fires for an ambassador
with `Activation_Sprint_Week > 0`. Every query in `weekly.js`/`dormant.js`/
`monthly.js` filters on `Activation_Sprint_Week = 0` for this reason.

## Standard cycle (design §5) — `weekly.js`

Monday 9:00 AM CST. Four-week rotating content calendar (`Standard` track,
`Activation_Sprint_Week = 0`):

| Week | Theme |
| --- | --- |
| 1 | Mission Moment — personalized by `Motivation_Tag` |
| 2 | Success Story — selected from WorkDrive Folder 05 by role category (`story.js`) |
| 3 | Ambassador Spotlight — top referrer in the past 30 days |
| 4 | Program Update — `update_brief.txt` from Folder 08, or a Claude-generated fallback |

`Alternative` track (90+ days post-graduation, zero referrals) rotates
story-invitation / experience-invitation / one-tap-referral-ask by month,
bi-weekly. A referral (`Referral_Stage = Applied`) returns an Alternative-track
ambassador to Standard immediately (`milestones.js`).

## Story selection (Coordination Point #1 with Agent 6)

The second line of every story file in WorkDrive Folder 05 is
`ROLE_CATEGORY: <value>` (`manifest.js` `ROLE_CATEGORY_HEADER`). Selection
chain (`story.js`): exact role match → newest → `Any`-tagged fallback →
newest-overall fallback → empty buffer alerts Parmeet and uses a
Claude-generated placeholder. **Agent 6's session must write this identical
label** — see `docs/planning/Agent_Build_Playbook.md`.

## Dynamic VIP tier system (design §6) — `scoring.js`, `monthly.js`

Three-dimension score (Referral Activity 0-40, Engagement Rate 0-30, Tenure
0-30) computed monthly for every initialized ambassador. Tiers are
population-relative: top `VIP_HIGH_PCT_*` = High VIP, next slice to
`VIP_STD_PCT_*` = Standard VIP. Percentage bands shift once the active
population crosses `VIP_POPULATION_THRESHOLD` (design §6.2). Upgrades trigger
a personal welcome message; downgrades are silent.

## Routes

```
POST /activate                  Agent 2 activation webhook (real-time)
POST /sprint-advance             Monday 8:00 AM CST
POST /weekly-cycle               Monday 9:00 AM CST
POST /milestones                 Daily 7:00 AM CST
POST /referral-stage-change      Zoho Flow webhook (real-time)
POST /dormant-detect             Daily 7:30 AM CST
POST /monthly-non-referral       First Monday of month, 6:00 AM CST
POST /monthly-vip-recalc         First Monday of month, 6:30 AM CST
POST /monthly-vip-supplemental   First Monday of month, 7:00 AM CST
GET  /health                     liveness
```

## CRM name authority

Per `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`, Zoho is
authoritative for module + field api_names. `zoho.js` resolves the
`Ambassadors`/`Referrals` module api_names live and cross-checks every field
this agent reads/writes against Zoho's fields metadata, surfacing any
divergence instead of failing silently.

> **CRM reconciliation (completed live 2026-07-10):** both modules already
> existed. Sixteen new fields were created live on `Ambassadors` — see
> `manifest.js` `AMBASSADOR_FIELDS` and `DEPLOY.md` for the full map and the
> two field-label-length divergences from the design doc's names. No new
> fields were needed on `Referrals`. `Ambassador_Role_Category`,
> `Motivation_Tag`, and `VIP_Prospect_Origin` belong to Agent 2 (unbuilt) —
> Agent 3 reads them defensively.

## Environment variables

See `DEPLOY.md` for the full table. Highlights: `ANTHROPIC_API_KEY`,
`ZOHO_CRM_*` / `ZOHO_MAIL_*` / `ZOHO_WORKDRIVE_*` trios,
`WORKDRIVE_FOLDER_05_ID` / `_08_ID`, `SPRINT_GRADUATION_DAYS` (28),
`NON_REFERRAL_DAYS_THRESHOLD` (90), `DORMANT_DAYS_THRESHOLD` (30),
`VIP_POPULATION_THRESHOLD` (10000) + the four VIP percentage bands,
`PARMEET_ALERT_EMAIL`, `VIP_MANAGER_EMAIL`.

## Local test

```bash
node __tests__/agent3.test.js   # no network, no deps, no secrets
```

Covers: sprint initialization + week-by-week advancement/graduation, the
sprint/standard population separation, story selection by role category (full
fallback chain), VIP tier percentage-band assignment, dormant-detection sprint
exclusion + Day 30/45/60 attempts, the sprint-graduation-anchored 90-day
non-referral threshold, the Alternative-track return-to-Standard transition,
milestone detection at referral 1/5/10, and the §4.3/§10 voice rules (no em
dashes, never "commission").

## Files

- `manifest.js` — env-var spec, Ambassadors/Referrals field names, sprint
  config, content calendar, VIP scoring model, controlled vocabularies.
- `dates.js` — CST date helpers (day/month math, ISO week, first-Monday check).
- `common.js` — CRM record ↔ plain-object mapping, the send-retry-alert pattern.
- `scoring.js` — pure VIP tier scoring + population-relative tier assignment.
- `story.js` — story selection by role category (Coordination Point #1).
- `referrals.js` — Referrals module query helpers (grouping, top referrer).
- `prompts.js` — every Claude system/user prompt (§4.3, §5, §6.3 voice rules).
- `claude.js` — Anthropic Messages client.
- `zoho.js` — live CRM metadata + records (Ambassadors, Referrals, Tasks).
- `mail.js` — Zoho Mail sender.
- `workdrive.js` — story buffer read/mark-used, Folder 08 update brief.
- `heygen.js` — milestone recognition video submission.
- `webhooks.js` — Make.com delivery with one-retry.
- `alerts.js` — Parmeet alert formatting + delivery.
- `sprint.js` — 30-Day Activation Sprint (init, advancement, graduation).
- `weekly.js` — standard + Alternative track weekly cycle.
- `dormant.js` — daily dormant detection.
- `milestones.js` — referral stage-change webhook + daily milestone detection.
- `monthly.js` — non-referral check, VIP recalculation, VIP supplemental.
- `index.js` — Express app.

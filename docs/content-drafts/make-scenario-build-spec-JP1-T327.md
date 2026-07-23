# Make.com Scenario Build Spec — JP1-T327

Every `MAKE_*WEBHOOK*` env var across all 10 agent functions, pulled from the
actual source code (not just design docs — several design docs turned out to
diverge from what's actually implemented, flagged inline below). Use this to
configure the real Make.com HTTP modules once you're ready to build the rest.

**Account:** org "Gracelyn University" (`8012131`), team "My Team"
(`2428908`) — the new Make.com account, "Teams" plan, 120,000 ops/month, no
visible hard scenario cap (unlike the old Free-plan account this replaced).

**Already built and live:** Agent 4 Scenario 3 (VIP Recalc Audit) — see
`functions/agent3/DEPLOY.md` and `functions/agent4/DEPLOY.md` for the hook
URL and scenario ID. Everything below is spec only, not yet built.

---

## Quick-reference table — everything that actually fires

| Agent | Env var | Design scenario | Required? | Fallback when unset |
| --- | --- | --- | --- | --- |
| 0 | `MAKE_VIP_NOTIFY_WEBHOOK_URL` | Scenario 2: VIP Prospect Notification | optional | Alerts admin; VIP flag still written to CRM |
| 0 | `MAKE_AGENT0_COMPLETE_WEBHOOK_URL` | Scenario 3: Recruiting Agent Trigger | optional | No attempt, no alert (silent) |
| 0 | `MAKE_ADMIN_ALERT_WEBHOOK_URL` | not numbered (alert channel) | optional | Logs only, `console.error` |
| 1A | `MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL` | Scenario 3: Coordinator Run Summary | optional | Direct Parmeet alert email with full summary |
| 1B | `MAKE_VIP_WARM_FOLLOW_WEBHOOK` | Scenario 3: VIP Warm Follow Alert | optional | Logged as run error, no alt delivery |
| 1B | `MAKE_LOW_CONTENT_WEBHOOK` | Scenario 4: Low Content Alert | optional | `lowContentAlertDelivered: false` in response, no alt delivery |
| 1B | `MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK` | Scenario 5: Run Summary (undocumented in §12) | optional | Triggers a separate ops alert |
| 1B | `MAKE_AGENT1B_ALERT_WEBHOOK` | not numbered (undocumented) | optional | Silent — return value discarded |
| 1C | `MAKE_SPEND_ALERT_WEBHOOK_URL` | Scenario 1: Daily Spend Alert | optional | Direct Zoho Mail to coordinator + admin |
| 1C | `MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL` | Scenario 3: Kill Switch Alert | optional | Falls to admin alert path |
| 1C | `MAKE_ADMIN_ALERT_WEBHOOK_URL` | not numbered | optional | Log-only |
| 1D | `MAKE_AGENT1A_FROM_1D_WEBHOOK_URL` | Scenario 2: Agent 1A Handoff | optional (warn) | Parmeet alert, logs prospect data for manual trigger |
| 1D | `MAKE_AGENT1D_ERROR_WEBHOOK` | Scenario 4: Error Alert Routing | optional | Log-only |
| 2 | `MAKE_AGENT3_WEBHOOK_URL` | Scenario 5: Compliance Complete | optional | Parmeet alert, high priority |
| 2 | `MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL` | Scenario 2 (B4-VIP) + Scenario 5 (D6) — two call sites | optional | Parmeet alert |
| 2 | `MAKE_WINBACK_SURVEY_WEBHOOK` | Scenario 4: Win-Back Survey Response | optional | Parmeet alert, "reach out personally" |
| 2 | `MAKE_AGENT2_ERROR_WEBHOOK` | not numbered | optional | Log-only |
| 3 | `MAKE_AGENT3_ERROR_WEBHOOK` | not numbered | optional | Falls to direct Zoho Mail |
| 3 | `MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK` | **✅ BUILT** (Scenario 3, Agent 4's numbering) | optional | Skips notifying Agent 4 |
| 4 | `MAKE_AGENT4_SLA_BREACH_WEBHOOK` | Scenario 4: SLA Breach Alert — **deferred, not needed** | optional | Direct coordinator email (already works) |
| 4 | `MAKE_AGENT4_COMPLIANCE_WEBHOOK` | Scenario 5: Content Compliance — **deferred, not needed** | optional | Direct coordinator email (already works) |
| 5 | `MAKE_ESCALATION_WEBHOOK_URL` | Scenario 1: escalation routing | **required** | Direct email to coordinator, then Parmeet alert |
| 6 | `MAKE_BUFFER_ALERT_WEBHOOK` | "buffer alert routing" — **dead code, do not build** | optional | N/A — never called; alert already goes via Zoho Mail |

**Inbound-only** (Make.com calls *into* the agent — no env var needed on the agent's side, just paste the agent's own Catalyst URL into the Make.com HTTP module):
- Agent 0 `/on-demand` — Scenario 4: On-Demand Single Prospect
- Agent 1A `/run` (all trigger types share one endpoint, including the Agent 1D handoff)
- Agent 1B — intelligence cycle trigger (Scenario 2, fired by Agent 0's Scenario 3)
- Agent 1C `/recordConfirmation`, `/resumeCampaigns`, `/weeklyAudienceRefresh`
- Agent 2 `/application-received` (Scenario 1), `/winback-survey-response` (Scenario 4 trigger)
- Agent 3 `/referral-stage-change` (Scenario 5, fired by a Zoho Flow, not Make.com)

---

## Do NOT build yet — declared but not wired in code

These env vars exist in a `manifest.js` ENV_SPEC but nothing in the actual
source code ever reads or calls them. Building a Make.com scenario against
them right now would create a receiver nothing will ever call. Flag back to
whoever owns each agent before spending time on these:

| Env var | Agent | Why it's dead |
| --- | --- | --- |
| `MAKE_AGENT0_ONDEMAND_WEBHOOK_URL` | 0 | Manifest labels it "Scenario 4," but Scenario 4 is actually implemented as an inbound route (`/on-demand`), not an outbound call. |
| `MAKE_AGENT1A_WEBHOOK_URL` | 1A | This is the URL Make.com's own Scenario 1 module generates for Agent 0 to call — Agent 1A's code never reads it. |
| `MAKE_AGENT1A_FROM_1D_WEBHOOK_URL` | 1A | Not in the design doc at all. Agent 1D's handoff actually arrives on Agent 1A's normal `/run` endpoint with `trigger_type: 'lead_capture_new_contact'`, no dedicated webhook needed. |
| `MAKE_COORDINATOR_QUEUE_WEBHOOK_URL` | 2 | Zero call sites anywhere in Agent 2. The coordinator queue is just a CRM view filtered on status + date, per the code's own docblock. |
| `MAKE_BUFFER_ALERT_WEBHOOK` | 6 | Never called. The buffer alert already goes out via Zoho Mail directly — this is vestigial. |

## Doc/code divergences worth resolving before building

- **Agent 4 SLA breach webhook payload**: the design doc's §4.3 table specifies
  a 10-field escalation payload including `escalation_timestamp`. The actual
  `sla.js` payload sends `hours_since_escalation` (computed) instead, and
  omits `ambassador_id`, `ambassador_name`, `resolution_complexity`,
  `question_text`, `escalation_timestamp` entirely. If you ever do build
  Scenario 4/5 despite the "not needed" flag above, build against the real
  payload below, not the doc's table.
- **Agent 2 VIP notification payload**: two call sites fire
  `MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL` with inconsistent key casing
  (`ambassadorId`/`firstName` from B4-VIP vs `ambassador_id`/`first_name`
  from D6) and different `type` values (`vip_approval` vs
  `vip_activation_co_creation`). A single Make.com scenario receiving both
  needs to handle both shapes, or the two call sites should be reconciled in
  code first.
- **Agent 3 referral webhook naming**: manifest.js canonical name is
  `MAKE_AGENT3_WEBHOOK_URL`; the design doc's env var table calls it
  `MAKE_AGENT3_REFERRAL_WEBHOOK`. Use the manifest.js name.
- **Agent 1D handoff webhook naming**: design doc names it
  `MAKE_AGENT1A_FROM_1D_WEBHOOK` (no `_URL` suffix); manifest.js's canonical
  name has the suffix. Use the manifest.js name.

---

## Detailed payloads, ready to configure

### Agent 0

**`MAKE_VIP_NOTIFY_WEBHOOK_URL`** (Scenario 2: VIP Prospect Notification)
Fires when a prospect's VIP score crosses the threshold, after the briefing
is generated/uploaded.
```json
{
  "type": "vip_prospect",
  "prospect": "<name>",
  "vipScore": "<number>",
  "briefingFile": "VIP_Brief_<name>_<YYYY-MM-DD>.txt",
  "briefingFileId": "<WorkDrive file id, or null>",
  "moduleApi": "<Prospects module api_name>",
  "date": "<YYYY-MM-DD>",
  "vipManagerEmail": "<VIP_MANAGER_EMAIL value>"
}
```
Receiving end (design doc): send briefing link to VIP Relationship Manager,
create VIP Prospect Pipeline record (Stage = Warm Follow), coordinator
dashboard alert, add to VIP tracking view.

**`MAKE_AGENT0_COMPLETE_WEBHOOK_URL`** (Scenario 3: Recruiting Agent Trigger)
Fires unconditionally at the end of every run.
```json
{
  "type": "agent0_run_complete",
  "date": "<YYYY-MM-DD>",
  "mode": "WEEKLY | ON_DEMAND",
  "standardProspects": "<number>",
  "byRoleCategory": { "<role category>": "<count>", "...": "..." }
}
```
Receiving end: fan out to Agents 1A, 1B, 1C, 1D in parallel.

**`MAKE_ADMIN_ALERT_WEBHOOK_URL`** (alias `MAKE_PARMEET_ALERT_WEBHOOK_URL`)
General error channel, fires on any pipeline failure.
```json
{
  "to": "<ADMIN_ALERT_EMAIL>",
  "subject": "[Agent 0 Alert] <errorType> — <date>",
  "body": "Agent 0 encountered an error...\nError type: ...\nAction required: ...",
  "type": "agent0_alert"
}
```

### Agent 1A

**`MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL`** (Scenario 3: Coordinator Run Summary)
Fires at the end of every run (all 4 trigger types), unconditionally.
```json
{
  "trigger_source": "agent_1a_run_complete",
  "triggered_at": "<ISO timestamp>",
  "run_type": "agent0_complete | followup_schedule | unresponsive_mark | lead_capture_new_contact",
  "emails_sent": "<number>",
  "emails_failed": "<number>",
  "contacts_processed": "<number>",
  "para_db_sent": 0,
  "prospect_sent": "<number>",
  "student_alumni_sent": 0,
  "test_segment_active": false,
  "run_status": "Complete | Partial",
  "crm_update_failures": [{ "contactId": "...", "reason": "..." }]
}
```
Receiving end: email `COORDINATOR_ALERT_EMAIL` + `PARMEET_ALERT_EMAIL`,
subject `Agent 1A Run Summary: {{emails_sent}} emails sent`.

### Agent 1B

**`MAKE_VIP_WARM_FOLLOW_WEBHOOK`** (Scenario 3: VIP Warm Follow Alert)
```json
{
  "trigger_source": "agent_1b_warm_follow",
  "prospect_name": "<name>",
  "prospect_record_id": "<CRM id or null>",
  "post_url": "<matched post URL>",
  "matched_keywords": ["<keyword>", "..."],
  "relevance_summary": "Posted content matching: <keywords>.",
  "suggested_engagement_response": "Consider a genuine, specific comment referencing: <keywords>."
}
```
Receiving end: create CRM task assigned to VIP Relationship Manager.

**`MAKE_LOW_CONTENT_WEBHOOK`** (Scenario 4: Low Content Alert)
```json
{
  "trigger_source": "agent_1b_low_content",
  "message": "WorkDrive Folder 02 has no unposted assets remaining.",
  "days_since_last_post": "<number>",
  "request": "Parmeet: please upload new approved social content assets."
}
```

**`MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK`** (Scenario 5: Run Summary — undocumented
in the design doc's own env var table, name inferred by the developer)
```json
{
  "trigger_source": "agent_1b_run_complete",
  "triggered_at": "<ISO date>",
  "cycle_type": "post_cycle | intelligence_cycle",
  "posts_published": 0,
  "posts_failed": 0,
  "new_prospects_discovered": 0,
  "high_engagement_flags": 0,
  "high_engagement_prospects": [{ "name": "...", "socialProfileUrl": "..." }],
  "vip_warm_follow_alerts_sent": 0,
  "vip_accounts_suppressed": 0,
  "crm_write_failures": [{ "socialProfileUrl": "...", "reason": "..." }],
  "social_post_log_skipped": false,
  "run_status": "Complete | Partial | Failed",
  "errors": ["..."]
}
```

**`MAKE_AGENT1B_ALERT_WEBHOOK`** (general ops alert, also undocumented as a
numbered scenario)
```json
{
  "subject": "[AGENT 1B ALERT] <failureType> — <runDate>",
  "body": "Agent: Social Outreach Agent (Agent 1B)\nRun Date: ...\nFailed Step: ...\nRecommended Action: ...",
  "type": "agent1b_ops_alert"
}
```

### Agent 1C

**`MAKE_SPEND_ALERT_WEBHOOK_URL`** (Scenario 1: Daily Spend Alert)
```json
{
  "trigger_source": "agent_1c_daily_spend_alert",
  "alert_date": "<date>",
  "meta_spend": "<number>", "meta_threshold": "<number>", "meta_over_threshold": true,
  "google_spend": "<number>", "google_threshold": "<number>", "google_over_threshold": false,
  "combined_spend": "<number>",
  "threshold_status": "<string>",
  "log_record_id": "<id>"
}
```

**`MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL`** (Scenario 3: Kill Switch Alert)
```json
{
  "trigger_source": "agent_1c_kill_switch_fired",
  "spend_date": "<date>", "fired_at": "<timestamp>",
  "campaigns_paused": "<number>",
  "reason": "Daily spend not confirmed by coordinator by 10:00 AM CST.",
  "restart_instructions": "Confirm in the coordinator dashboard, then trigger Restart Campaigns. Campaigns will NOT restart automatically.",
  "recipients": ["<coordinator email>", "<admin email>", "<Dr. Flippen email>"]
}
```

**Reminder:** Agent 1C's kill-switch mechanism spans multiple scenarios and
real ad spend — build and test this with Parmeet present, on test ad
accounts, per `docs/content-drafts` / `functions/agent1C/DEPLOY.md`'s open
items list, not as a solo/blind build.

### Agent 1D

**`MAKE_AGENT1A_FROM_1D_WEBHOOK_URL`** (Scenario 2: Agent 1A Handoff)
```json
{
  "type": "lead_capture_new_contact",
  "email": "<email>", "first_name": "<name>",
  "role_category": "<category>", "audience_track": "<track>",
  "lead_magnet_id": "<id>"
}
```
Receiving end: this actually POSTs straight to Agent 1A's `/run` endpoint —
see Agent 1A's section above, no separate receiver needed.

**`MAKE_AGENT1D_ERROR_WEBHOOK`** (Scenario 4: Error Alert Routing)
```json
{
  "type": "agent1d_error",
  "errorType": "<type>", "detail": "<detail>",
  "email": "<email or null>", "leadMagnetId": "<id or null>",
  "parmeetAlertEmail": "<PARMEET_ALERT_EMAIL>",
  "timestamp": "<ISO timestamp>"
}
```

### Agent 2

**`MAKE_AGENT3_WEBHOOK_URL`** (Scenario 5: Compliance Complete, step D5)
```json
{
  "type": "agent2_activation",
  "ambassador_id": "<id>", "email": "<email>", "first_name": "<name>",
  "role_category": "<category>", "audience_track": "<track>",
  "motivation_tag": "<tag>", "vip_flag": false, "vip_prospect_origin": false
}
```

**`MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL`** — two shapes, see divergence note
above. B4-VIP (approval):
```json
{ "type": "vip_approval", "ambassadorId": "<id>", "firstName": "<name>", "email": "<email>", "roleCategory": "<role>", "audienceTrack": "<track>" }
```
D6 (activation, VIP only):
```json
{ "type": "vip_activation_co_creation", "ambassador_id": "<id>", "email": "<email>", "first_name": "<name>" }
```

**`MAKE_WINBACK_SURVEY_WEBHOOK`** (Scenario 4: Win-Back Survey Response, only
fires on the "technical problem" response option)
```json
{ "type": "winback_technical_problem", "ambassadorId": "<id>", "email": "<email>", "firstName": "<name>" }
```

**`MAKE_AGENT2_ERROR_WEBHOOK`** — same general-alert shape as other agents:
`{ "to": "...", "subject": "...", "body": "...", "type": "agent2_alert" }`.

### Agent 3

**`MAKE_AGENT3_ERROR_WEBHOOK`** — general alert:
`{ "to": "...", "subject": "...", "body": "...", "type": "agent3_alert" }`.

**`MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK`** — already built, see the top of
this doc.

### Agent 5

**`MAKE_ESCALATION_WEBHOOK_URL`** (Scenario 1: escalation routing) — **the
only `required: true` webhook in the whole program.**
```json
{
  "ticket_id": "<id>", "ambassador_id": "<id or null>", "ambassador_name": "<name>",
  "tier": "<tier>", "issue_category": "<category>",
  "is_urgent": false, "is_vip": false,
  "resolution_complexity": "<complexity>",
  "question_text": "<text>", "escalation_timestamp": "<ISO timestamp>"
}
```
Receiving end (design §9): Router on `is_urgent` — Path A (urgent/Tier
3/VIP): email coordinator + Parmeet, CC VIP manager if `is_vip`, 4-hour SLA.
Path B (standard/Tier 2): email coordinator only, 24-hour SLA. Error path:
email Parmeet with full payload on any webhook delivery error.

---

## Suggested build order

1. **Agent 5 escalation webhook** — the only required one; ambassador support
   is broken without it once ambassadors are live.
2. **Agent 0 → recruiting fan-out + VIP notify** — these gate the whole
   recruiting pipeline (Agents 1A-1D never fire without Agent 0's Scenario 3).
3. **Agent 2 compliance-complete → Agent 3 activation** — gates ambassadors
   ever entering the engagement cycle.
4. **Agent 1A/1B/1D run-summary and handoff webhooks** — important but each
   agent degrades gracefully (direct email fallback) if these lag behind.
5. **Agent 1C** — last, and only with Parmeet present per the reminder above;
   this is the one with real financial/ad-spend risk if half-built.

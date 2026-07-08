# Agent Build Playbook

Ready-to-paste session prompts for the remaining Ambassador Scaling agents, so every
build session starts without re-deriving context. **One agent per session.**

## Build order & status
- [x] **Agent 5A** — Setup Validation (go/no-go gate)
- [x] **Agent 0** — Research & Intelligence *(on `main`)*
- [ ] **Agent 1A** — Database Email
- [ ] **Agent 1B** — Social Outreach
- [ ] **Agent 1C** — Paid Advertising
- [ ] **Agent 1D** — Lead Capture
- [ ] **Agent 2** — Onboarding *(most complex)*
- [ ] **Agent 3** — Engagement
- [ ] **Agent 4** — Compliance Oversight
- [ ] **Agent 5** — Ambassador Support
- [ ] **Agent 6** — Story Content Intake

All remaining agents depend on **Agent 0** (now on `main`), not on each other — so after
Agent 0 they can be built in any order (the order above is just a sensible default). Merge
each finished agent to `main` when its tests are green so the board and `main` stay current.

## How to use
Start a fresh session and paste that agent's block from **§ Session prompts** below. Each
prompt tells the session to read **§ Standard Build Rules** (this file) + that agent's
**§ Per-agent entry** + its design doc — nothing else. Check the box above as you finish each.

---

## Standard Build Rules
*(Every session reads this section first.)*

1. **Scope / reading guardrail.** Build ONLY the named agent. Read ONLY: this
   "Standard Build Rules" section, that agent's "Per-agent entry" below, the agent's design
   doc, `docs/planning/Ambassador_Master_Reference_Sheet.md`, and
   `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`. Do **not** bulk-read `docs/`.
2. **Reference implementation.** Mirror `functions/agent0/` — `manifest.js` (env/field/vocab
   source of truth), pure-logic modules, `index.js` exporting an Express `app`, and a
   `__tests__/` suite that runs with **no network, no deps, no secrets**. Reuse the CRM
   metadata helper `functions/agent5A/zoho.js` (Agent 0's `zoho.js` shows the pattern).
3. **CRM is authoritative.** Pull module/field api_names **live** from Zoho and reconcile;
   never hardcode from the design doc. Confirmed-live facts (2026-07-07):
   - Prospects module = existing **`Ambassador_Leads`** (`PROSPECTS_MODULE_API_NAME=Ambassador_Leads`).
   - `First_Name` → existing **`Name`**; `Organization` → existing **`Company_Name`** (no duplicates).
   - Already on `Ambassador_Leads`: `Social_Profile_URL`, `Channel_Source`, `Contact_Found`,
     `Gap_Type`, `Role_Category` (text), `Motivation_Tag`, `Mission_Alignment_Score`,
     `Org_Influence_Score`, `VIP_Prospect`, `VIP_Prospect_Score`, `VIP_Pipeline_Stage`,
     `Prospect_Declined_Date`, `Outreach_Status` (values `Standard` / `VIP Pipeline`).
   - Any new field must be **created live and surfaced on divergence** — never silently skipped.
4. **Coordination points (confirm before writing CRM logic):**
   - `ROLE_CATEGORY` header — identical label between **Agent 3 and Agent 6** (2nd line of every story file).
   - Nine Support Tickets SLA field api_names — identical between **Agent 4 and Agent 5**.
   - `escalation_timestamp` webhook string == `Escalation_Timestamp` CRM value, **exactly**.
5. **AI.** Anthropic Claude `claude-sonnet-4-20250514` unless the design doc says otherwise.
   Only **Agent 5** also uses OpenAI (portal assistant: `OPENAI_API_KEY` +
   `OPENAI_AMBASSADOR_ASSISTANT_ID`).
6. **Env-var names** are canonical only (see `functions/agent5A/manifest.js` + `.env.example`).
   Watch: split ad thresholds `META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD`;
   `META_ADS_ACCESS_TOKEN`; `HEYGEN_FLIPPEN_AVATAR_ID`.
7. **Deliverables per agent:** local test passing; add the function to `catalyst.json`
   `targets`; `catalyst-config.json` `env_variables` stays `{}`; stage a `DEPLOY.md` like
   `functions/agent0/DEPLOY.md`. **No secrets in the repo. Do NOT deploy** (Week 2 gate).
8. **Zoho Projects** (portal `745686712`, project `1776658000000715069`): mark the agent's
   task `inprogress` at start and `completed` at end, each with a short comment — via the
   Zoho Projects MCP if connected, else `scripts/zoho-projects-update.js`.
9. **Git:** branch from `main` using the name in the agent entry; commit + push; open a PR
   to `main`; merge once tests are green (squash). Then check the box in this file.

---

## Per-agent entries

### Agent 1A — Database Email
- **Doc:** `docs/design/Gracelyn_Agent_1A_Database_Email_v1.md`
- **Function/branch:** `agent1A` · `claude/agent-1A-database-email`
- **Notes:** Recruiting — outbound email sequences into the paraprofessional database; reads
  prospects from `Ambassador_Leads`. **Never message VIP prospects** (honor VIP suppression).
- **Zoho task fragment:** `Agents 1A` (shared "Agents 1A–1D" task; tag `Agents 1A-1D`).

### Agent 1B — Social Outreach
- **Doc:** `docs/design/Gracelyn_Agent_1B_Social_Outreach_v2.md`
- **Function/branch:** `agent1B` · `claude/agent-1B-social-outreach`
- **Notes:** Recruiting via social. Social listening/posting routes through **Make.com / Ayrshare**
  — no direct social-network API calls from agent code. VIP suppression applies.
- **Zoho task fragment:** `Agents 1A` (shared task; tag `Agents 1A-1D`).

### Agent 1C — Paid Advertising
- **Doc:** `docs/design/Gracelyn_Agent_1C_Paid_Advertising_v1.md`
- **Function/branch:** `agent1C` · `claude/agent-1C-paid-advertising`
- **Notes:** Meta + Google paid ads. Env: `META_ADS_ACCESS_TOKEN`, and **split** daily caps
  `META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD` (never a single combined var).
- **Zoho task fragment:** `Agents 1A` (shared task; tag `Agents 1A-1D`).

### Agent 1D — Lead Capture
- **Doc:** `docs/design/Gracelyn_Agent_1D_Lead_Capture_v2.md`
- **Function/branch:** `agent1D` · `claude/agent-1D-lead-capture`
- **Notes:** Inbound lead capture (Zoho Forms → `Ambassador_Leads`). Dedup against the same
  `Social_Profile_URL` key Agent 0 uses.
- **Zoho task fragment:** `Agents 1A` (shared task; tag `Agents 1A-1D`).

### Agent 2 — Onboarding *(most complex)*
- **Doc:** `docs/design/Gracelyn_Agent_2_Onboarding_v2.md`
- **Function/branch:** `agent2` · `claude/agent-2-onboarding`
- **Notes:** Compliance form, win-back sequences, Phase 2 auto-approve. Works with the
  **Ambassadors** module (approved ambassadors) in addition to `Ambassador_Leads`; resolve that
  module's api_name live. Honor `APPROVAL_MODE` (MANUAL/AUTO). Largest surface — budget the session.
- **Zoho task fragment:** `Agent 2`.

### Agent 3 — Engagement
- **Doc:** `docs/design/Gracelyn_Agent_3_Engagement_v2.md`
- **Function/branch:** `agent3` · `claude/agent-3-engagement`
- **Notes:** Weekly touchpoints, story-by-role-category, dynamic VIP tiers. **Coordination #1:**
  the `ROLE_CATEGORY` header (2nd line of every story file) must match Agent 6 **exactly** —
  keep the label identical. Consumes story content produced by Agent 6.
- **Zoho task fragment:** `Agent 3`.

### Agent 4 — Compliance Oversight
- **Doc:** `docs/design/Gracelyn_Agent_4_Compliance_Oversight_v2.md`
- **Function/branch:** `agent4` · `claude/agent-4-compliance-oversight`
- **Notes:** SLA tracking, VIP audit, reporting. **Coordination #2:** the nine Support Tickets
  SLA field api_names must be identical to Agent 5 — resolve live and keep them in the manifest.
  **Coordination #3:** `escalation_timestamp` string must equal the `Escalation_Timestamp` CRM
  field value exactly.
- **Zoho task fragment:** `Agent 4`.

### Agent 5 — Ambassador Support
- **Doc:** `docs/design/Gracelyn_Agent_5_Support_v2.md`
- **Function/branch:** `agent5` · `claude/agent-5-ambassador-support`
- **Notes:** Portal chat + escalation webhook. **Uses OpenAI** for the portal assistant
  (`OPENAI_API_KEY`, `OPENAI_AMBASSADOR_ASSISTANT_ID`) alongside Claude. Shares **Coordination #2**
  (nine SLA field api_names with Agent 4) and **#3** (`escalation_timestamp` == `Escalation_Timestamp`).
- **Zoho task fragment:** `Agent 5`.

### Agent 6 — Story Content Intake
- **Doc:** `docs/design/Gracelyn_Agent_6_Story_Intake_v2.md`
- **Function/branch:** `agent6` · `claude/agent-6-story-intake`
- **Notes:** Feeds Agent 3. **Coordination #1:** the `ROLE_CATEGORY` header it writes on the 2nd
  line of every story file must match the label Agent 3 reads — keep them identical.
- **Zoho task fragment:** `Agent 6`.

---

## Session prompts

Paste one block to start that agent's session (swap nothing — each is complete).

> **Agent 1A —** Build **Agent 1A — Database Email**. First read
> `docs/planning/Agent_Build_Playbook.md` — the "Standard Build Rules" section and the
> "Agent 1A — Database Email" entry — then read `docs/design/Gracelyn_Agent_1A_Database_Email_v1.md`,
> `docs/planning/Ambassador_Master_Reference_Sheet.md`, and
> `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`. Build to those rules (mirror
> `functions/agent0/`, reuse `functions/agent5A/zoho.js`, reconcile CRM names live, ship a
> no-network test, add to `catalyst.json`, stage `DEPLOY.md`, don't deploy). Update the Zoho task.
> Develop on `claude/agent-1A-database-email`; commit, push, open a PR to `main`, merge when green.

> **Agent 1B —** Build **Agent 1B — Social Outreach**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 1B" entry), then
> `docs/design/Gracelyn_Agent_1B_Social_Outreach_v2.md` + the two `docs/planning/` references.
> Build to those rules. Develop on `claude/agent-1B-social-outreach`; PR to `main`, merge when green.

> **Agent 1C —** Build **Agent 1C — Paid Advertising**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 1C" entry), then
> `docs/design/Gracelyn_Agent_1C_Paid_Advertising_v1.md` + the two `docs/planning/` references.
> Build to those rules. Develop on `claude/agent-1C-paid-advertising`; PR to `main`, merge when green.

> **Agent 1D —** Build **Agent 1D — Lead Capture**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 1D" entry), then
> `docs/design/Gracelyn_Agent_1D_Lead_Capture_v2.md` + the two `docs/planning/` references.
> Build to those rules. Develop on `claude/agent-1D-lead-capture`; PR to `main`, merge when green.

> **Agent 2 —** Build **Agent 2 — Onboarding**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 2" entry), then
> `docs/design/Gracelyn_Agent_2_Onboarding_v2.md` + the two `docs/planning/` references.
> Build to those rules. Develop on `claude/agent-2-onboarding`; PR to `main`, merge when green.

> **Agent 3 —** Build **Agent 3 — Engagement**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 3" entry), then
> `docs/design/Gracelyn_Agent_3_Engagement_v2.md` + the two `docs/planning/` references.
> Build to those rules (note Coordination #1: `ROLE_CATEGORY` header must match Agent 6).
> Develop on `claude/agent-3-engagement`; PR to `main`, merge when green.

> **Agent 4 —** Build **Agent 4 — Compliance Oversight**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 4" entry), then
> `docs/design/Gracelyn_Agent_4_Compliance_Oversight_v2.md` + the two `docs/planning/` references.
> Build to those rules (Coordination #2: nine SLA field api_names shared with Agent 5; #3:
> `escalation_timestamp` == `Escalation_Timestamp`). Develop on `claude/agent-4-compliance-oversight`;
> PR to `main`, merge when green.

> **Agent 5 —** Build **Agent 5 — Ambassador Support**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 5" entry), then
> `docs/design/Gracelyn_Agent_5_Support_v2.md` + the two `docs/planning/` references.
> Build to those rules (uses OpenAI portal assistant; Coordination #2 + #3 shared with Agent 4).
> Develop on `claude/agent-5-ambassador-support`; PR to `main`, merge when green.

> **Agent 6 —** Build **Agent 6 — Story Content Intake**. First read
> `docs/planning/Agent_Build_Playbook.md` (Standard Build Rules + "Agent 6" entry), then
> `docs/design/Gracelyn_Agent_6_Story_Intake_v2.md` + the two `docs/planning/` references.
> Build to those rules (Coordination #1: `ROLE_CATEGORY` header must match Agent 3).
> Develop on `claude/agent-6-story-intake`; PR to `main`, merge when green.

---

## Non-agent Week 1 / Week 2 tasks
These board tasks are **configuration**, not Claude Code build sessions — they're done in the
Zoho/Make/WordPress consoles, not by writing a Catalyst function. Claude can *assist* (draft
specs, form field lists, flow logic) but there's no "build session" prompt for them:
CRM field builds for the **Ambassadors** / **Support Tickets** modules, the 8 Zoho Forms,
10 Zoho Flows, 17 Make.com scenarios, WordPress portal changes, and the payment-provider
setups (Wise / Tremendous / PayPal). Deployment + Job Scheduling are the **Week 2 gate**.

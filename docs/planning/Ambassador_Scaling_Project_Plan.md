# Ambassador Scaling Project — Implementation Plan & Timeline

**Prepared for:** Blaine, Gracelyn University Ambassador Program
**Date:** July 6, 2026
**Target go-live:** July 18, 2026 (2 weeks)
**Status of design:** Complete. All 15 build documents locked. No open design decisions.

---

## 1. What "implementation" means here

This build is not a single-owner job, so a realistic plan has to split the work by who actually executes each piece. Pretending one party can do all of it is how August 1 slips. There are four execution lanes:

| Lane | Who | What they do |
|------|-----|--------------|
| **Content & specs** | *This Claude conversation* | Draft missing content, format the knowledge base, produce Make.com/WordPress change specs, review Claude Code output against the agent docs, support decisions. |
| **Agent code** | *Claude Code (browser)* | Write, test, and debug all 11 Catalyst functions, Deluge scripts, and WordPress code against the agent documents. |
| **Infrastructure & UI** | *Parmeet / Dr. Flippen* | Zoho CRM modules and fields, WorkDrive folders, Zoho Forms and Flows, account setup (Wise, Tremendous, PayPal), deployment to Catalyst. |
| **Sign-off** | *Dr. Flippen* | Approve content, confirm the five sensitive policy variables, approve HeyGen scripts. |

**What I can implement directly in this conversation** is the content and specification layer: the missing lead magnets, the reformatted Agent 5 knowledge base, the four Folder 08 brand asset files, Make.com scenario specs, WordPress change specs, and continuous review of every agent function Claude Code produces. Everything requiring a login (opening Wise, creating CRM fields, deploying to Catalyst) sits with Parmeet or Dr. Flippen — I can produce the exact step list for those, but I can't execute them.

---

## 2. System at a glance

Eleven agents across nine workstreams, scaling toward 100,000 ambassadors:

- **Agent 0** — Research & Intelligence (feeds all others; VIP Prospect scoring)
- **Agents 1A–1D** — Recruiting: database email, social outreach, paid ads, lead capture
- **Agent 2** — Onboarding (combined compliance form, win-back, Phase 2 auto-approve)
- **Agent 3** — Engagement (weekly cycle, story-by-role-category, dynamic VIP tiers)
- **Agent 4** — Compliance Oversight (SLA tracking, VIP audit, reporting)
- **Agent 5** — Ambassador Support (portal chat, escalation webhook)
- **Agent 5A** — Setup Validation (go/no-go gate; runs first)
- **Agent 6** — Story Content Intake (feeds Agent 3)

Agents 1A, 1C, and 5A are unchanged from v1. All others are at v2.0.

---

## 3. Two-week timeline

Two weeks is only possible because the design is fully locked and no piece waits on a decision. It holds by running all four lanes in parallel every day, not in sequence. The compression is real: the honest tradeoff is that if Wise/Tremendous verification runs the full 1–3 business days, you launch on PayPal payouts and switch international routing on a few days later. Everything else has to move day-by-day, not week-by-week.

### Week 1 (Jul 7–11) — Everything starts at once
**Goal:** All content produced, all infrastructure built, all agent code drafted. No task waits for another lane to finish.

| Day | Task | Owner |
|-----|------|-------|
| Mon | Open Wise + Tremendous; confirm PayPal Payouts | Dr. Flippen |
| Mon | Content audit vs. the three content needs | Blaine + Claude |
| Mon | Start CRM field build (Ambassadors +39, Prospects 20, Support Tickets 12) | Parmeet |
| Mon | Claude Code starts Agent 5A, then Agent 0 | Claude Code + **Claude review** |
| Tue–Wed | Draft missing lead magnets + 4 Folder 08 files + reformat Agent 5 KB | **Claude (this chat)** |
| Tue–Wed | WorkDrive folders (06, 08, 09); begin 8 Zoho Forms | Parmeet |
| Tue–Thu | Claude Code writes Agents 1A–1D and Agent 2 (most complex) | Claude Code + **Claude review** |
| Wed | Confirm 5 sensitive policy env variables | Dr. Flippen |
| Thu–Fri | Configure 10 Zoho Flows; finish Forms | Parmeet |
| Thu–Fri | Claude Code writes Agents 3, 4, 5, 6 | Claude Code + **Claude review** |
| Fri | Write Make.com scenario specs + WordPress change specs | **Claude (this chat)** |
| Fri | **Confirm the 3 cross-agent coordination points** (see §4) | Both |

**End-of-week gate:** all content approved, all CRM/Forms/Flows built, all 11 functions written and reviewed.

### Week 2 (Jul 14–18) — Deploy, test, launch
**Goal:** Stand it up in the live environment, prove the pipeline, activate.

| Day | Task | Owner |
|-----|------|-------|
| Mon | Build Make.com scenarios; load OpenAI KB for Agent 5 | Parmeet |
| Mon–Tue | WordPress portal changes — **Parmeet present, review first** | Parmeet + Claude Code |
| Tue | Deploy all agents to Catalyst | Parmeet |
| Wed | **Run Agent 5A validation — go/no-go gate** | Both |
| Wed–Thu | End-to-end test with a real form submission | Both |
| Thu | Debug failures (paste error logs to Claude Code) | Claude Code |
| Fri | Activate first cohort (APPROVAL_MODE=MANUAL); confirm engagement cycle | Dr. Flippen / Parmeet |
| Fri | **System live** | Both |

---

## 4. Critical path & top risks

The chain that determines whether August 1 holds:

**Wise/Tremendous verification → CRM fields → Agent 5A pass → deploy → integration test → launch**

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Two-week schedule has zero slack | One slipped lane pushes launch | Lanes run in parallel from day one; nothing sequential that can be parallel. Any slip → payments or WordPress polish moves to a fast-follow, core pipeline still launches |
| Wise/Tremendous verification stalls | Blocks payment routing at launch | Open **day one**; launch on PayPal payouts, switch international routing on within days |
| CRM field API names renamed after creation | Silent failures across every agent | Record names exactly; never rename after developers reference them |
| The 3 cross-agent coordination points mismatch | Silent failures, no error thrown | Confirm verbally: (1) ROLE_CATEGORY header (Agents 3↔6), (2) 9 SLA field API names (Agents 4↔5), (3) escalation_timestamp identity (Agents 4↔5) |
| Content gaps not filled before Agent 1D activation | Lead capture can't launch | I draft the two likely-missing lead magnets in Week 1 |
| WordPress change breaks live student site | Affects current students | Only task where conservative approach is non-negotiable — Parmeet present, review first |

---

## 5. Immediate next actions — today (Monday)

All four lanes start today. Nothing waits for a handoff.

1. **Dr. Flippen:** open Wise Business + Tremendous this morning — verification is the only clock we don't control.
2. **Blaine + me:** run the content audit now so I can start drafting the same day.
3. **Me:** begin the missing content and the four Folder 08 files as soon as gaps are confirmed.
4. **Parmeet:** start the CRM field build (Ambassadors/Prospects/Support Tickets) — longest lead item.
5. **Claude Code:** open a session and start Agent 5A immediately.

---

*The single most useful thing I can do right now is start on the content layer — that's the only part of the build that can't be resolved by code or UI configuration, and it gates Agent 1D and Agent 5. Say the word and I'll begin the content audit.*

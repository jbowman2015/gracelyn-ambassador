# Ambassador Scaling Project — Infrastructure Build Runbook

**Owner:** Blaine (executing the Parmeet setup lane)
**Purpose:** Everything you build by hand in the Zoho/tool UIs so Claude Code can write agent functions against fixed, confirmed values.
**Golden rule:** Claude Code writes code against *field API names, folder IDs, form IDs, and environment variables*. Every one of those has to exist and be recorded before the matching function is written. Your job is to make those values real and hand Claude Code a filled-in reference sheet.

---

## How the two roles split

| You (this lane) | Claude Code |
|---|---|
| Create CRM modules, fields, picklists | Writes Catalyst functions that read/write those fields |
| Create WorkDrive folders, record IDs | Writes WorkDrive API calls using those IDs |
| Build Zoho Forms, record form IDs | Writes handlers that parse form submissions |
| Configure Zoho Flows + Make.com scenarios | Writes the Catalyst endpoints the Flows/scenarios call |
| Open accounts, generate credentials, set env vars | Writes auth + API logic assuming env vars exist |
| Run Agent 5A go/no-go gate | Writes Agent 5A, then every other agent |

**The single thing that breaks Claude Code:** renaming a field, folder, or variable after it's been referenced. Record every API name *exactly* as Zoho assigns it, and never rename.

---

## Execution order (respect the dependencies)

1. **Accounts first** — Wise/Tremendous have 1–3 day verification. Start today.
2. **CRM modules + fields** — longest task, blocks almost every agent.
3. **WorkDrive folders** — record IDs; blocks any file-handling agent.
4. **Forms** — reference CRM fields, so build after CRM.
5. **Flows + Make.com** — reference forms and CRM, so build after both.
6. **Catalyst scheduled jobs** — created in the Catalyst project; confirmed by 5A.
7. **Policy env variables** — set before any agent runs live.
8. **Agent 5A validation** — go/no-go gate. Nothing deploys until it passes clean.

---

## Section 0 — Accounts & credentials (DAY ONE, blocking)

Open these before anything else. Wise and Tremendous are the only items with an external clock.

| Tool | Setup required | Catalyst variables to capture |
|---|---|---|
| **Wise Business** ⏰ | Open at wise.com/business, fund initial balance, enable API. **Blocking for international payments.** | `WISE_API_TOKEN`, `WISE_PROFILE_ID` |
| **Tremendous** ⏰ | Open at tremendous.com, free/pay-as-you-go, enable API. **Blocking for international fallback.** | `TREMENDOUS_API_KEY`, `TREMENDOUS_FUNDING_SOURCE_ID` |
| **PayPal Business** | Confirm active; enable Payouts API. | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Zoho One | Confirm Catalyst, WorkDrive, CRM, Mail, Forms, Flow, Analytics, Books all active under one org. | — |
| Zoho Books | Confirm bank account connected for ACH; enable ACH outgoing. | `ZOHO_BOOKS_ORGANIZATION_ID`, `ZOHO_BOOKS_CLIENT_ID`, `ZOHO_BOOKS_CLIENT_SECRET`, `ZOHO_BOOKS_REFRESH_TOKEN` |
| Ayrshare | Connect LinkedIn, Facebook, Instagram; confirm posting permissions. | `AYRSHARE_API_KEY` |
| OpenAI | Confirm assistant ID; decide extend vs. new assistant for Agent 5. | `OPENAI_API_KEY`, `OPENAI_ASSISTANT_ID` |
| HeyGen | Business plan; API access; Dr. Flippen avatar ID. | `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `HEYGEN_TEMPLATE_ID` |
| Anthropic | API key for all Claude calls across agents. | `ANTHROPIC_API_KEY` |
| Meta Ads | Business Manager connected; Agent 1C access. | `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| Google Ads | API access; daily spend checkpoint. | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN` |
| Make.com | Workspace created; all tool connections configured. | credentials live in Make.com connection settings |

You also need the Zoho OAuth trio for CRM, Mail, WorkDrive, and Forms (`*_CLIENT_ID`, `*_CLIENT_SECRET`, `*_REFRESH_TOKEN` each), plus WordPress: `WORDPRESS_API_BASE_URL`, `WP_ADMIN_USER`, `WP_ADMIN_APP_PASSWORD` (application password, not login password), `AMBASSADOR_PORTAL_URL`, `AMBASSADOR_PORTAL_CHAT_URL`.

---

## Section 1 — Zoho CRM (the long one)

Three modules to build or extend. **Record every API name exactly as Zoho assigns it.** Zoho sometimes appends numbers or changes casing — the recorded value is the source of truth, not what you typed.

### 1.1 Ambassadors module — extend existing

Confirm existing fields are intact (First_Name, Last_Name, Email, Phone, State, Ambassador_Type, Organization_Name, Referral_Code, Referral_Link, Recruiting_Link, Ambassador_Status, Agreement_Signed, Ethics_Acknowledged, Training_Complete, Compliance_Complete, WordPress_User_ID, Recruited_By_Ambassador_ID, Total_Referrals_Submitted), then add all new fields below:

| Field name | API name | Type | Notes |
|---|---|---|---|
| Recruiting Source | `Recruiting_Source` | Picklist | Agent 1A, Agent 1B, Agent 1C, Agent 1D |
| Recruiting Channel | `Recruiting_Channel` | Text | Specific channel within sub-agent |
| VIP Flag | `VIP_Flag` | Checkbox | Set by Agent 0 on VIP Prospect conversion |
| VIP Prospect Origin | `VIP_Prospect_Origin` | Checkbox | Always routes to human review |
| Motivation Tag | `Motivation_Tag` | Picklist | Professional Growth, Mission Impact, Kingdom Calling, Problem Solver, Community Recognition, Unknown |
| Motivation Discovery Response | `Motivation_Discovery_Response` | Long Text | Raw text from compliance form questions |
| Ambassador Role Category | `Ambassador_Role_Category` | Picklist | K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Mission Aligned Influencer, Gracelyn Community |
| Audience Track | `Audience_Track` | Picklist | K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown |
| Last Engagement Date | `Last_Engagement_Date` | Date | Updated by Agent 3 each weekly touchpoint |
| Engagement Track | `Engagement_Track` | Picklist | Standard, Alternative, Dormant |
| Alternative Track Entry Date | `Alternative_Track_Entry_Date` | Date | |
| Alternative Track Month | `Alternative_Track_Month` | Number | Content rotation counter |
| Days Since Last Referral | `Days_Since_Last_Referral` | Number | Auto-calculated daily |
| Content Week Position | `Content_Week_Position` | Number | 1–4, four-week calendar position |
| Last Story File Used | `Last_Story_File_Used` | Text | Prevents consecutive repeats |
| Re Engagement Attempt | `Re_Engagement_Attempt` | Number | 0, 1, 2 |
| Escalated To Human | `Escalated_To_Human` | Checkbox | Set at dormant day 60 |
| VIP Score | `VIP_Score` | Number | 0–100, quarterly |
| VIP Tier | `VIP_Tier` | Picklist | Not VIP, Standard VIP, High VIP |
| VIP Tier Previous | `VIP_Tier_Previous` | Picklist | Prior quarter tier |
| VIP Tier Upgrade Date | `VIP_Tier_Upgrade_Date` | Date | |
| Win Back Sent | `Win_Back_Sent` | Checkbox | Prevents duplicate sends |
| Win Back Survey Response | `Win_Back_Survey_Response` | Picklist | Too Busy, Confused, Not Sure, Technical Problem, No Response |
| Win Back Response Date | `Win_Back_Response_Date` | Date | |
| Dormant Compliance | `Dormant_Compliance` | Checkbox | Set at day 75 |
| Auto Approved | `Auto_Approved` | Checkbox | Phase 2 auto-approve |
| Auto Approve Timestamp | `Auto_Approve_Timestamp` | DateTime | |
| Auto Approve Criteria Version | `Auto_Approve_Criteria_Version` | Text | Audit trail |
| Last Compliance Form Version | `Last_Compliance_Form_Version` | Text | Value: Combined_v2.0 |
| Country of Residence | `Country_of_Residence` | Picklist (country list) | Drives payment options shown |
| Payment Method Preference | `Payment_Method_Preference` | Picklist | PayPal, ACH, Wise, Tremendous |
| PayPal Email | `PayPal_Email` | Email | If preference = PayPal |
| Bank Account Routing | `Bank_Account_Routing` | **Encrypted Text** | ACH only. **Must be encrypted field type.** |
| Bank Account Number | `Bank_Account_Number` | **Encrypted Text** | ACH only. **Must be encrypted field type.** |
| Wise Email or Account | `Wise_Email_or_Account` | Text | If preference = Wise |
| Tremendous Email | `Tremendous_Email` | Email | If preference = Tremendous |
| Payment Info Complete | `Payment_Info_Complete` | Checkbox | Referral link withheld until true |
| HeyGen Job ID | `VIP_HeyGen_Job_ID` | Text | Used by Make.com polling |
| VIP Relationship Manager Email | `VIP_Relationship_Manager` | Text | |
| Approval Date | `Approval_Date` | Date | Compliance reminder clock starts here |
| Last Reminder Sent Date | `Last_Reminder_Sent_Date` | Date | |

⚠️ **`Bank_Account_Routing` and `Bank_Account_Number` must be created as Zoho *encrypted* field types**, not standard text. This can't be retrofitted cleanly — set it at creation.

### 1.2 Prospects module — new module, 20 fields

Create before Agent 0 development begins.

| Field name | API name | Type | Notes |
|---|---|---|---|
| First Name | `First_Name` | Text | |
| Email | `Email` | Email | Dedup key |
| Social Profile URL | `Social_Profile_URL` | URL | Primary dedup key |
| Role Category | `Role_Category` | Picklist | K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Mission Aligned Influencer, Gracelyn Community |
| Audience Track | `Audience_Track` | Picklist | K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown |
| Organization | `Organization` | Text | |
| Channel Source | `Channel_Source` | Text | Where prospect was found |
| Outreach Status | `Outreach_Status` | Picklist | Identified, Outreach Sent, Applied, Converted, Declined |
| Contact Found | `Contact_Found` | Checkbox | |
| Gap Type | `Gap_Type` | Picklist | No Email, No Public Profile, Parse Error, Low Mission Alignment |
| Motivation Tag | `Motivation_Tag` | Picklist | Same values as Ambassador Motivation Tag |
| Mission Alignment Score | `Mission_Alignment_Score` | Number | 0–30 |
| Org Influence Score | `Org_Influence_Score` | Number | 0–30 |
| VIP Prospect | `VIP_Prospect` | Checkbox | True if score ≥ 60 |
| VIP Prospect Score | `VIP_Prospect_Score` | Number | Total across three dimensions |
| VIP Prospect Pipeline Stage | `VIP_Prospect_Pipeline_Stage` | Picklist | Warm Follow, Personal Outreach, Ambassador Invitation, VIP Onboarding, Declined, Inactive |
| Prospect Declined Date | `Prospect_Declined_Date` | Date | 12-month re-approach suppression |
| Lead Magnets Downloaded | `Lead_Magnets_Downloaded` | Long Text | Comma-separated lead_magnet_id list |
| UTM Source | `UTM_Source` | Text | From form hidden field |
| UTM Campaign | `UTM_Campaign` | Text | From form hidden field |

### 1.3 Support Tickets module — new module, 12 fields

⚠️ **These field API names must be confirmed identically between the Agent 4 and Agent 5 Claude Code sessions before either writes CRM logic.** A mismatch breaks SLA tracking silently — no error is thrown.

| Field name | API name | Type | Written by |
|---|---|---|---|
| Ambassador ID | `Ambassador_ID` | Lookup | — |
| Question Text | `Question_Text` | Long Text | Agent 5 |
| Ticket Tier | `Ticket_Tier` | Picklist | Agent 5 — Tier 1, Tier 2, Tier 3, VIP Priority |
| Issue Category | `Issue_Category` | Picklist | Agent 5 — Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other |
| Ambassador VIP Status | `Ambassador_VIP_Status` | Checkbox | Agent 5 |
| Resolution Complexity | `Resolution_Complexity` | Picklist | Agent 5 — Simple, Moderate, Complex |
| Resolution Status | `Resolution_Status` | Picklist | Agent 5 — Resolved, Escalated, Failed |
| Escalation Timestamp | `Escalation_Timestamp` | DateTime | Agent 5 — **must match webhook payload string exactly** |
| First Response Timestamp | `First_Response_Timestamp` | DateTime | Agent 5 / coordinator |
| Resolution Timestamp | `Resolution_Timestamp` | DateTime | Agent 5 / coordinator |
| SLA Breached | `SLA_Breached` | Checkbox | **Agent 4 only** — Agent 5 never writes this |
| Resolution SLA Breached | `Resolution_SLA_Breached` | Checkbox | **Agent 4 only** |

### 1.4 Other module API names to confirm/record

These are referenced by env variables even where the module already exists. Record the exact API name for each: `AMBASSADORS_MODULE_API_NAME`, `REFERRALS_MODULE_API_NAME` (renamed from Commissions), `ACTIVITY_LOG_MODULE_API_NAME` (new), `PROSPECTS_MODULE_API_NAME` (new), `SUPPORT_TICKETS_MODULE_API_NAME` (new), `AD_CAMPAIGN_LOG_MODULE_API_NAME` (new, Agent 1C), `SOCIAL_POST_LOG_MODULE_API_NAME` (new, Agent 1B), `PARA_DB_MODULE_NAME`, `STUDENT_ALUMNI_MODULE`.

---

## Section 2 — WorkDrive folders

Create all folders, then **record each Folder ID** into the env table (`WORKDRIVE_FOLDER_01_ID` … `WORKDRIVE_FOLDER_09_ID`). Developers can't write a single WorkDrive call without these.

| Folder | Contents | Access |
|---|---|---|
| 01 — Applications | Application submissions archive | Agent 2 reads |
| 02 — Approved Social Content | Prescribed posts (_POSTED suffix after use) | Agent 1B reads/marks |
| 03 — Ambassador Welcome Kits | Standard + VIP kits | Agent 2 reads, makes 30-day links |
| 04 — Content Calendar Assets | Reserved | — |
| 05 — Story Files | Success stories | Agent 6 writes, Agent 3 reads by Role_Category |
| 06 — Lead Magnets | Gated resources; **4 subfolders required** | Agent 1D reads |
| 06 / k12-educator | ID prefix `lm_k12_` | Agent 1D |
| 06 / early-childhood | ID prefix `lm_ec_` | Agent 1D |
| 06 / faith-community | ID prefix `lm_faith_` | Agent 1D |
| 06 / youth-serving | ID prefix `lm_youth_` | Agent 1D |
| 07 — Analytics and Reports | Gap reports, checkpoints | Agent 0/4 write |
| 08 — Brand Assets | Voice/copy/program files | All agents read |
| 09 — VIP Prospect Briefings | One per VIP Prospect | Agent 0 writes, Agent 1B reads, VIP manager gets link |

⚠️ Every Folder 05 story file needs a `ROLE_CATEGORY` header as its **second line**. Agent 6 writes it; Agent 3 parses it. Confirm the exact label between the Agent 3 and Agent 6 sessions (coordination point #1 below).

---

## Section 3 — Zoho Forms (8)

Build after CRM so field names line up. **Record each form ID.** Field-level specs live in the Agent 2 and Agent 1D documents — hand those to Claude Code so it matches its parsing to your field names.

1. **Ambassador Application Form** (extend existing) — add `Country_of_Residence` country picker, `Payment_Method_Preference` dropdown (conditional on country), conditional PayPal/Bank/Wise/Tremendous fields, and a `Recruited_By` hidden field for attribution.
2. **Combined Ambassador Compliance Form** ⭐ (new, replaces 3 sequential docs) — three scrollable sections (Part 1 Agreement, Part 2 Ethics, Part 3 Training Guide), a separate e-signature capture after each part, two open-text motivation-discovery questions before the Part 3 signature, single Submit. Content comes from Ambassador Agreement v2.0.
3. **Win-Back Survey Form** ⭐ (new) — one question, four radio options (A Too busy, B Confused, C Not sure, D Technical problem). Linked from the Day 15 email; response fires a Make.com route.
4. **Story Content Intake Form** (new) — batch, up to 5 stories. Per slot: Title, Role Category dropdown (K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any), Target Week date, Content. Submitter name/email at top; slots 2–5 optional.
5–8. **Four Lead Capture Forms** (new, one per track) — First Name, Email, Role Category (pre-set per track), State, plus hidden `lead_magnet_id`, `utm_source`, `utm_campaign`. Each pre-sets its track and its lead_magnet_id: k12-educator, early-childhood, faith-community, youth-serving.

Capture into env: `AMBASSADOR_FORM_ID`, `AMBASSADOR_FORM_BASE_URL`, `LEAD_CAPTURE_FORM_IDS`, and `LEAD_MAGNET_MAP` (maps each lead_magnet_id → WorkDrive file path).

---

## Section 4 — Zoho Flows (10)

Build after Forms + CRM. Each fires a Make.com webhook into a Catalyst function Claude Code writes — so the webhook URLs (`MAKE_*_WEBHOOK_URL`) need to exist as env vars.

| Flow | Trigger | Action |
|---|---|---|
| Application to CRM | New application form submission | Create Ambassador record, write all fields, fire Agent 2 webhook |
| Status Approved Trigger | `Ambassador_Status` → Approved | Fire Agent 2 approval webhook |
| Compliance Complete Trigger | `Compliance_Complete` = true | Fire Agent 2 activation webhook |
| Referral Stage Change Trigger | Referral Stage changes | Fire Agent 3 referral notification |
| Fraud Flag Trigger | `Disqualification_Flag` = true | Fire Agent 4 escalation queue |
| VIP Flag Trigger | `VIP_Flag` = true on Prospect | Fire coordinator dashboard notification |
| Story Intake Processing ⭐ | New story intake submission | Build header (STORY TITLE, ROLE_CATEGORY, TARGET WEEK, SUBMITTED BY, SUBMITTED AT), generate `Story_YYYY-MM-DD_title.txt`, save to Folder 05, email submitter |
| Auto-Approve Threshold Alert ⭐ | Catalyst daily count webhook | Alert at 800 (approaching) and 1,000 (threshold). **Never flips APPROVAL_MODE** |
| VIP Recalculation Complete ⭐ | Agent 3 completion webhook | Signal Agent 4 to run tier audit |
| Win-Back Survey Response ⭐ | New win-back survey submission | Write `Win_Back_Survey_Response` + `Win_Back_Response_Date`, route to correct path |

---

## Section 5 — Catalyst scheduled jobs (14)

Create all in the Gracelyn Ambassador Catalyst project. Agent 5A confirms each fires on schedule. (All times CST.)

| Job | Schedule | Function |
|---|---|---|
| Agent 0 Weekly Run | Sun 11:00 PM | Profile prospects, score VIP, generate briefings, fire recruiting webhook |
| Agent 1C Kill Switch Check | Daily 10:00 AM | Pause ads if daily spend not confirmed |
| Agent 2 Daily Compliance Check | Daily 8:30 AM | Reminders; win-back at Day 15; dormant at Day 75 |
| Agent 3 Weekly Engagement Cycle | Mon 9:00 AM | Weekly to Standard (batched), bi-weekly Alternative, monthly Dormant |
| Agent 3 Daily Milestone Detection | Daily 7:00 AM | Referral stage changes → milestone emails + HeyGen |
| Agent 3 Daily Dormant Detection | Daily 7:30 AM | Re-engagement sequences past threshold |
| Agent 3 Monthly Non-Referral Check ⭐ | 1st Mon 6:00 AM | 90+ days, zero referrals → Alternative track |
| Agent 3 Monthly VIP Recalculation ⭐ | 1st Mon 6:30 AM | Score all, apply dynamic tiers, fire recalc webhook |
| Agent 3 Monthly VIP Supplemental ⭐ | 1st Mon 7:00 AM | VIP check-ins; High VIP outreach list as CRM tasks |
| Agent 4 Daily Jobs | Daily 6:00 AM | Fraud, eligibility, SLA monitoring, daily checkpoint |
| Agent 4 Weekly Report | Mon 6:00 AM | Referral fee report + SLA weekly summary |
| Agent 4 Post-Recalculation Audit ⭐ | After 1st Mon 7:30 AM | Six VIP tier count audit checks |
| Agent 6 Buffer Monitoring | Daily 5:30 AM | Count unused story files by category, alert if low |
| Auto-Approve Threshold Check ⭐ | Daily w/ Agent 2 | Alert at 800 and 1,000; never flip APPROVAL_MODE |

---

## Section 6 — Policy thresholds → env variables (20)

Dr. Flippen confirms these; developers may not set defaults. The five most sensitive are starred — get those confirmed first.

| Decision | Value | Env variable |
|---|---|---|
| Ad spend daily threshold | Dr. Flippen sets | `AGENT1C_DAILY_SPEND_THRESHOLD` |
| Agent 5A min credential count to pass | Developer sets | — |
| APPROVAL_MODE initial ⭐ | MANUAL (flip to AUTO at 1,000) | `APPROVAL_MODE` |
| Approaching-threshold alert count | 800 | `ACTIVE_AMBASSADOR_THRESHOLD_ALERT` |
| Auto-approve threshold ⭐ | 1,000 | `ACTIVE_AMBASSADOR_THRESHOLD_AUTO` |
| Non-referral track entry ⭐ | 90 days | `NON_REFERRAL_DAYS_THRESHOLD` |
| Dormant detection ⭐ | 30 days | `DORMANT_DAYS_THRESHOLD` |
| VIP High % (pop < 10k) | 2.5% | `VIP_HIGH_PCT_SMALL` |
| VIP Standard % (pop < 10k) | 5% | `VIP_STD_PCT_SMALL` |
| VIP High % (pop ≥ 10k) | 0.5% | `VIP_HIGH_PCT_LARGE` |
| VIP Standard % (pop ≥ 10k) | 2.5% | `VIP_STD_PCT_LARGE` |
| VIP population threshold | 10,000 | `VIP_POPULATION_THRESHOLD` |
| VIP audit tolerance | 10% | `VIP_AUDIT_TOLERANCE_PCT` |
| Story buffer minimum | 4 | `STORY_BUFFER_MINIMUM` |
| Weekly batch size | 100 | `WEEKLY_BATCH_SIZE` |
| Mission keywords ⭐ | Parmeet/Dr. Flippen define | `MISSION_KEYWORDS` |
| SLA Tier 2 first response | 24 hrs | `SLA_TIER2_FIRST_RESPONSE_HOURS` |
| SLA Tier 3/VIP first response | 4 hrs | `SLA_VIP_FIRST_RESPONSE_HOURS` |
| SLA Tier 2 resolution | 72 hrs | `SLA_TIER2_RESOLUTION_HOURS` |
| SLA Tier 3/VIP resolution | 24 hrs | `SLA_VIP_RESOLUTION_HOURS` |

---

## Section 7 — Make.com, WordPress, OpenAI KB

- **Make.com scenarios** — build from the specs I'll produce; they cover real-time form submission, Agent 1A handoff, nightly cleanup (2:00 AM CST recovery of missed submissions), error alert routing, HeyGen polling, and payment routing. Each maps to a `MAKE_*_WEBHOOK_URL` env var.
- **WordPress** — Claude Code produces the role types, referral dashboard display logic, and portal chat widget embed. **Do not apply to the live site without a scheduled session** — it hosts current students. Review the diff together, then apply.
- **OpenAI knowledge base** — load the reformatted Agent 5 KB (8 topic areas: referral mechanics, fees, compliance, portal navigation, international payment, program rules, etc.). I produce the formatted text in the content lane; you load it into the assistant.

---

## Section 8 — Three silent-failure coordination points

These fail with no error. Confirm each verbally between the relevant Claude Code sessions before either side writes CRM logic:

1. **ROLE_CATEGORY header** — Agent 3 and Agent 6 must use the identical label, as the second line of every story file. Agent 3's `parseRoleCategory()` regex is case-sensitive.
2. **Nine Support Tickets SLA field API names** — Agent 4 and Agent 5 must use the exact same names.
3. **escalation_timestamp** — the ISO string in Agent 5's webhook payload must equal `Escalation_Timestamp` in the CRM ticket exactly; Agent 4's SLA math depends on the match.

---

## Section 9 — Handing off to Claude Code

For each agent, start a Claude Code session and give it three things:

1. **The agent's project document** (e.g. `Gracelyn_Agent_2_Onboarding_v2`) — this is the spec; its output must match it exactly.
2. **Your filled-in reference sheet** — confirmed CRM field API names, folder IDs, form IDs, and the env variable list from Sections 1–6.
3. **The relevant coordination points** from Section 8 if the agent touches stories, SLA fields, or escalation.

**Build order** (matches dependency + the kickoff):
1. **Agent 5A** first — the validation gate; it tells you exactly which variable is missing before anything deploys.
2. **Agent 0** second — the intelligence layer everything else reads.
3. **Agents 1A–1D** in parallel — recruiting.
4. **Agents 2, 3, 4, 5, 6** — onboarding through engagement and oversight.

**Review loop:** when Claude Code produces a function file, check it against the agent document before deploying. If a live call errors, paste the full error log back into the same session — it will identify the cause and produce the fix.

**Deploy gate:** nothing goes to production until **Agent 5A returns a clean pass** on every credential and environment variable.

---

## Your immediate checklist (today)

- [ ] Open Wise Business + Tremendous; confirm PayPal Payouts enabled
- [ ] Start the Ambassadors module field build (longest task)
- [ ] Create the Prospects and Support Tickets modules
- [ ] Get Dr. Flippen to confirm the five starred policy values
- [ ] Open a Claude Code session and point it at Agent 5A with the (partial) reference sheet
- [ ] Keep one master reference doc: field API names, folder IDs, form IDs, env vars — this is what every Claude Code session reads from

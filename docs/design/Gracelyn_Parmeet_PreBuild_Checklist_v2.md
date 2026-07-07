**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

**Parmeet Pre-Build Checklist**

*Version 2.0 — May 2026*

All items must be complete before any developer writes production code.

**Rows highlighted in green are NEW in v2.0.**

# **1. Zoho CRM Setup**

| **STOP** No developer writes a single line of code until all CRM modules, fields, and picklist values are confirmed. Developers reference field API names constantly throughout their builds. Errors here propagate into every agent. |
| --- |

## **1.1 Ambassadors Module — Field Checklist**

Confirm all existing fields are intact and all new fields are created with the exact API names shown. Green rows are new in v2.0.

|  | **Field Name** | **API Name** | **Type** | **Notes** |
| --- | --- | --- | --- | --- |
|  | First Name | First_Name | Text | Existing |
|  | Last Name | Last_Name | Text | Existing |
|  | Email | Email | Email | Existing. Deduplication key. |
|  | Phone | Phone | Phone | Existing |
|  | State | State | Text | Existing |
|  | Ambassador Type | Ambassador_Type | Picklist | Existing. Values: Individual, Organization |
|  | Organization Name | Organization_Name | Text | Existing. Conditional on Ambassador Type. |
|  | Referral Code | Referral_Code | Text | Existing. Unique. Immutable after creation. |
|  | Referral Link | Referral_Link | URL | Existing. Format: gracelyn.edu/apply?ref={code} |
|  | Recruiting Link | Recruiting_Link | URL | Existing. Format: gracelyn.edu/ambassador?recruit={code} |
|  | Ambassador Status | Ambassador_Status | Picklist | Existing. Values: Applicant, Approved, Active, Suspended, Terminated |
|  | Agreement Signed | Agreement_Signed | Checkbox | Existing. Compliance gate 1. |
|  | Ethics Acknowledged | Ethics_Acknowledged | Checkbox | Existing. Compliance gate 2. |
|  | Training Complete | Training_Complete | Checkbox | Existing. Compliance gate 3. |
|  | Compliance Complete | Compliance_Complete | Formula/Checkbox | Existing. True when all three gates complete. |
|  | WordPress User ID | WordPress_User_ID | Text | Existing. Portal mapping. |
|  | Recruited By Ambassador ID | Recruited_By_Ambassador_ID | Lookup | Existing. Links to recruiting ambassador record. |
|  | Total Referrals Submitted | Total_Referrals_Submitted | Number | Existing. Auto-calculated from Referrals module. |
| NEW | Recruiting Source | Recruiting_Source | Picklist | Values: Agent 1A, Agent 1B, Agent 1C, Agent 1D |
| NEW | Recruiting Channel | Recruiting_Channel | Text | Specific channel within sub-agent |
| NEW | VIP Flag | VIP_Flag | Checkbox | Set by Agent 0 when VIP Prospect converts |
| NEW | VIP Prospect Origin | VIP_Prospect_Origin | Checkbox | Set by Agent 0 for VIP Pipeline converts. Always routes to human review. |
| NEW | Motivation Tag | Motivation_Tag | Picklist | Values: Professional Growth, Mission Impact, Kingdom Calling, Problem Solver, Community Recognition, Unknown |
| NEW | Motivation Discovery Response | Motivation_Discovery_Response | Long Text | Raw text from compliance form motivation questions |
| NEW | Ambassador Role Category | Ambassador_Role_Category | Picklist | Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Mission Aligned Influencer, Gracelyn Community |
| NEW | Audience Track | Audience_Track | Picklist | Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown. Set from lead magnet track at Agent 1D. |
| NEW | Last Engagement Date | Last_Engagement_Date | Date | Updated by Agent 3 after each weekly touchpoint. |
| NEW | Engagement Track | Engagement_Track | Picklist | Values: Standard, Alternative, Dormant. Set by Agent 3. |
| NEW | Alternative Track Entry Date | Alternative_Track_Entry_Date | Date | Written by Agent 3 when moved to Alternative track. |
| NEW | Alternative Track Month | Alternative_Track_Month | Number | Count of months in Alternative track. Used for content type rotation. |
| NEW | Days Since Last Referral | Days_Since_Last_Referral | Number | Auto-calculated daily. Difference from most recent referral submission. |
| NEW | Content Week Position | Content_Week_Position | Number | Values 1-4. Current position in four-week content calendar. |
| NEW | Last Story File Used | Last_Story_File_Used | Text | Filename of most recent story used in Week 2 email. Prevents consecutive repeats. |
| NEW | Re Engagement Attempt | Re_Engagement_Attempt | Number | Count of re-engagement emails sent (0, 1, 2). Set by Agent 3. |
| NEW | Escalated To Human | Escalated_To_Human | Checkbox | Set by Agent 3 when dormant ambassador reaches day 60. |
| NEW | VIP Score | VIP_Score | Number | 0-100. Calculated quarterly by Agent 3 VIP recalculation job. |
| NEW | VIP Tier | VIP_Tier | Picklist | Values: Not VIP, Standard VIP, High VIP. Written quarterly by Agent 3. |
| NEW | VIP Tier Previous | VIP_Tier_Previous | Picklist | Stores tier from prior quarter before recalculation. Used to detect upgrades. |
| NEW | VIP Tier Upgrade Date | VIP_Tier_Upgrade_Date | Date | Written when ambassador is upgraded to a higher VIP tier. |
| NEW | Win Back Sent | Win_Back_Sent | Checkbox | Set when Day 15 win-back email is sent. Prevents duplicate sends. |
| NEW | Win Back Survey Response | Win_Back_Survey_Response | Picklist | Values: Too Busy, Confused, Not Sure, Technical Problem, No Response. |
| NEW | Win Back Response Date | Win_Back_Response_Date | Date | Timestamp when win-back survey response received. |
| NEW | Dormant Compliance | Dormant_Compliance | Checkbox | Set at Day 75 with no compliance completion. Email drops to monthly. |
| NEW | Auto Approved | Auto_Approved | Checkbox | True if Phase 2 auto-approve system approved this application. |
| NEW | Auto Approve Timestamp | Auto_Approve_Timestamp | DateTime | Written when auto-approve fires. |
| NEW | Auto Approve Criteria Version | Auto_Approve_Criteria_Version | Text | Version string of auto-approve criteria applied. Audit trail. |
| NEW | Last Compliance Form Version | Last_Compliance_Form_Version | Text | Written at compliance completion. Value: Combined_v2.0. Audit trail. |
| NEW | Country of Residence | Country_of_Residence | Picklist (country list) | Collected on application form. Determines payment method options shown at onboarding. |
| NEW | Payment Method Preference | Payment_Method_Preference | Picklist | Values: PayPal, ACH, Wise, Tremendous. Set by ambassador during onboarding. |
| NEW | PayPal Email | PayPal_Email | Email | Collected if Payment_Method_Preference = PayPal. |
| NEW | Bank Account Routing | Bank_Account_Routing | Encrypted Text | Collected if Payment_Method_Preference = ACH. US ambassadors only. Stored encrypted. |
| NEW | Bank Account Number | Bank_Account_Number | Encrypted Text | Collected if Payment_Method_Preference = ACH. Stored encrypted. |
| NEW | Wise Email or Account | Wise_Email_or_Account | Text | Collected if Payment_Method_Preference = Wise. |
| NEW | Tremendous Email | Tremendous_Email | Email | Collected if Payment_Method_Preference = Tremendous. |
| NEW | Payment Info Complete | Payment_Info_Complete | Checkbox | Set to true when all required payment fields are provided. Referral link withheld until true. |
| NEW | HeyGen Job ID | VIP_HeyGen_Job_ID | Text | Written by Agent 2 when HeyGen video job submitted. Used by Make.com polling scenario. |
| NEW | VIP Relationship Manager Email | VIP_Relationship_Manager | Text | Name or email of assigned VIP relationship manager. |
| NEW | Approval Date | Approval_Date | Date | Written by Agent 2 when Status = Approved. Compliance reminder clock starts here. |
| NEW | Last Reminder Sent Date | Last_Reminder_Sent_Date | Date | Updated each time Email C compliance reminder is sent. |

| **NOTE** Payment fields (Country_of_Residence through Payment_Info_Complete) are new in v2.0 for international payment support. Encrypted fields (Bank_Account_Routing, Bank_Account_Number) must be configured as encrypted field types in Zoho CRM — not standard text fields. |
| --- |

## **1.2 Prospects Module — Full New Module**

This entire module is new. All fields are new. Create the module and all fields before Agent 0 development begins.

|  | **Field Name** | **API Name** | **Type** | **Notes** |
| --- | --- | --- | --- | --- |
| NEW | First Name | First_Name | Text |  |
| NEW | Email | Email | Email | Deduplication key. Social_Profile_URL is secondary dedup key. |
| NEW | Social Profile URL | Social_Profile_URL | URL | Primary dedup key for Agent 0 prospect records. |
| NEW | Role Category | Role_Category | Picklist | Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Mission Aligned Influencer, Gracelyn Community |
| NEW | Audience Track | Audience_Track | Picklist | Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown |
| NEW | Organization | Organization | Text |  |
| NEW | Channel Source | Channel_Source | Text | Community or platform where prospect was found. |
| NEW | Outreach Status | Outreach_Status | Picklist | Values: Identified, Outreach Sent, Applied, Converted, Declined |
| NEW | Contact Found | Contact_Found | Checkbox | True if email or contact info was found by Agent 0. |
| NEW | Gap Type | Gap_Type | Picklist | Values: No Email, No Public Profile, Parse Error, Low Mission Alignment |
| NEW | Motivation Tag | Motivation_Tag | Picklist | Same values as Ambassador Motivation Tag. |
| NEW | Mission Alignment Score | Mission_Alignment_Score | Number | 0-30. Set by Agent 0 Claude assessment. |
| NEW | Org Influence Score | Org_Influence_Score | Number | 0-30. Set by Agent 0 Claude assessment. |
| NEW | VIP Prospect | VIP_Prospect | Checkbox | True if Agent 0 VIP Prospect score is 60 or above. |
| NEW | VIP Prospect Score | VIP_Prospect_Score | Number | Total score across three dimensions. Set by Agent 0. |
| NEW | VIP Prospect Pipeline Stage | VIP_Prospect_Pipeline_Stage | Picklist | Values: Warm Follow, Personal Outreach, Ambassador Invitation, VIP Onboarding, Declined, Inactive |
| NEW | Prospect Declined Date | Prospect_Declined_Date | Date | Written when coordinator marks prospect as Declined. 12-month re-approach suppression. |
| NEW | Lead Magnets Downloaded | Lead_Magnets_Downloaded | Long Text | Comma-separated list of lead_magnet_id values downloaded. |
| NEW | UTM Source | UTM_Source | Text | From form hidden field. |
| NEW | UTM Campaign | UTM_Campaign | Text | From form hidden field. |

## **1.3 Support Tickets Module — Full New Module**

This entire module is new. All fields are new. Critical: field names must be confirmed between Agent 4 developer and Agent 5 developer before either builds CRM write logic. A mismatch silently breaks SLA tracking.

|  | **Field Name** | **API Name** | **Type** | **Notes** |
| --- | --- | --- | --- | --- |
| NEW | Ambassador ID | Ambassador_ID | Lookup | Links to Ambassador CRM record. |
| NEW | Question Text | Question_Text | Long Text | Full text of ambassador's question. |
| NEW | Ticket Tier | Ticket_Tier | Picklist | Values: Tier 1, Tier 2, Tier 3, VIP Priority. Written by Agent 5. |
| NEW | Issue Category | Issue_Category | Picklist | Values: Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other. |
| NEW | Ambassador VIP Status | Ambassador_VIP_Status | Checkbox | True if ambassador VIP_Flag = true. Written by Agent 5. |
| NEW | Resolution Complexity | Resolution_Complexity | Picklist | Values: Simple, Moderate, Complex. Written by Agent 5. |
| NEW | Resolution Status | Resolution_Status | Picklist | Values: Resolved, Escalated, Failed. Written by Agent 5. |
| NEW | Escalation Timestamp | Escalation_Timestamp | DateTime | Written by Agent 5 when ticket is escalated. Agent 4 uses for SLA calculation. Must match webhook payload exactly. |
| NEW | First Response Timestamp | First_Response_Timestamp | DateTime | Written when first human response is sent. Agent 4 reads for time-to-first-response SLA. |
| NEW | Resolution Timestamp | Resolution_Timestamp | DateTime | Written when ticket is resolved. Agent 4 reads for time-to-resolution SLA. |
| NEW | SLA Breached | SLA_Breached | Checkbox | Written by Agent 4 only. Never written by Agent 5. |
| NEW | Resolution SLA Breached | Resolution_SLA_Breached | Checkbox | Written by Agent 4 only. Never written by Agent 5. |

| **SLA_Breached and Resolution_SLA_Breached are written exclusively by Agent 4. Agent 5 must never write these fields. Confirm this boundary with both developers at the kickoff meeting.** |
| --- |

## **1.4 Activity Log Module — Existing**

Confirm Ambassador Activity Log module exists with fields: Ambassador_ID, Action_Type, Email_Theme, Email_Subject, Sent_At, Opened_At, Clicked_At, Referral_Count_At_Send, Engagement_Streak, Re_Engagement_Attempt, Escalated_To_Human. All existing from v1.

# **2. Zoho WorkDrive Setup**

Create all folders listed below. Note the four new Folder 06 subfolders required for lead magnet audience tracks. Record each Folder ID in the environment variable table — developers need these IDs before they can write any WorkDrive API call.

|  | **Folder** | **Contents** | **Agent Access** |
| --- | --- | --- | --- |
|  | 01 — Applications | Ambassador application form submissions archive | Agent 2 reads |
|  | 02 — Approved Social Content | Prescribed posts ready for Ayrshare posting. _POSTED suffix after use. | Agent 1B reads and marks |
|  | 03 — Ambassador Welcome Kits | Standard and VIP welcome kit files for Agent 2 delivery | Agent 2 reads, generates 30-day share links |
|  | 04 — Content Calendar Assets | Reserved for future content calendar assets |  |
|  | 05 — Story Files | Student success stories. Agent 6 writes. Agent 3 reads for Week 2 emails. | Agent 6 writes (named files). Agent 3 reads by Role_Category. |
|  | 06 — Lead Magnets | Gated resources by audience track. Four subfolders required. | Agent 1D reads, generates share links |
| NEW | 06 / k12-educator | K12 Educator lead magnet files. ID prefix: lm_k12_ | Agent 1D reads |
| NEW | 06 / early-childhood | Early Childhood lead magnet files. ID prefix: lm_ec_ | Agent 1D reads |
| NEW | 06 / faith-community | Faith Community lead magnet files. ID prefix: lm_faith_ | Agent 1D reads |
| NEW | 06 / youth-serving | Youth Serving Professional lead magnet files. ID prefix: lm_youth_ | Agent 1D reads |
|  | 07 — Analytics and Reports | Agent 0 gap reports, Agent 4 coordinator checkpoint files | Agent 0 writes, Agent 1B reads, Agent 4 writes |
|  | 08 — Brand Assets | Voice guidelines, copy rules, program descriptions, mission statement | All agents read |
| NEW | 09 — VIP Prospect Briefings | Agent 0 VIP Prospect briefing documents. One per VIP Prospect. | Agent 0 writes. Agent 1B reads (read only). VIP Relationship Manager receives link. |

| **NOTE** Folder 05 story files must include a ROLE_CATEGORY header line as the second line of every file. Agent 6 writes this automatically. Agent 3 reads it with parseRoleCategory(). Confirm the exact label format between Agent 3 and Agent 6 developers at kickoff. |
| --- |

# **3. Tool Accounts**

| **BLOCKING: Wise Business and Tremendous** Wise Business and Tremendous accounts must be opened and API credentials obtained before payment routing development can begin. Both accounts require business verification (1-3 days). Open them immediately — do not wait until other setup is complete. |
| --- |

|  | **Tool** | **Setup Required** | **Catalyst Variable Name** |
| --- | --- | --- | --- |
|  | Zoho One | Confirm Zoho Catalyst, WorkDrive, CRM, Mail, Forms, Flow, Analytics, Books all active under one org. | N/A |
|  | Ayrshare | Connect LinkedIn, Facebook, Instagram. Confirm all posting permissions active. | AYRSHARE_API_KEY |
|  | OpenAI | Confirm existing assistant ID. Determine whether Agent 5 extends same assistant or creates new. | OPENAI_API_KEY, OPENAI_ASSISTANT_ID |
|  | HeyGen | Business plan. API access confirmed. Dr. Flippen avatar ID available. | HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_TEMPLATE_ID |
|  | Anthropic (Claude) | API key for all Claude API calls across all agents. | ANTHROPIC_API_KEY |
| NEW | Wise Business | Open Wise Business account at wise.com/business. Fund initial balance. Enable API access. BLOCKING for international payments. | WISE_API_TOKEN, WISE_PROFILE_ID |
| NEW | Tremendous | Open Tremendous account at tremendous.com. Free to open, pay-as-you-go. Enable API. BLOCKING for international fallback payments. | TREMENDOUS_API_KEY, TREMENDOUS_FUNDING_SOURCE_ID |
|  | PayPal Business | Confirm PayPal Business account active. Enable PayPal Payouts API for outgoing payments. | PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET |
|  | Zoho Books | Confirm bank account connected for ACH. ACH outgoing payments enabled. | ZOHO_BOOKS_ORGANIZATION_ID, ZOHO_BOOKS_CLIENT_ID, ZOHO_BOOKS_CLIENT_SECRET, ZOHO_BOOKS_REFRESH_TOKEN |
|  | Meta Ads | Business Manager connected. Agent 1C API access configured. | META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, META_AD_ACCOUNT_ID |
|  | Google Ads | API access configured. Daily spend checkpoint active. | GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN |
|  | Make.com | Workspace created. All tool connections configured. | N/A — credentials stored in Make.com connection settings |

# **4. Zoho Forms**

Eight forms are required. The combined compliance form and win-back survey form are the most critical new additions — Agent 2 cannot function without them. Record each form ID in the environment variable table.

|  | **Form** | **Key Fields and Notes** |
| --- | --- | --- |
|  | Ambassador Application Form | All existing fields. NEW: Country_of_Residence country picker. NEW: Payment_Method_Preference dropdown (conditional on country). NEW: PayPal Email, Bank Routing, Bank Account Number, Wise Email, Tremendous Email (conditional on payment method). NEW: Recruited_By hidden field for recruiting attribution. |
| NEW | Combined Ambassador Compliance Form | Replaces three sequential documents. Three scrollable sections: Part 1 Ambassador Agreement, Part 2 Code of Ethics, Part 3 Training Guide Acknowledgment. Three separate e-signature capture areas after each part. Motivation discovery questions (two open-text) before Part 3 signature. One Submit button. All captured in single submission. |
| NEW | Win-Back Survey Form | One-question form with four radio button options: (A) Too busy right now, (B) Confused about what to do, (C) Not sure I want to participate, (D) I had a technical problem. Ambassador-facing. Linked from Day 15 win-back email. Response fires Make.com routing scenario. |
| NEW | Story Content Intake Form | Batch submission form. Fields repeated for Stories 1-5: Title (short text), Role Category (dropdown: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any), Target Week (date picker), Content (long text). Submitter Name and Email at top. All story slots 2-5 optional. Submitter receives confirmation email listing saved filenames. |
| NEW | Lead Capture Form — K12 Educator | Landing page form. Fields: First Name, Email, Role Category (pre-set K12 Educator), State, lead_magnet_id (hidden), utm_source (hidden), utm_campaign (hidden). Triggers Agent 1D. |
| NEW | Lead Capture Form — Early Childhood | Same structure as K12 form. Role Category pre-set to Early Childhood. lead_magnet_id hidden field set to appropriate EC resource. |
| NEW | Lead Capture Form — Faith Community | Same structure. Role Category pre-set to Faith Community. lead_magnet_id set to faith resource. |
| NEW | Lead Capture Form — Youth Serving Professional | Same structure. Role Category pre-set to Youth Serving Professional. lead_magnet_id set to youth resource. |

| **NOTE** The combined compliance form (Part 1 + Part 2 + Part 3 with three signature blocks) replaces the three sequential compliance documents from v1. The form content comes from the Ambassador Agreement v2.0 document. Parmeet builds the form; the developer confirms field names match Agent 2's spec. |
| --- |

# **5. Lead Magnet Content (WorkDrive Folder 06)**

Minimum one resource per audience track must exist in Folder 06 before Agent 1D is activated. These are content files created by Parmeet — not code. The developer builds the delivery and routing logic; Parmeet provides the content.

| **Audience Track** | **Minimum Content Required** | **File Naming Convention** |
| --- | --- | --- |
| K12 Educator (06/k12-educator/) | At least one PD guide or classroom tool. Suggested: a practical classroom resource relevant to current educators. | lm_k12_[resource-slug].pdf Example: lm_k12_overwhelmed-teacher-selfcare.pdf |
| Early Childhood (06/early-childhood/) | At least one childcare-relevant resource. Suggested: developmental milestone tool or recognition guide for childcare workers. | lm_ec_[resource-slug].pdf |
| Faith Community (06/faith-community/) | At least one children's ministry or educator-believer resource. Suggested: volunteer training outline or faith educator devotional. | lm_faith_[resource-slug].pdf |
| Youth Serving Professional (06/youth-serving/) | At least one youth program planning or child advocacy guide. | lm_youth_[resource-slug].pdf |

| **Content Readiness Gate** Agent 1D cannot be activated until at least one lead magnet file exists in each of the four Folder 06 subfolders AND the LEAD_MAGNET_MAP environment variable is populated with the correct lead_magnet_id to file path mappings. This is a content creation task — budget time for it. |
| --- |

# **6. Zoho Flow Configurations**

Ten Flows are required. The four new Flows handle the story intake processing (Agent 6), auto-approve threshold alerts, VIP recalculation completion signaling, and win-back survey routing.

|  | **Flow Name** | **Trigger** | **Action** |
| --- | --- | --- | --- |
|  | Application to CRM | Zoho Forms: new ambassador application | Create Ambassador CRM record. Write all fields. Fire Make.com webhook to Agent 2. |
|  | Status Approved Trigger | CRM: Ambassador_Status changes to Approved | Fire Make.com webhook to Agent 2 approval function. |
|  | Compliance Complete Trigger | CRM: Compliance_Complete = true | Fire Make.com webhook to Agent 2 activation function. |
|  | Referral Stage Change Trigger | CRM: Referral Stage field changes | Fire Make.com webhook to Agent 3 referral notification function. |
|  | Fraud Flag Trigger | CRM: Disqualification_Flag = true | Fire Make.com webhook to Agent 4 escalation queue. |
|  | VIP Flag Trigger | CRM: VIP_Flag = true on Prospect record | Fire Make.com webhook to coordinator dashboard notification. |
| NEW | Story Intake Processing | Zoho Forms: new story intake submission | For each story slot with content: build header with STORY TITLE, ROLE_CATEGORY, TARGET WEEK, SUBMITTED BY, SUBMITTED AT. Generate Story_YYYY-MM-DD_title.txt filename. Save to WorkDrive Folder 05. Send confirmation email to submitter. This is the Agent 6 Zoho Flow. |
| NEW | Auto-Approve Threshold Alert | Catalyst daily check fires webhook on ambassador count | Fire Make.com alert scenario when active count reaches 800 (approaching) or 1,000 (threshold reached). Make.com sends Parmeet email. APPROVAL_MODE is never flipped automatically. |
| NEW | VIP Recalculation Complete | Agent 3 Catalyst function fires webhook on completion | Signals Agent 4 to run VIP tier count audit. Agent 4 Scenario 3 triggers. |
| NEW | Win-Back Survey Response | Zoho Forms: new win-back survey submission | Write Win_Back_Survey_Response and Win_Back_Response_Date to CRM. Fire Make.com scenario to route response to correct path (calendar link, walkthrough video, re-engagement email, or support contact). |

# **7. Catalyst Scheduled Jobs**

Fourteen scheduled Catalyst jobs are required. Six are new in v2.0. All jobs must be created in the Gracelyn Ambassador Catalyst project. Confirm each job fires on its correct schedule during Agent 5A validation.

|  | **Job Name** | **Schedule** | **Function** |
| --- | --- | --- | --- |
|  | Agent 0 Weekly Run | Sunday 11:00 PM CST | Profile prospects, score VIP Prospects, generate briefings, fire recruiting agent webhook. |
|  | Agent 1C Kill Switch Check | Daily 10:00 AM CST | Pause ad campaigns if coordinator has not confirmed daily spend report. |
|  | Agent 2 Daily Compliance Check | Daily 8:30 AM CST | Find approved ambassadors past reminder thresholds. Send reminders. Fire win-back at Day 15. Fire dormant compliance at Day 75. |
|  | Agent 3 Weekly Engagement Cycle | Monday 9:00 AM CST | Send weekly emails to all Standard track ambassadors in concurrent batches. Send bi-weekly to Alternative track. Send monthly to Dormant track. |
|  | Agent 3 Daily Milestone Detection | Daily 7:00 AM CST | Query Referrals module for recent stage changes. Fire milestone emails and HeyGen videos. |
|  | Agent 3 Daily Dormant Detection | Daily 7:30 AM CST | Query ambassadors where Last_Engagement_Date exceeds threshold. Send re-engagement sequences. |
| NEW | Agent 3 Monthly Non-Referral Check | First Monday of month 6:00 AM CST | Query Standard track ambassadors active 90+ days with zero referrals. Move qualifying ambassadors to Alternative track. |
| NEW | Agent 3 Monthly VIP Recalculation | First Monday of month 6:30 AM CST | Score all active ambassadors. Apply dynamic tier thresholds based on population size. Update VIP_Tier. Send tier upgrade welcome messages. Fire VIP recalculation complete webhook. |
| NEW | Agent 3 Monthly VIP Supplemental | First Monday of month 7:00 AM CST | Send automated check-in to all Standard VIP and High VIP ambassadors. Build High VIP personal outreach list as CRM tasks for relationship manager. |
|  | Agent 4 Daily Jobs | Daily 6:00 AM CST | Fraud flag check, eligibility queue check, SLA monitoring, daily checkpoint delivery. |
|  | Agent 4 Weekly Report | Monday 6:00 AM CST | Generate referral fee report and SLA weekly summary. |
| NEW | Agent 4 Post-Recalculation Audit | After first Monday of month 7:30 AM CST | Triggered by VIP recalculation complete webhook. Run six VIP tier count audit checks. Alert Parmeet on anomalies. |
|  | Agent 6 Buffer Monitoring | Daily 5:30 AM CST | Count unused story files in Folder 05 by role category. Alert Parmeet if total or any category below minimum. |
| NEW | Auto-Approve Threshold Check | Daily with other Agent 2 jobs | Count active ambassadors. Send approaching-threshold alert at 800. Send threshold-reached alert at 1,000. Never flip APPROVAL_MODE automatically. |

# **8. Policy Decisions and Thresholds**

All policy decisions must be confirmed by Dr. Flippen and Parmeet before development begins. Developers cannot set default values for policy decisions — these must come from program leadership. Twenty decisions are required in v2.0.

|  | **Decision** | **Confirmed Value** | **Environment Variable** |
| --- | --- | --- | --- |
|  | Ad spend daily threshold (Meta + Google combined) | Dr. Flippen sets | AGENT1C_DAILY_SPEND_THRESHOLD |
|  | Agent 5A go/no-go: minimum credential count to pass | Developer sets | N/A |
| NEW | APPROVAL_MODE initial value | MANUAL — flip to AUTO when active ambassadors reach 1,000 | APPROVAL_MODE |
| NEW | Auto-approve approaching-threshold alert count | 800 | ACTIVE_AMBASSADOR_THRESHOLD_ALERT |
| NEW | Auto-approve threshold count (Phase 2 trigger) | 1,000 | ACTIVE_AMBASSADOR_THRESHOLD_AUTO |
| NEW | Non-referral track entry threshold (days active with zero referrals) | 90 days | NON_REFERRAL_DAYS_THRESHOLD |
| NEW | Dormant detection threshold (days since last engagement) | 30 days | DORMANT_DAYS_THRESHOLD |
| NEW | VIP score — population under 10,000: High VIP percentage | 2.5% | VIP_HIGH_PCT_SMALL |
| NEW | VIP score — population under 10,000: Standard VIP percentage | 5% | VIP_STD_PCT_SMALL |
| NEW | VIP score — population 10,000 or above: High VIP percentage | 0.5% | VIP_HIGH_PCT_LARGE |
| NEW | VIP score — population 10,000 or above: Standard VIP percentage | 2.5% | VIP_STD_PCT_LARGE |
| NEW | VIP population threshold (triggers shift to large-population bands) | 10,000 | VIP_POPULATION_THRESHOLD |
| NEW | VIP audit tolerance (% deviation before anomaly alert) | 10% | VIP_AUDIT_TOLERANCE_PCT |
| NEW | Story buffer minimum (total files before alert) | 4 | STORY_BUFFER_MINIMUM |
| NEW | Weekly batch size for Agent 3 concurrent processing | 100 per batch | WEEKLY_BATCH_SIZE |
| NEW | Mission keywords for Agent 1B warm follow alert matching | Parmeet defines initial list | MISSION_KEYWORDS |
| NEW | SLA: Tier 2 first response target (hours) | 24 | SLA_TIER2_FIRST_RESPONSE_HOURS |
| NEW | SLA: Tier 3 / VIP first response target (hours) | 4 | SLA_VIP_FIRST_RESPONSE_HOURS |
| NEW | SLA: Tier 2 resolution target (hours) | 72 | SLA_TIER2_RESOLUTION_HOURS |
| NEW | SLA: Tier 3 / VIP resolution target (hours) | 24 | SLA_VIP_RESOLUTION_HOURS |

| **NOTE** The APPROVAL_MODE variable is the most operationally sensitive. It controls whether applications are manually reviewed or auto-approved. It starts as MANUAL. Parmeet flips it to AUTO when active ambassadors reach 1,000. The developer should brief Parmeet on exactly what this flip does before handoff. |
| --- |

# **9. Human Role Assignments**

All human roles must be filled before the program launches. The Ambassador Support Coordinator and VIP Relationship Manager are blocking for Agent 5 escalation routing and Agent 3 VIP outreach respectively.

|  | **Role** | **Person Assigned** | **Responsibilities** |
| --- | --- | --- | --- |
|  | Human Coordinator (Parmeet) | Parmeet Kaur | Daily checkpoint review, application approvals (Phase 1), payment queue confirmation, escalation queue resolution. |
|  | Ambassador Support Coordinator | TBD before launch | Handles all Agent 5 Tier 2+ escalations. Dedicated to ambassador support only — not shared with general admissions. 24-hour SLA. |
|  | VIP Relationship Manager | TBD before launch | Manages VIP Prospect Pipeline stages. Cultivates influencer and advocate prospects. Monthly High VIP personal outreach list. Personal contact for VIP ambassador onboarding. |
|  | Dr. Flippen | Dr. Flippen | Approves all HeyGen video scripts before submission. Reviews content at launch. Personal contact with top ambassadors. |
| NEW | International Payment Handler | Parmeet initially | Reviews payment failures for Wise and Tremendous. Contacts ambassadors with failed international payments. Offers alternative methods. |

# **10. Brand Asset Files (WorkDrive Folder 08)**

Four plain text files must be uploaded to Folder 08 before any content-generating agent is activated. Three are existing from v1. One is new in v2.0.

|  | **File Name** | **Used By** | **Content** |
| --- | --- | --- | --- |
|  | ambassador_voice_guidelines.txt | Agents 0, 1A, 1B, 1C, 1D, 2, 3, 5, 6 | Gracelyn voice: warm, mission-first, authoritative. No em dashes. Never say commission. Always say referral fee. Mission before fee in all messaging. |
|  | ambassador_copy_rules.txt | Agents 1B, 1D, 3, 5 | Specific copy rules for ambassador-facing content. Tone, prohibited phrases, required disclosures. |
|  | ambassador_program_descriptions.txt | Agent 5 | Program descriptions for the support knowledge base. Accurate details about degree programs, tuition, accreditation. |
| NEW | update_brief.txt | Agent 3 | Week 4 Program Update content brief. Parmeet updates this file before each Week 4 cycle. Agent 3 reads it for the Program Update email. If not found, Agent 3 generates a forward-looking mission message. |

# **11. Pre-Build Architect Kickoff Meeting**

All eleven developers must attend the kickoff meeting before any production code is written. The meeting cannot happen until this entire checklist is complete. At the meeting, each developer confirms the items in the table below.

| **Critical Cross-Agent Coordination Items** Three coordination points must be verbally confirmed between developers at kickoff — not just in documents: (1) Agent 3 and Agent 6 must agree on the exact ROLE_CATEGORY header line format and label. (2) Agent 4 and Agent 5 must agree on the exact names of all nine Support Tickets SLA fields. (3) Agent 4 and Agent 5 must confirm that escalation_timestamp in the webhook payload matches Escalation_Timestamp in CRM exactly. Mismatches in any of these three produce silent failures. |
| --- |

|  | **Developer** | **Must Confirm Before Leaving the Meeting** |
| --- | --- | --- |
| [ ] | Agent 0: Research and Intelligence | Has read Agent 0 v2.0 document. Understands VIP Prospect scoring across three dimensions. Knows briefing document format and Folder 09 write requirement. Understands MISSION_KEYWORDS env variable purpose. Has confirmed Agent 3 ROLE_CATEGORY values to align on story tagging. |
| [ ] | Agent 1A: Database and Email Agent | Has read Agent 1A document. Understands Audience_Track field in handoff payload from Agent 1D. Knows not to start email sequence for a prospect already in one. |
| [ ] | Agent 1B: Social Outreach Agent | Has read Agent 1B v2.0 document. Understands VIP Prospect suppression rule — never automated outreach to VIP_Prospect = true. Knows warm follow alert delivers as CRM task not email. Has read Folder 09 format from Agent 0 developer. |
| [ ] | Agent 1C: Paid Advertising Agent | Has read Agent 1C document. Kill switch is the first thing built and tested. Daily spend checkpoint confirmed. |
| [ ] | Agent 1D: Lead Capture Agent | Has read Agent 1D v2.0 document. Knows four lead capture forms required (one per audience track). Understands Audience_Track routing from lead_magnet_id prefix. Confirms Folder 06 subfolder structure with Parmeet. |
| [ ] | Agent 2: Onboarding Agent | Has read Agent 2 v2.0 document. Understands combined compliance form structure (three parts, three signature blocks). Knows APPROVAL_MODE env variable behavior — never auto-flipped. Understands win-back sequence routing. Has confirmed WordPress application password approach. |
| [ ] | Agent 3: Engagement Agent | Has read Agent 3 v2.0 document. Understands getMostRecentStoryByCategory() ROLE_CATEGORY header format — confirm with Agent 6 developer. Knows three engagement tracks and entry criteria. Understands quarterly VIP recalculation and dynamic tier thresholds. Batch concurrency approach confirmed. |
| [ ] | Agent 4: Compliance Oversight Layer | Has read Agent 4 v2.0 document. Knows nine SLA fields in Support Tickets module — confirm field names with Agent 5 developer. Understands VIP recalculation audit trigger from Agent 3 webhook. Has confirmed Zoho Analytics dashboard API access with Parmeet. |
| [ ] | Agent 5: Ambassador Support Agent | Has read Agent 5 v2.0 document. Understands ten-field escalation webhook payload — escalation_timestamp must match CRM field exactly. Knows nine SLA fields Agent 5 writes — confirm field names with Agent 4 developer. Has confirmed OpenAI assistant configuration with Parmeet. Knows Agent 5 never writes SLA_Breached. |
| [ ] | Agent 5A: Setup Validation Agent | Has read Agent 5A document. Understands it runs before any other developer starts. Has Catalyst CLI access. Has confirmed Make.com manual trigger scenario approach. |
| [ ] | Agent 6: Story Content Intake Agent | Has read Agent 6 v2.0 document. Has confirmed ROLE_CATEGORY header line format with Agent 3 developer. ROLE_CATEGORY must be second line in header. Knows five valid Role Category values. Confirms WORKDRIVE_FOLDER_05_ID matches Agent 3's value. |

# **Pre-Build Sign-Off**

| **STOP** Do not allow any developer to write production code until every section below is marked complete, dated, and initialed by Parmeet. Incomplete setup creates blocked developers, integration failures, and wasted build budget. |
| --- |

| **Section** | **All Items Complete?** | **Date Completed** | **Initials** |
| --- | --- | --- | --- |
| 1. Zoho CRM Setup — Ambassador Module | [ ] Yes |  |  |
| 2. Zoho CRM Setup — Prospects Module (NEW) | [ ] Yes |  |  |
| 3. Zoho CRM Setup — Support Tickets Module (NEW) | [ ] Yes |  |  |
| 4. Zoho WorkDrive — Folders and Subfolders | [ ] Yes |  |  |
| 5. Tool Accounts — Including Wise and Tremendous (NEW) | [ ] Yes |  |  |
| 6. Zoho Forms — All Eight Forms | [ ] Yes |  |  |
| 7. Zoho Flows — All Ten Flows | [ ] Yes |  |  |
| 8. Catalyst Scheduled Jobs | [ ] Yes |  |  |
| 9. Policy Decisions and Thresholds — All 20 Confirmed | [ ] Yes |  |  |
| 10. Human Role Assignments | [ ] Yes |  |  |
| 11. Brand Asset Files — Folder 08 | [ ] Yes |  |  |
| 12. Lead Magnet Content — Folder 06 (NEW) | [ ] Yes |  |  |
| 13. Pre-Build Architect Kickoff Meeting | [ ] Yes |  |  |

Parmeet signature confirming all sections complete:

_______________________________________________________   Date: ____________________

Dr. Flippen sign-off on policy decisions and thresholds (Section 8):

_______________________________________________________   Date: ____________________

| **NOTE** After sign-off, distribute this completed checklist to all developers at the kickoff meeting. Every developer should have a copy with all module API names, folder IDs, and form IDs filled in. Without confirmed values in hand, the kickoff meeting produces ambiguity rather than alignment. |
| --- |
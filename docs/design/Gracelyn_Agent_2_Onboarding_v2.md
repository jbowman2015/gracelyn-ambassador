**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 2 of 9

**Onboarding Agent**

*Application processing, approval routing, combined compliance form,*

*win-back sequence, Phase 2 auto-approve, and VIP onboarding track*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store all credentials as Zoho Catalyst environment variables. No credential is hardcoded.

| **HARD STOP** Do not begin development until Parmeet has provided all credentials listed below AND confirmed that the combined compliance form (Zoho Forms) and the win-back survey form are built and accessible. Agent 2 cannot function without both forms. Development is blocked on credential delivery and form readiness. |
| --- |

| **NOTE** Read the existing Ambassador Program Implementation Blueprint Sections 5.2 through 5.8 before writing any code. Agent 2 builds on top of existing CRM logic, WordPress provisioning, and compliance gate workflows. Understanding what already exists prevents duplicate builds and broken integrations. |
| --- |

| **Tool** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.ALL | Read and write Ambassador records. Update compliance fields, VIP fields, status transitions, and auto-approve eligibility fields. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Send all onboarding emails from ambassadors@gracelyn.edu. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ | Read brand assets from Folder 08. Read welcome kit files from Folder 03. Generate 30-day share links. | Parmeet |
| Zoho Flow | API key or OAuth token | Trigger notification flows for compliance completion and VIP events. | Parmeet |
| WordPress REST API | Application password generated for the wp-agent2 user in WordPress admin | Use application password in HTTP Basic Auth header. Do not use login password. Upgrade user roles on compliance completion. | Parmeet |
| HeyGen API | API key | Submit personalized video jobs for VIP ambassadors. Poll for completion via Make.com. | Parmeet |
| Claude API (Anthropic) | API key. Model: claude-sonnet-4-20250514 | Motivation classification on activation. VIP personalization paragraph generation. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build all seven Agent 2 scenarios including compliance reminders, win-back routing, and HeyGen polling. | Parmeet |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 2 moves an approved ambassador from application submission to active status. It routes each applicant to the Standard or VIP track, manages the combined three-part compliance form and all associated reminders, runs the win-back sequence for ambassadors who do not complete compliance, and activates successful ambassadors into the engagement cycle.

Version 2.0 introduces four major changes from the prior version: (1) the three sequential compliance documents are replaced by a single combined form with three signature capture areas; (2) a win-back sequence replaces silence after day 14 with a genuinely different offer and one-tap survey routing; (3) Phase 2 auto-approve logic is built in and controlled by an environment variable flip at the 1,000 active ambassador threshold; and (4) VIP_Prospect_Origin ambassadors always route to human review regardless of approval mode.

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Make.com: Zoho Forms webhook | Application submission fires real-time webhook to Agent 2. |
| TRIGGERED BY | Make.com: Zoho Flow on Status = Approved | Admin approval or Phase 2 auto-approve status change fires Agent 2 approval sequence. |
| TRIGGERED BY | Catalyst daily scheduled job | 8:30 AM CST daily compliance check finds ambassadors past reminder thresholds. |
| TRIGGERED BY | Make.com: Zoho Flow on Compliance_Complete = true | Compliance completion fires Agent 2 activation sequence. |
| TRIGGERED BY | Make.com: Day 15 win-back schedule | Ambassadors with no compliance completion at day 15 enter the win-back sequence. |
| READS FROM | Zoho CRM: Ambassadors module | All ambassador data: status, VIP flags, compliance fields, approval timestamps, reminder history. |
| READS FROM | WorkDrive Folder 03 | Welcome kit files: approved social content, mission story assets, program descriptions. |
| READS FROM | WorkDrive Folder 08 | Brand asset files: copy rules and voice guidelines for personalization. |
| WRITES TO | Zoho CRM: Ambassadors module | Status transitions, compliance timestamps, motivation classification, win-back status, auto-approve audit fields. |
| WRITES TO | Zoho Mail | All onboarding and compliance emails: A, B, C, C-WinBack, D, and VIP variants. |
| WRITES TO | WordPress | User role upgrades on compliance completion. |
| FEEDS INTO | Agent 3 | Activation webhook with ambassador role category, motivation tag, VIP flag, and audience track. |
| FEEDS INTO | Human coordinator | Approval queue notifications, win-back survey responses, auto-approve threshold alerts. |
| FEEDS INTO | VIP Relationship Manager | VIP approval notification with briefing document link and HeyGen video delivery. |

## **2.3 Run Cycle**

| **Trigger** | **Source** | **Timing** | **Function** |
| --- | --- | --- | --- |
| Application submitted | Make.com: Zoho Forms webhook | Real-time | Send Email A. Add to coordinator approval queue. Update Prospect record status. |
| Status = Approved | Make.com: Zoho Flow trigger | Real-time | Phase 1: add to human approval queue. Phase 2: run auto-approve criteria check. Send Email B (standard) or Email B-VIP. Start compliance reminder schedule. |
| Daily compliance check | Catalyst scheduled job 8:30 AM CST | Daily | Find approved ambassadors past day 2, 7, or 14 thresholds with incomplete compliance. Send Email C. Find ambassadors past day 14 with no completion — trigger win-back sequence. |
| Win-back survey response | Make.com: Zoho Forms webhook | Real-time | Route response to correct path: calendar link, walkthrough video, re-engagement email, or support contact. |
| Compliance_Complete = true | Make.com: Zoho Flow trigger | Real-time | Send Email D. Deliver welcome kit. Classify motivation. Notify Agent 3. Notify VIP manager if applicable. Upgrade WordPress role. |
| Active ambassador count reaches 800 | Catalyst daily check | Daily | Send Parmeet alert: auto-approve threshold approaching. Action required before count reaches 1,000. |
| Active ambassador count reaches 1,000 | Catalyst daily check | Daily | Send Parmeet alert: Phase 2 auto-approve threshold reached. Coordinator decision required to flip APPROVAL_MODE environment variable. |

## **2.4 What Agent 2 Does Not Do**

- Generate or modify referral codes or referral links. These are generated by the existing CRM workflow on admin approval.

- Send weekly engagement emails. Agent 3 owns ongoing ambassador engagement from activation forward.

- Manage compliance gate logic in WordPress. The portal hides the referral link until all three gates are complete. This logic exists in the blueprint. Agent 2 sends the form, reads the completion flags, and triggers activation.

- Contact prospects who have not yet applied. Agents 1A through 1D own recruiting outreach.

- Flip APPROVAL_MODE from MANUAL to AUTO. This is always a human coordinator decision triggered by a Parmeet action on the environment variable. Agent 2 sends the alert; Parmeet makes the change.

# **3. Combined Compliance Form**

Version 2.0 replaces the three sequential compliance documents with a single combined Zoho Form containing all three documents and three separate signature capture areas. The ambassador completes and signs all three sections in one sitting and submits once. This eliminates the multi-step friction that caused compliance attrition in the prior version.

| **Form Build Responsibility** The combined compliance form must be built in Zoho Forms by Parmeet before Agent 2 development begins. The form content comes from the existing Ambassador Agreement, Code of Ethics, and Training Guide documents with appropriate modifications for the combined format. Agent 2 reads the form submission data — it does not build or host the form itself. |
| --- |

| **Form Section** | **Content and Signature Capture** |
| --- | --- |
| Part 1: Ambassador Agreement | Full Ambassador Agreement text presented in scrollable section. Signature Block 1 at the bottom of this section. E-signature capture. Timestamp recorded. Agreement_Signed = true written to CRM on capture. |
| Part 2: Code of Ethics | Full Code of Ethics text presented in scrollable section. Signature Block 2 at the bottom of this section. E-signature capture. Timestamp recorded. Ethics_Acknowledged = true written to CRM on capture. |
| Part 3: Training Guide Acknowledgment | Full Training Guide text presented in scrollable section. Motivation discovery questions presented after Training Guide text (before signature): What drew you to the Gracelyn Ambassador Program? What do you care most about in your work with students or children? Two open-text questions. Responses submitted with signature. Signature Block 3 at the bottom. E-signature capture. Training_Complete = true written to CRM. Motivation_Discovery_Response written to CRM. |
| Single submission | All three sections are presented in one Zoho Form. One Submit button at the end. All three signatures and the motivation discovery responses are captured in a single form submission. No sequential routing between documents. |
| CRM updates on submission | Compliance_Complete = true (set by existing Zoho Flow when all three individual flags are true). Last_Compliance_Form_Version = Combined_v2.0 written to CRM for audit trail. |

## **3.1 Win-Back Alternative Path**

Ambassadors who do not complete the combined form by day 15 receive a different offer: a simplified invitation that acknowledges the barrier and presents four routing options via a one-tap survey. This is not a fifth reminder. It is a genuinely different message that routes each non-completing ambassador to the help they actually need.

| **Day** | **Action** | **Detail** |
| --- | --- | --- |
| Day 2 | Email C — Reminder 1 | Standard compliance reminder. Brief and warm. References the portal link and the three-part combined form. No survey. |
| Day 7 | Email C — Reminder 2 | Second compliance reminder. Notes that completing the form takes approximately 10 minutes. Offers the portal link again. |
| Day 14 | Email C — Reminder 3 | Third and final standard reminder. References that the referral link becomes available as soon as compliance is complete. |
| Day 15 | Win-Back Email + Survey | Different message entirely. Not a fourth reminder. Acknowledges that completing paperwork can be a barrier. Presents the combined form as a simpler path. Includes one-tap survey: Why have you not completed your compliance steps? Options: (A) Too busy right now, (B) Confused about what to do, (C) Not sure I want to participate, (D) I had a technical problem. Survey response routes to one of four paths below. |
| Response A: Too busy | Calendar link path | Reply email sent with a link to schedule a 10-minute guided completion call with the coordinator. Coordinator completes the form with the ambassador live on the call. |
| Response B: Confused | Walkthrough path | Reply email sent with a link to a short screen-recorded walkthrough video showing exactly how to complete the combined form. Video hosted in WorkDrive and linked. |
| Response C: Not sure | Re-engagement path | Reply email sent with a different message: not a compliance push but a mission reconnection. Shares one student success story. Reminds them why they applied. Soft invitation to reconsider. No compliance link in this email. |
| Response D: Technical problem | Support path | Reply email sent with direct support contact information. Coordinator is notified immediately to reach out personally. |
| No survey response by Day 75 | Dormant queue entry | Ambassador added to Dormant_Compliance queue in CRM. Email frequency drops to monthly. One final reactivation email sent at Day 75 with genuinely different framing. No response after Day 75 closes the application record. |

# **4. Phase 2 Auto-Approve**

Phase 1 uses manual coordinator approval for all applications. Phase 2 switches to auto-approve when the active ambassador count reaches 1,000. The switch is controlled by the APPROVAL_MODE environment variable, which Parmeet sets manually. Agent 2 never flips this variable automatically.

| **Coordinator Decision Required** Agent 2 sends an alert when active ambassadors reach 800 (approaching threshold) and 1,000 (threshold reached). The 1,000-ambassador alert requires Parmeet to make an active decision: flip APPROVAL_MODE to AUTO or acknowledge the manual approval load and continue with Phase 1. No automatic mode change occurs. |
| --- |

## **4.1 Auto-Approve Criteria**

All five criteria must pass for auto-approve to fire. Any single failure routes the application to the human exception queue.

| **Criterion** | **Detail** |
| --- | --- |
| Agent 0 fraud flag check | CRM field Fraud_Flag must be false or empty. If Fraud_Flag = true for any reason, application routes to human exception queue regardless of approval mode. |
| Duplicate email check | No existing Ambassador record with the same email address and Status = Active or Approved. Duplicate detected routes to exception queue. |
| Household match check | No existing Ambassador record with the same mailing address. Household match routes to exception queue. |
| Referral code validation | If the application includes a recruiting referral code (Recruited_By field), the code must resolve to a valid active ambassador in CRM. Invalid or expired code routes to exception queue. |
| Application completeness | All required fields present and non-empty: first name, last name, email, state, role category, consent checkbox. Incomplete applications route to exception queue. |
| Auto-approve audit trail | When auto-approve fires, write Auto_Approved = true, Auto_Approve_Timestamp, and Auto_Approve_Criteria_Version to the Ambassador CRM record. Parmeet can query this field to audit any auto-approved ambassador. |

## **4.2 Exception Queue Handling**

| **Exception Type** | **Coordinator Action Required** |
| --- | --- |
| Fraud_Flag = true | Review fraud flag reason in CRM. Determine whether application should be approved, declined, or held. Manual status update required. |
| Duplicate email | Confirm whether this is the same person reapplying (update existing record) or a different person with a shared email (decline and request unique email). |
| Household match | Confirm whether both applicants are eligible independent participants. Review relationship. Manual approval or decline required. |
| Invalid referral code | Confirm whether the recruiting ambassador's code has expired or been deactivated. Correct the Recruited_By field if applicable. Manual approval required. |
| Incomplete application | Contact applicant directly to complete missing fields. Do not approve an incomplete application. |
| VIP_Prospect_Origin = true | Always routes to human review regardless of approval mode. VIP relationships require a personal welcome, not an automated approval. |

# **5. Standard vs VIP Track Comparison**

| **Element** | **Standard Track** | **VIP Track** |
| --- | --- | --- |
| Email B — Approval welcome | Warm, mission-aligned. Introduces portal and compliance steps. | Personalized. Introduces named VIP relationship manager. References their specific work and community. |
| HeyGen video | Not included | Personal video from Dr. Flippen submitted within 24 hours of approval. Delivered when ready. |
| Compliance form | Single combined form: Agreement + Ethics + Training with three separate signature capture areas | Same combined form. Relationship manager available to assist personally. No automated compliance reminders — coordinator manages personally. |
| Compliance reminders | Automated: day 2, day 7, day 14. Win-back if no completion by day 15. | Human coordinator manages. No automated reminders. Relationship manager reaches out personally. |
| Welcome kit | Standard kit from WorkDrive Folder 03 | Customized kit with VIP ambassador letter, co-creation invitation, and dedicated contact information. |
| Activation | Email D with referral link. WordPress role upgrade. Agent 3 notified. | Same Email D. VIP relationship manager also notified with co-creation follow-up prompt. |
| Referral fee | $100 undergraduate, $200 graduate | Identical. No preferential fee structure. |

# **6. Process Functions**

## **6.1 Function A: Application Received**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| A1 | Receive application webhook | Make.com fires webhook on new Zoho Forms submission. Read Ambassador CRM record created by the existing blueprint workflow. Validate that the record exists before proceeding. |
| A2 | Send Email A | Send application received confirmation from ambassadors@gracelyn.edu. Plain text. Personalised with first name. References the review timeline. |
| A3 | Update Prospect record | If the applicant has a Prospect record in CRM (from Agent 1A, 1B, or 1D), update Outreach_Status = Applied. Do not create a duplicate record. |
| A4 | Add to coordinator approval queue | Write to the Coordinator Approval Queue view in CRM. Set Approval_Queue_Added_Date = today. Parmeet reviews this queue daily in Phase 1. |

## **6.2 Function B: Approval and Track Routing**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| B1 | Read approval mode | Check APPROVAL_MODE environment variable. Values: MANUAL (Phase 1) or AUTO (Phase 2). If MANUAL, proceed to B2a. If AUTO, proceed to B2b. |
| B2a | Phase 1: Manual approval | Application is already in the coordinator approval queue from Step A4. Agent 2 takes no action until the coordinator manually sets Status = Approved in CRM. When Status = Approved is detected, proceed to B3. |
| B2b | Phase 2: Auto-approve criteria check | Run all five auto-approve criteria in sequence: (1) Fraud_Flag check, (2) duplicate email check, (3) household match check, (4) referral code validation, (5) application completeness check. If all five pass: set Status = Approved, write Auto_Approved = true, Auto_Approve_Timestamp, Auto_Approve_Criteria_Version to CRM. Proceed to B3. If any criterion fails: route to exception queue. Notify coordinator. Do not approve. |
| B2c | VIP_Prospect_Origin override | Regardless of APPROVAL_MODE, if VIP_Prospect_Origin = true: route to human exception queue for personal review. Never auto-approve a VIP Prospect origin ambassador. |
| B3 | Read VIP_Flag | Check VIP_Flag on the Ambassador CRM record. If true, proceed to VIP track (B4-VIP). If false, proceed to standard track (B4-Standard). |
| B4-Standard | Send Email B (Standard) | Send standard approval welcome email. Introduces portal link, combined compliance form, and referral link availability on completion. Warm and mission-aligned tone. |
| B4-VIP | Send Email B-VIP | Send VIP approval welcome. Introduces named relationship manager. References the ambassador's specific community and work. Submits HeyGen video job. Notifies VIP relationship manager with briefing document link. |
| B5 | Start compliance reminder schedule | Write Approval_Date = today to CRM. Compliance reminder schedule is keyed from this date: Day 2, Day 7, Day 14, Day 15 win-back. |

## **6.3 Function C: Compliance Reminders and Win-Back**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| C1 | Query compliance-incomplete ambassadors | Daily at 8:30 AM CST, query CRM for ambassadors with Status = Approved AND Compliance_Complete = false AND Win_Back_Sent = false. For each record, calculate days since Approval_Date. |
| C2 | Determine reminder tier | For each ambassador: if days_since_approval is between 2 and 6 and Last_Reminder_Sent_Date is null or more than 5 days ago, send Day 2 reminder. If between 7 and 13 and last reminder was more than 5 days ago, send Day 7 reminder. If 14 or more and last reminder was more than 5 days ago and Win_Back_Sent = false, send Day 14 reminder. |
| C3 | Send Email C | Send appropriate compliance reminder email. Update Last_Reminder_Sent_Date = today. Log reminder tier in CRM. |
| C4 | Check for win-back trigger | Separately query ambassadors with Status = Approved AND Compliance_Complete = false AND days_since_approval >= 15 AND Win_Back_Sent = false. For each: send Win-Back Email with one-tap survey. Set Win_Back_Sent = true. Do not send standard compliance reminders to ambassadors with Win_Back_Sent = true. |
| C5 | Route survey responses | When a win-back survey response is received via Make.com webhook: write Win_Back_Survey_Response and Win_Back_Response_Date to CRM. Fire the appropriate response path: calendar link (A), walkthrough video (B), re-engagement email (C), or support contact (D). |
| C6 | Check for dormant compliance | Query ambassadors with Status = Approved AND Compliance_Complete = false AND Win_Back_Sent = true AND days_since_approval >= 75 AND Dormant_Compliance = false. For each: set Dormant_Compliance = true. Send final Day 75 reactivation email. Email frequency drops to monthly for these ambassadors. |

## **6.4 Function D: Activation**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| D1 | Classify motivation | Call Claude API with the Motivation_Discovery_Response field content. Classify into one of six tags: Professional Growth, Mission Impact, Kingdom Calling, Problem Solver, Community Recognition, Unknown. Write Motivation_Tag to CRM. Max tokens: 10. Validate that response is one of the six valid tags before writing. |
| D2 | Generate welcome kit share links | Generate 30-day time-limited share links for all welcome kit files in WorkDrive Folder 03 relevant to this ambassador's Audience_Track. VIP ambassadors receive additional VIP kit files. |
| D3 | Send Email D | Send activation email with referral link, ambassador recruiting link, and welcome kit download links. Plain text. Include program summary: referral fee amounts, 4-month eligibility requirement, and how the portal works. For VIP ambassadors, include named relationship manager contact information. |
| D4 | Upgrade WordPress role | Call WordPress REST API to upgrade the ambassador's user role from ambassador_applicant to ambassador_active. This action makes the referral link visible in the portal. Confirm the role change before proceeding to D5. |
| D5 | Notify Agent 3 | Fire Agent 3 activation webhook with: ambassador_id, email, first_name, role_category, audience_track, motivation_tag, vip_flag, vip_prospect_origin. Agent 3 adds the ambassador to the weekly engagement cycle. |
| D6 | Notify VIP manager (VIP only) | If VIP_Flag = true, fire VIP activation webhook to Make.com. Make.com notifies the VIP relationship manager that the ambassador is now active and ready for co-creation outreach. |
| D7 | Write Last_Compliance_Form_Version | Write Combined_v2.0 to the CRM audit field. Enables future audit of which form version each ambassador completed. |

# **7. Claude API Usage**

## **7.1 Motivation Classification**

| function buildMotivationClassifierPrompt(discoveryResponse) {   return {     system: `Classify the ambassador's motivation from their onboarding responses. Return exactly one of these six tags and nothing else: Professional Growth │ Mission Impact │ Kingdom Calling │ Problem Solver │ Community Recognition │ Unknown No punctuation. No explanation. One tag only.`,     user: discoveryResponse   }; } // Validation after Claude response const VALID_TAGS = [   'Professional Growth', 'Mission Impact', 'Kingdom Calling',   'Problem Solver', 'Community Recognition', 'Unknown' ]; function validateMotivationTag(response) {   const tag = response.trim();   return VALID_TAGS.includes(tag) ? tag : 'Unknown'; } |
| --- |

## **7.2 VIP Personalization Paragraph**

| function buildVIPPersonalizationPrompt(ambassador, voiceGuidelines) {   return {     system: `Write one short paragraph (2-3 sentences) personalizing a VIP welcome email for a Gracelyn ambassador. Reference their specific role and community. Use Gracelyn voice guidelines. No em dashes. No commission. Always say referral fee. VOICE GUIDELINES: ${voiceGuidelines}`,     user:       'Name: ' + ambassador.firstName +       ' │ Role: ' + ambassador.roleCategory +       ' │ Audience: ' + ambassador.audienceTrack +       ' │ Community size: ' + (ambassador.audienceEstimate ││ 'unknown')   }; } |
| --- |

# **8. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Application Received | New Zoho Forms submission detected | Fires Agent 2 Function A Catalyst function. Adds to coordinator approval queue. |
| Scenario 2: Status = Approved | Zoho Flow fires on Status = Approved CRM update | Fires Agent 2 Function B Catalyst function. Reads APPROVAL_MODE and VIP_Flag. Routes accordingly. |
| Scenario 3: Daily Compliance Check | Every day at 8:30 AM CST | Fires Agent 2 Function C Catalyst function. Processes all ambassadors past reminder thresholds. Fires win-back sequence for Day 15 ambassadors. |
| Scenario 4: Win-Back Survey Response | New Zoho Forms win-back survey submission | Receives survey response payload. Writes to CRM. Routes to appropriate response path (calendar, video, re-engagement, or support). |
| Scenario 5: Compliance Complete | Zoho Flow fires on Compliance_Complete = true CRM update | Fires Agent 2 Function D Catalyst function. Sends Email D, delivers welcome kit, upgrades WordPress role, notifies Agent 3. |
| Scenario 6: HeyGen Video Polling | Every 30 minutes after VIP HeyGen job submission | Polls HeyGen API for job completion. When video is ready, delivers VIP video email. If video fails after 4 hours, sends Parmeet alert and fallback VIP email without video. |
| Scenario 7: Auto-Approve Threshold Alerts | Catalyst daily check triggers alert webhook | At 800 active ambassadors: sends approaching-threshold alert to Parmeet. At 1,000 active ambassadors: sends threshold-reached alert requiring coordinator decision on APPROVAL_MODE flip. |

# **9. CRM Fields Written by Agent 2**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| Agreement_Signed | Checkbox + Timestamp | Set by combined compliance form submission. Timestamp written separately. |
| Ethics_Acknowledged | Checkbox + Timestamp | Set by combined compliance form submission. Timestamp written separately. |
| Training_Complete | Checkbox + Timestamp | Set by combined compliance form submission. Timestamp written separately. |
| Compliance_Complete | Checkbox | Set by existing Zoho Flow when all three individual flags are true. Agent 2 reads this field as the activation trigger. |
| Last_Compliance_Form_Version | Text | Written by Agent 2 on compliance completion. Value: Combined_v2.0. Audit trail. |
| Last_Reminder_Sent_Date | Date | Updated each time Email C is sent. Used by daily compliance check to enforce 5-day minimum gap between reminders. |
| Win_Back_Sent | Checkbox | Set when Day 15 win-back email is sent. Prevents duplicate win-back sends. |
| Win_Back_Survey_Response | Picklist | Values: Too Busy, Confused, Not Sure, Technical Problem, No Response. Written when survey response received. |
| Win_Back_Response_Date | Date | Timestamp when survey response was received. |
| Dormant_Compliance | Checkbox | Set when ambassador reaches Day 75 with no compliance completion. Reduces email frequency to monthly. |
| Motivation_Discovery_Response | Long text | Raw text from the two motivation discovery questions in Part 3 of the combined form. |
| Motivation_Tag | Picklist | Classified by Claude from discovery responses. Values: Professional Growth, Mission Impact, Kingdom Calling, Problem Solver, Community Recognition, Unknown. |
| Auto_Approved | Checkbox | True if the application was approved by the Phase 2 auto-approve system. False or empty if manually approved. |
| Auto_Approve_Timestamp | DateTime | Written when auto-approve fires. |
| Auto_Approve_Criteria_Version | Text | Version string of the auto-approve criteria applied. Enables audit if criteria change. |
| VIP_Flag | Checkbox | Set by Agent 0. Read by Agent 2 to determine Standard or VIP track routing. |
| VIP_Prospect_Origin | Checkbox | Set by Agent 0 for prospects who converted through the VIP Prospect Pipeline. Always routes to human review. |
| VIP_HeyGen_Job_ID | Text | Written when HeyGen video job is submitted. Used by Make.com polling scenario. |

# **10. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Token refresh fails | try/catch on token refresh | Halt. Alert Parmeet. Add submission to retry queue. |
| Auto-approve: fraud flag detected | Fraud_Flag = true in CRM | Route to exception queue. Alert coordinator. Do not approve. |
| Auto-approve: duplicate email detected | CRM search returns existing record | Route to exception queue. Alert coordinator with both record IDs. |
| Combined form not submitted after Email B | Compliance_Complete = false at Day 2 check | Email C Day 2 reminder fires per compliance schedule. |
| Win-back survey receives no response by Day 75 | Dormant_Compliance check at Day 75 | Set Dormant_Compliance = true. Send final reactivation email. Monthly contact only thereafter. |
| Claude motivation classification returns invalid tag | Response not in valid tag list | Retry once. If retry invalid, write Motivation_Tag = Unknown. Continue activation. Flag for Parmeet manual review. |
| Welcome kit share link generation fails for one file | WorkDrive API error on share link call | Generate links for all other files. Include fallback text in Email D for the failed file. Alert Parmeet. |
| WordPress role upgrade fails | REST API error or non-200 response | Retry once after 60 seconds. If retry fails: send Parmeet alert. Do not send Email D until role is confirmed upgraded. Referral link must not be shared before portal access is confirmed. |
| Agent 3 activation webhook fails | Make.com returns non-200 | Retry once. If retry fails: alert Parmeet. Ambassador will not enter engagement cycle until resolved. High priority. |
| HeyGen video fails after 4 hours | Make.com polling detects job failure | Send VIP welcome email without video. Alert Parmeet. Notify VIP relationship manager to send a personal video message directly. |
| APPROVAL_MODE is AUTO but coordinator has not confirmed readiness | Active ambassador count reaches 1,000 but APPROVAL_MODE = MANUAL | Send Parmeet alert only. Do not flip APPROVAL_MODE automatically. This is always a human decision. |

# **11. Testing Protocol**

## **11.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Auto-approve: all criteria pass | Set APPROVAL_MODE = AUTO. Submit application with no fraud flags, no duplicates, valid referral code, all fields complete. | Status = Approved. Auto_Approved = true. Auto_Approve_Timestamp written. Email B sent. |
| Auto-approve: fraud flag blocks approval | Set APPROVAL_MODE = AUTO. Set Fraud_Flag = true on test record. | Application routes to exception queue. Auto_Approved remains false. Coordinator alert fires. |
| Auto-approve: duplicate email blocks approval | Set APPROVAL_MODE = AUTO. Pre-create Ambassador record with same email. | Duplicate detected. Routes to exception queue. Alert fires with both record IDs. |
| VIP_Prospect_Origin always routes to human | Set APPROVAL_MODE = AUTO and VIP_Prospect_Origin = true. | Application routes to human review. Auto_Approved = false. No automatic status change. |
| Phase 1 manual: no auto-approve action | Set APPROVAL_MODE = MANUAL. | Agent 2 takes no approval action. Waits for coordinator to manually set Status = Approved. |
| Combined form: all three signatures captured | Submit combined compliance form with all three signature fields completed. | Agreement_Signed, Ethics_Acknowledged, Training_Complete all set to true with timestamps. Compliance_Complete = true triggered by Zoho Flow. |
| Day 2 compliance reminder | Set Approval_Date = 2 days ago. Compliance_Complete = false. Last_Reminder_Sent_Date = null. | Email C Day 2 reminder sent. Last_Reminder_Sent_Date updated to today. |
| Day 14 reminder does not fire if reminder sent within 5 days | Set Approval_Date = 14 days ago. Last_Reminder_Sent_Date = 3 days ago. | No reminder sent. 5-day minimum gap enforced. |
| Win-back fires at Day 15 | Set Approval_Date = 15 days ago. Win_Back_Sent = false. Compliance_Complete = false. | Win-back email with survey sent. Win_Back_Sent = true. Standard reminders suppressed. |
| Win-back response A routes to calendar link | Submit win-back survey with response = Too Busy. | Win_Back_Survey_Response = Too Busy written to CRM. Calendar link email sent. |
| Win-back response C routes to re-engagement | Submit win-back survey with response = Not Sure. | Re-engagement email with success story sent. No compliance link included. |
| Dormant compliance at Day 75 | Set Approval_Date = 75 days ago. Win_Back_Sent = true. Compliance_Complete = false. Dormant_Compliance = false. | Dormant_Compliance = true set. Final reactivation email sent. |
| Motivation classification — valid tag | Submit combined form with discovery responses pointing to mission motivation. | Motivation_Tag = Mission Impact (or similar valid tag) written to CRM. |
| Motivation classification — invalid tag fallback | Simulate Claude returning an unrecognized tag string. | Motivation_Tag = Unknown written to CRM. Parmeet flag written. |
| WordPress role upgrade confirmation | Run Function D with test ambassador. | CRM confirms ambassador_active role set in WordPress before Email D is sent. |
| Auto-approve alert at 800 | Set active ambassador count to 800 in test environment. | Approaching-threshold alert sent to Parmeet. APPROVAL_MODE not changed. |
| Auto-approve alert at 1,000 | Set active ambassador count to 1,000 in test environment. | Threshold-reached alert sent to Parmeet. APPROVAL_MODE not changed automatically. |

## **11.2 Integration Test: Standard Track**

- Submit a test application and confirm Email A arrives within 2 minutes

- In Phase 1 mode: manually set Status = Approved and confirm Email B (standard) fires

- In Phase 2 mode: submit application with all criteria passing and confirm auto-approve fires

- Submit application with Fraud_Flag = true in Phase 2 mode and confirm exception queue routing

- Submit combined compliance form and confirm all three CRM flags set and Compliance_Complete triggers

- Wait for Day 2 check and confirm Email C reminder fires

- Simulate Day 15 without compliance and confirm win-back email with survey fires

- Submit each survey response option and confirm correct routing path

- Complete compliance and confirm Email D, WordPress role upgrade, and Agent 3 webhook all fire in sequence

- Confirm Motivation_Tag written to CRM on activation

## **11.3 Integration Test: VIP Track**

- Create test Ambassador record with VIP_Flag = true

- Set Status = Approved and confirm Email B-VIP fires and HeyGen job is submitted

- Confirm VIP relationship manager notification email sent with briefing document link

- Complete compliance and confirm Email D with VIP relationship manager contact information

- Confirm Agent 3 activation webhook includes VIP_Flag = true in payload

## **11.4 Acceptance Criteria**

- Email A sent within 2 minutes of application submission

- Auto-approve correctly routes applications in Phase 2 mode and all five criteria are enforced

- VIP_Prospect_Origin = true always routes to human review regardless of APPROVAL_MODE

- Combined compliance form submission sets all three CRM flags and Compliance_Complete in one action

- Compliance reminders fire at Day 2, Day 7, and Day 14 with minimum 5-day gap enforced

- Win-back email fires at Day 15 and standard reminders are suppressed thereafter

- All four win-back survey response paths route correctly

- Dormant_Compliance set at Day 75 with no compliance completion

- Email D fires only after WordPress role upgrade is confirmed

- Agent 3 activation webhook includes all required fields: role_category, audience_track, motivation_tag, vip_flag

- Auto-approve threshold alerts fire at 800 and 1,000 active ambassadors without flipping APPROVAL_MODE

- Parmeet confirms APPROVAL_MODE can be flipped without developer assistance

# **12. Integration Notes for Other Developers**

## **12.1 What Agent 3 Developer Needs to Know**

- The Agent 3 activation webhook payload includes: ambassador_id, email, first_name, role_category, audience_track, motivation_tag, vip_flag, vip_prospect_origin. Agent 3 must use all of these fields for content routing. Confirm field names with Agent 2 developer before build.

- Ambassadors with VIP_Prospect_Origin = true do not receive the standard weekly cadence. Agent 3 must check this flag and route accordingly.

## **12.2 What Agent 4 Developer Needs to Know**

- Agent 4 reads Auto_Approved to distinguish manually approved from auto-approved ambassadors in audit reports.

- Fraud_Flag is read by Agent 2 at auto-approve time. Agent 4 monitors and sets fraud flags based on its own logic. Coordinate with Agent 2 developer on the exact field name and values.

## **12.3 What Agent 0 Developer Needs to Know**

- VIP_Flag and VIP_Prospect_Origin are set by Agent 0 before the application is submitted. Agent 2 reads these fields. They must exist in the CRM Ambassador record before Agent 2 is built and tested.

# **13. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token |
| ZOHO_MAIL_CLIENT_ID | Parmeet | OAuth client ID for Zoho Mail |
| ZOHO_MAIL_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Mail |
| ZOHO_MAIL_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Mail |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for WorkDrive |
| WORDPRESS_SITE_URL | Parmeet | Base URL of the Gracelyn WordPress site for REST API calls |
| WORDPRESS_APP_PASSWORD | Parmeet | Application password for wp-agent2 WordPress user. Not a login password. |
| WORDPRESS_APP_USERNAME | Parmeet | Username of the wp-agent2 WordPress user |
| HEYGEN_API_KEY | Parmeet | HeyGen API key for VIP video job submission |
| HEYGEN_TEMPLATE_ID | Parmeet | HeyGen video template ID for Dr. Flippen VIP welcome video |
| ANTHROPIC_API_KEY | Parmeet | Claude API key. Shared across agents. |
| WORKDRIVE_FOLDER_03_ID | Parmeet | WorkDrive Folder 03 ID for welcome kit files |
| WORKDRIVE_FOLDER_08_ID | Parmeet | WorkDrive Folder 08 ID for brand assets |
| AMBASSADORS_MODULE_API_NAME | Parmeet | Exact API name of the Ambassadors module in Zoho CRM |
| APPROVAL_MODE | Parmeet | Values: MANUAL (Phase 1) or AUTO (Phase 2). Parmeet flips this variable when active ambassador count reaches 1,000. Never flipped automatically by the agent. |
| AUTO_APPROVE_CRITERIA_VERSION | Developer | Version string written to CRM for audit. Update when criteria change. Example: v2.0 |
| ACTIVE_AMBASSADOR_THRESHOLD_ALERT | Parmeet | Numeric value at which approaching-threshold alert fires. Default: 800. |
| ACTIVE_AMBASSADOR_THRESHOLD_AUTO | Parmeet | Numeric value at which threshold-reached alert fires. Default: 1000. |
| MAKE_AGENT3_ACTIVATION_WEBHOOK | Developer | Make.com webhook URL to notify Agent 3 of new active ambassador |
| MAKE_VIP_ACTIVATION_WEBHOOK | Developer | Make.com webhook URL for VIP relationship manager activation notification |
| MAKE_WINBACK_SURVEY_WEBHOOK | Developer | Make.com webhook URL for win-back survey response routing |
| MAKE_AGENT2_ERROR_WEBHOOK | Developer | Make.com webhook URL for all Agent 2 error alerts |
| PARMEET_ALERT_EMAIL | Parmeet | Email address for all Agent 2 error and threshold alert notifications |
| VIP_RELATIONSHIP_MANAGER_EMAIL | Parmeet | Email address of the VIP relationship manager |
| COMBINED_FORM_ID | Parmeet | Zoho Forms form ID for the combined compliance form (Agreement + Ethics + Training) |
| WINBACK_SURVEY_FORM_ID | Parmeet | Zoho Forms form ID for the win-back one-tap survey |

| **NOTE** APPROVAL_MODE is the most operationally sensitive environment variable in this agent. It controls Phase 1 vs Phase 2 behavior for every application. Parmeet must understand what flipping this variable does before touching it. Developer should brief Parmeet on the exact behavior change at handoff. |
| --- |
**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 4 of 9

**Compliance Oversight Layer**

*Fraud monitoring, eligibility queue, support SLA tracking,*

*VIP recalculation oversight, daily checkpoint, and weekly reports*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store all credentials as Zoho Catalyst environment variables. No credential is hardcoded.

| **HARD STOP** Do not begin development until Parmeet has confirmed: (1) the Support Tickets CRM module exists with all SLA timestamp fields; (2) the Zoho Analytics coordinator dashboard is built and accessible via API; (3) the Agent 3 VIP recalculation completion webhook URL is confirmed. Development is blocked on these three items. |
| --- |

| **Tool** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.UPDATE | Read Ambassadors, Referrals, Support Tickets, Activity Log, and Ad Campaign Log modules. Write to Escalation Queue and Coordinator Dashboard modules. | Parmeet |
| Zoho Analytics | API key or OAuth token | Write daily checkpoint summaries and weekly reports to the coordinator dashboard. Read SLA metrics for report generation. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Send daily checkpoint email and weekly referral fee report to coordinator. Send SLA breach alerts. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ | Read ambassador_copy_rules.txt from Folder 08 for content compliance audits. | Parmeet |
| Zoho Catalyst | CLI credentials and project access | Full developer access to deploy serverless functions. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build all Agent 4 scenarios: daily checkpoint, weekly report, SLA monitoring, VIP recalculation oversight. | Parmeet |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 4 is the compliance and oversight layer that runs across the entire ambassador program. It monitors what all other agents are doing, reads the outputs of blueprint-built fraud prevention and eligibility systems, tracks support SLA performance, audits VIP tier recalculation results, surfaces issues to the human coordinator, and generates daily and weekly reports. It is the system's immune system.

Version 2.0 adds three new monitoring functions to the original Agent 4: support ticket SLA tracking with breach detection and alerting, quarterly VIP recalculation audit that confirms Agent 3 executed correctly, and an expanded weekly report that includes SLA performance and VIP program health alongside the existing referral fee and system health sections.

| **EXISTING BLUEPRINT — DO NOT REBUILD** Agent 4 reads what the blueprint already built. It does not rebuild fraud detection, eligibility calculation, or data integrity controls. Sections 4.8, 4.10, and 17 of the blueprint define these. Agent 4 reads their CRM field outputs and acts on them. Never duplicate logic that already exists in CRM workflows. |
| --- |

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| READS FROM | Zoho CRM: Ambassadors module | All ambassador records. Checks Disqualification_Flag, Auto_Approved, suspension triggers, and VIP_Tier fields. |
| READS FROM | Zoho CRM: Referrals module | All referral records. Reads blueprint-computed fraud flags. Reads Referral_Stage = Eligible for fee queue. Reads Referral_Fee_Status for payment confirmation. |
| READS FROM | Zoho CRM: Support Tickets module | All support ticket records. Reads Escalation_Timestamp, First_Response_Timestamp, Resolution_Timestamp for SLA tracking. Reads Tier and VIP_Flag fields. |
| READS FROM | Zoho CRM: Activity Log | Escalated_To_Human = true records written by Agent 3 for dormant ambassador escalations. |
| READS FROM | Zoho CRM: Ad Campaign Log | Agent 1C kill switch events and over-threshold spend alerts for daily checkpoint inclusion. |
| READS FROM | WorkDrive Folder 08 | ambassador_copy_rules.txt for content compliance audits of Agent 3 generated emails. |
| WRITES TO | Zoho CRM: Escalation Queue | Fraud flags, SLA breach alerts, dormant escalations, and any item requiring coordinator human judgment. |
| WRITES TO | Zoho Analytics | Daily checkpoint summary and weekly referral fee report for the coordinator dashboard. |
| WRITES TO | Zoho Mail | Daily checkpoint email, weekly report, SLA breach alerts, and VIP recalculation audit confirmation. |
| MONITORS | Agent 3 VIP recalculation | Reads VIP_Tier changes after each quarterly recalculation. Confirms recalculation completed correctly. Alerts Parmeet if anomalies detected. |
| MONITORS | Agent 5 Support Tickets | Tracks SLA metrics for all open and recently closed tickets. Generates weekly SLA report for coordinator. |

## **2.3 Run Cycle**

| **Trigger** | **Source** | **Timing** | **Function** |
| --- | --- | --- | --- |
| Daily fraud flag check | Catalyst scheduled job | Daily 6:00 AM CST | Query CRM for new fraud flags set since last run. Add to escalation queue with context. Alert coordinator. |
| Daily eligibility queue check | Catalyst scheduled job | Daily 6:15 AM CST | Query Referrals module for Stage = Eligible records not yet surfaced to coordinator. Add to payment queue view. |
| Daily SLA monitoring | Catalyst scheduled job | Daily 6:30 AM CST | Query Support Tickets for open tickets past SLA thresholds. Write SLA_Breached = true. Alert coordinator for breaches. |
| Daily checkpoint delivery | Catalyst scheduled job | Daily 7:00 AM CST | Compile all monitored data. Send coordinator checkpoint email. Update Zoho Analytics dashboard. |
| Weekly referral fee report | Catalyst scheduled job | Monday 6:00 AM CST | Generate weekly referral fee report: eligible, pending, paid, and running totals. Send to coordinator. |
| Weekly SLA report | Catalyst scheduled job | Monday 6:15 AM CST | Generate weekly SLA summary: average response time, tickets by tier, breach rate, open ticket age. Include in coordinator weekly email. |
| Post-recalculation audit | Make.com trigger on Agent 3 completion | After first Monday of month 7:30 AM CST | Read VIP_Tier changes from quarterly recalculation. Confirm counts are within expected ranges. Alert Parmeet if anomalies detected. |
| Content compliance audit | Catalyst scheduled job | Weekly Tuesday 8:00 AM CST | Sample Agent 3 generated email content from Activity Log. Check for em dashes and commission language violations. Add violations to escalation queue. |

# **3. Daily Coordinator Checkpoint**

The daily checkpoint is delivered by email to the coordinator at 7:00 AM CST and updated on the Zoho Analytics dashboard simultaneously. It compiles all monitored items from the prior 24 hours into a single actionable summary.

| **Checkpoint Item** | **What Coordinator Reviews** | **Action Available** |
| --- | --- | --- |
| Ad spend alert | Prior day spend vs. approved daily threshold across Meta and Google. Kill switch events from Agent 1C. | Pause campaigns, adjust budget, escalate to Dr. Flippen |
| Fraud flag escalations | New fraud flags detected since last checkpoint: self-referral, household match, duplicate referral, auto-approve anomalies. | Approve, decline, or hold flagged ambassador or referral record |
| Ambassador applications (Phase 1) | New applications awaiting manual approval. | Approve or decline with one-click CRM action |
| Auto-approve exceptions (Phase 2) | Applications routed to exception queue by Agent 2 auto-approve criteria failure. | Review and resolve each exception |
| Referral fee queue | Referrals at 4-month eligibility threshold ready for payment confirmation. | Confirm eligibility and trigger payment via Zoho Books |
| Dormant ambassador escalations | Ambassadors escalated by Agent 3 after two failed re-engagement attempts. | Attempt personal outreach or move to Suspended status |
| SLA breach alerts | Support tickets open past 24-hour first response SLA or 72-hour resolution SLA. | Assign to available coordinator or escalate to Parmeet |
| System health summary | Agent status, error counts, failed automations, and token usage in prior 24 hours. | Alert Parmeet, trigger manual recovery if needed |

| **Kill Switch Protocol** The coordinator can pause any individual agent, all ad spend, or the entire system from the Zoho Analytics dashboard with a single action. Agent 4 monitors for kill switch events and includes them in the daily checkpoint. If a kill switch was activated in the prior 24 hours, this is always the first item in the checkpoint email regardless of other content. |
| --- |

# **4. Support Ticket SLA Tracking**

Version 2.0 adds SLA tracking for all Agent 5 support ticket escalations. Agent 4 reads timestamp fields written by Agent 5 to the Support Tickets CRM module and calculates whether each ticket is within or outside its SLA target. Breached tickets are flagged immediately and included in the weekly SLA report.

## **4.1 SLA Targets and Breach Actions**

| **SLA Metric** | **Target** | **Breach Action** |
| --- | --- | --- |
| Time to first response (Tier 2) | 24 hours from escalation timestamp | Write SLA_Breached = true to ticket. Add to coordinator escalation queue. Send coordinator alert email. |
| Time to first response (Tier 3 and VIP) | 4 hours from escalation timestamp | Write SLA_Breached = true. Send immediate alert to coordinator and Parmeet. Flag as urgent in dashboard. |
| Time to resolution (Tier 2) | 72 hours from escalation timestamp | Write Resolution_SLA_Breached = true. Add to weekly SLA breach count. Flag in coordinator dashboard. |
| Time to resolution (Tier 3 and VIP) | 24 hours from escalation timestamp | Write Resolution_SLA_Breached = true. Send alert to coordinator and Parmeet. |
| Weekly breach rate | Below 10% of all escalated tickets | If breach rate exceeds 10% in any week, include escalation recommendation in weekly SLA report: coordinator capacity review required. |
| Average first response time | Below 12 hours across all tiers | Tracked in weekly SLA report. Trend data included month over month. |

## **4.2 CRM Fields Required for SLA Tracking**

The following fields must exist in the Zoho CRM Support Tickets module before Agent 4 SLA monitoring can function. These fields are written by Agent 5 and read by Agent 4. Coordinate with the Agent 5 developer to confirm field names and data types before either agent is built.

| **CRM Field** | **Module** | **Notes** |
| --- | --- | --- |
| Escalation_Timestamp | Support Tickets | Written by Agent 5 when ticket is escalated. Agent 4 reads this to calculate SLA elapsed time. |
| First_Response_Timestamp | Support Tickets | Written by Agent 5 or coordinator when first human response is sent. Agent 4 reads to calculate time-to-first-response. |
| Resolution_Timestamp | Support Tickets | Written by Agent 5 or coordinator when ticket is marked resolved. Agent 4 reads to calculate time-to-resolution. |
| SLA_Breached | Support Tickets | Checkbox. Written by Agent 4 when first response SLA is missed. |
| Resolution_SLA_Breached | Support Tickets | Checkbox. Written by Agent 4 when resolution SLA is missed. |
| Ticket_Tier | Support Tickets | Picklist. Values: Tier 1, Tier 2, Tier 3, VIP Priority. Written by Agent 5 at ticket creation. Read by Agent 4 to apply correct SLA target. |
| Issue_Category | Support Tickets | Picklist. Values: Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other. Written by Agent 5 at ticket creation. Read by Agent 4 for routing when a second support person is added. |
| Ambassador_VIP_Status | Support Tickets | Checkbox. Written by Agent 5. Read by Agent 4 to flag VIP tickets in dashboard and apply VIP SLA targets. |
| Resolution_Complexity | Support Tickets | Picklist. Values: Simple, Moderate, Complex. Written by Agent 5. Included in routing webhook payload for future team routing. |

## **4.3 Escalation Webhook Payload**

The escalation webhook payload is documented here so that when a second support person is hired, Make.com routing requires only updating a routing table — no Catalyst code change. The payload contains all fields needed for both current single-coordinator routing and future team routing by issue category.

| **Payload Field** | **Value and Purpose** |
| --- | --- |
| ticket_id | CRM Support Ticket record ID. Used by coordinator to open the ticket directly. |
| ambassador_id | CRM Ambassador record ID. Used by coordinator to view ambassador profile. |
| ambassador_name | Ambassador first and last name. Displayed in coordinator alert email subject line. |
| tier | Values: Tier 2, Tier 3, VIP Priority. Determines routing path in Make.com. When a second support person is added, Make.com routes by issue_category rather than round-robin — one coordinator owns Payment and Compliance, the other owns Portal Access and Recruiting. Tier 3 and VIP always escalate to senior coordinator. |
| issue_category | Values: Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other. Future team routing field. Adding a second coordinator requires only updating the Make.com routing table — no Catalyst code change required. |
| is_urgent | Boolean. True when tier = Tier 3 or VIP Priority. Drives routing to Path A (urgent) in Make.com Scenario 1. |
| is_vip | Boolean. True when ambassador VIP_Flag = true. Routes copy of escalation to VIP relationship manager in addition to support coordinator. |
| resolution_complexity | Values: Simple, Moderate, Complex. Informs coordinator of expected resolution effort before they open the ticket. |
| question_text | Full text of the ambassador's question. Included in escalation email body so coordinator has context without opening CRM. |
| escalation_timestamp | ISO timestamp when escalation was created. Agent 4 uses this field to calculate SLA elapsed time. |

| **NOTE** Future team routing: when a second support coordinator is hired, Make.com Scenario 1 is updated so that issue_category = Payment or Compliance routes to Coordinator A, and issue_category = Portal Access or Recruiting routes to Coordinator B. Tier 3 and VIP always route to the senior coordinator regardless of category. This requires no Catalyst code change — only a Make.com routing table update. |
| --- |

# **5. VIP Recalculation Audit**

After Agent 3 completes the quarterly VIP recalculation on the first Monday of each month, Agent 3 fires a completion webhook. Agent 4 receives this webhook via Make.com Scenario 3 and runs six audit checks to confirm the recalculation completed correctly and the tier counts are within expected ranges.

| **Audit Check** | **Logic and Alert Condition** |
| --- | --- |
| High VIP count within expected range | After recalculation, count ambassadors with VIP_Tier = High VIP. Compare to expected count based on population and percentage bands. If count deviates by more than 10% from expected, alert Parmeet with actual vs. expected counts. |
| Standard VIP count within expected range | Same check for Standard VIP tier. Deviation alert if more than 10% off expected. |
| No ambassador assigned both tiers | Query for any ambassador record with VIP_Tier containing multiple values. Should be zero. Alert Parmeet if any found. |
| Tier upgrade messages sent | Count ambassadors with VIP_Tier_Upgrade_Date = today. Confirm Agent 3 sent upgrade welcome messages for each. Alert Parmeet if upgrade count and welcome message count do not match. |
| Personal outreach list delivered | Confirm VIP relationship manager received CRM tasks for High VIP ambassadors with no referral in 30 days. Alert Parmeet if task count is zero (possible if all High VIP ambassadors have recent referral activity — confirm this is expected, not a failure). |
| Recalculation timestamp written | Confirm VIP_Score field has been updated on active ambassador records within the past 24 hours. If zero records show a recent VIP_Score update, recalculation likely failed. Alert Parmeet immediately. |

## **5.1 Audit Code Pattern**

| async function runVIPRecalculationAudit(crmToken, population) {   const tolerance = parseFloat(process.env.VIP_AUDIT_TOLERANCE_PCT ││ '10') / 100;   // Determine expected counts based on population size   const isLargePopulation = population >= parseInt(process.env.VIP_POPULATION_THRESHOLD ││ '10000');   const highVIPPct  = isLargePopulation     ? parseFloat(process.env.VIP_HIGH_PCT_LARGE ││ '0.5') / 100     : parseFloat(process.env.VIP_HIGH_PCT_SMALL ││ '2.5') / 100;   const stdVIPPct   = isLargePopulation     ? parseFloat(process.env.VIP_STD_PCT_LARGE  ││ '2.5') / 100     : parseFloat(process.env.VIP_STD_PCT_SMALL  ││ '5')   / 100;   const expectedHighVIP = Math.round(population * highVIPPct);   const expectedStdVIP  = Math.round(population * stdVIPPct);   // Count actual tier assignments   const actualHighVIP = await countAmbassadorsByTier('High VIP', crmToken);   const actualStdVIP  = await countAmbassadorsByTier('Standard VIP', crmToken);   const highDeviation = Math.abs(actualHighVIP - expectedHighVIP) / expectedHighVIP;   const stdDeviation  = Math.abs(actualStdVIP  - expectedStdVIP)  / expectedStdVIP;   const anomalies = [];   if (highDeviation > tolerance) anomalies.push({     check: 'High VIP count', expected: expectedHighVIP, actual: actualHighVIP   });   if (stdDeviation > tolerance) anomalies.push({     check: 'Standard VIP count', expected: expectedStdVIP, actual: actualStdVIP   });   return { passed: anomalies.length === 0, anomalies }; } |
| --- |

# **6. Weekly Report**

The weekly report is delivered every Monday at 6:15 AM CST, before the weekly engagement cycle begins. It covers the past seven days of program activity across six sections.

| **Report Section** | **Content** |
| --- | --- |
| Referral Fee Summary | Total referrals at Eligible stage awaiting payment. Total referral fees paid this week. Total referral fees paid this month. Cumulative total paid to date. Breakdown by undergraduate vs. graduate fee tier. |
| SLA Performance | Total tickets escalated this week by tier. Average first response time by tier. Breach count and breach rate. Open tickets older than 48 hours. Longest open ticket age. |
| Ambassador Health | Total active ambassadors. New activations this week. Standard track count. Alternative track count. Dormant track count. Ambassadors escalated to human this week. |
| VIP Program Status | High VIP count. Standard VIP count. Tier upgrades this quarter. Personal outreach tasks delivered this month. High VIP ambassadors with no referral in 30 days. |
| System Health | Agent error counts by agent in the past 7 days. Failed automations. Claude API token usage and cost estimate. Any agents with zero activity (possible silent failure). |
| Content Compliance | Em dash violations detected this week. Commission language violations detected this week. Items added to escalation queue for content violations. |

# **7. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Daily Jobs | Daily 6:00 AM CST | Fires Agent 4 daily Catalyst functions in sequence: fraud flag check, eligibility queue check, SLA monitoring, then daily checkpoint delivery at 7:00 AM CST. |
| Scenario 2: Weekly Report | Monday 6:00 AM CST | Fires Agent 4 weekly report Catalyst function. Compiles referral fee report and SLA weekly summary. Sends combined weekly email to coordinator. |
| Scenario 3: Post-Recalculation Audit | Triggered by Agent 3 VIP recalculation completion webhook | Fires VIP audit Catalyst function. Runs all six audit checks. Sends audit confirmation or anomaly alert to Parmeet. |
| Scenario 4: SLA Breach Alert | Agent 4 SLA monitoring job on breach detection | Sends immediate breach alert to coordinator with ticket ID, ambassador name, tier, and hours elapsed. For Tier 3 and VIP breaches, also alerts Parmeet. |
| Scenario 5: Content Compliance Alert | Agent 4 content audit on violation detection | Sends coordinator notification with violation details. Adds to escalation queue. Logs violation to weekly report. |

# **8. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Daily checkpoint job fails to run | Catalyst function error or missed schedule | Send Parmeet alert. Coordinator does not receive checkpoint. Manual check required. |
| CRM query returns error on fraud flag check | Zoho CRM API error | Log error. Retry once. If retry fails, alert Parmeet. Fraud flags may be undetected until next run. |
| SLA monitoring query fails | Zoho CRM API error on Support Tickets query | Log error. Alert Parmeet. SLA breach detection paused until resolved. |
| VIP recalculation audit detects count anomaly | High or Standard VIP count deviates more than 10% from expected | Alert Parmeet with actual vs. expected counts and the population size used. Do not attempt auto-correction. Human review required. |
| VIP recalculation audit finds zero VIP_Score updates | No ambassador records show VIP_Score updated in past 24 hours | Immediate alert to Parmeet. Agent 3 recalculation likely failed. Parmeet must manually trigger recalculation or investigate Agent 3 logs. |
| Content compliance audit finds violation | Em dash or commission language detected in sampled email content | Add to escalation queue with specific violation, email content, and ambassador ID. Alert coordinator. Do not send additional violation emails until coordinator reviews. |
| Weekly report generation fails | Catalyst function error on report assembly | Alert Parmeet. Send partial report with whatever data was successfully compiled. Note missing sections. |
| Zoho Analytics write fails | Analytics API error on dashboard update | Log error. Email coordinator the checkpoint data directly as a text summary. Alert Parmeet. |

# **9. Testing Protocol**

## **9.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Fraud flag detection | Set Disqualification_Flag = true on a test ambassador record. Run daily fraud flag check. | Escalation queue item created with ambassador name, flag type, and recommended action. |
| Eligibility queue population | Set a test Referral record to Stage = Eligible. Run daily eligibility check. | Referral appears in payment queue view. Coordinator payment action is available. |
| SLA breach detection — Tier 2 first response | Create a Support Ticket with Tier = Tier 2 and Escalation_Timestamp = 25 hours ago. First_Response_Timestamp = null. Run SLA monitoring. | SLA_Breached = true written to ticket. Coordinator alert email sent. |
| SLA breach detection — VIP first response | Create a ticket with Tier = VIP Priority and Escalation_Timestamp = 5 hours ago. First_Response_Timestamp = null. | SLA_Breached = true. Immediate alert to coordinator AND Parmeet. |
| SLA no breach — within threshold | Create a Tier 2 ticket with Escalation_Timestamp = 12 hours ago. Run SLA monitoring. | SLA_Breached remains false. No alert. |
| VIP audit — count within range | Run VIP audit with 1,000 test ambassador records. Expected High VIP = 5 (0.5% of 1,000 at large-population bands). Actual = 5. | Audit passes. Confirmation email sent to Parmeet. No anomaly alert. |
| VIP audit — count anomaly | Run VIP audit with actual High VIP count = 50 when expected = 5. | Anomaly alert sent to Parmeet with actual vs. expected counts. No auto-correction. |
| VIP audit — zero VIP_Score updates | Simulate no VIP_Score updates in past 24 hours. | Immediate alert to Parmeet: recalculation appears to have failed. |
| Content compliance — em dash violation | Insert an em dash into a test Activity Log email record. Run content audit. | Violation added to escalation queue. Coordinator alert sent. Violation counted in weekly report. |
| Content compliance — commission language | Insert the word commission into a test email record. Run content audit. | Same as em dash violation response. |
| Weekly SLA report generation | Run weekly report function with 10 test ticket records across tiers. | Report includes correct average response times, breach counts, and open ticket age. No missing sections. |
| Escalation webhook payload completeness | Inspect Make.com Scenario 4 webhook payload on breach alert. | Payload includes all ten fields: ticket_id, ambassador_id, ambassador_name, tier, issue_category, is_urgent, is_vip, resolution_complexity, question_text, escalation_timestamp. |

## **9.2 Integration Test**

- Confirm Support Tickets CRM module contains all nine SLA fields before integration test begins

- Confirm Zoho Analytics coordinator dashboard is accessible via API and receives test data

- Create a test Support Ticket with Escalation_Timestamp 25 hours ago and Tier = Tier 2. Run SLA monitoring. Confirm SLA_Breached = true and coordinator receives breach alert email

- Create a test Support Ticket with Tier = VIP Priority and Escalation_Timestamp 5 hours ago. Confirm both coordinator and Parmeet receive immediate breach alert

- Trigger a simulated Agent 3 VIP recalculation completion webhook. Confirm Agent 4 Scenario 3 fires and audit runs

- Simulate VIP tier count anomaly. Confirm Parmeet alert sent with actual vs. expected counts

- Run daily checkpoint job manually. Confirm checkpoint email arrives at coordinator email at correct time with all eight checkpoint sections

- Run weekly report job manually. Confirm all six report sections are present in coordinator weekly email

- Verify escalation webhook payload contains all ten required fields

## **9.3 Acceptance Criteria**

- Daily checkpoint email delivered to coordinator by 7:00 AM CST every day

- SLA breach alerts fire within 30 minutes of threshold being crossed for all tiers

- VIP recalculation audit runs after every Agent 3 recalculation and sends confirmation to Parmeet

- Anomaly alerts fire when tier counts deviate more than the configured tolerance percentage

- Weekly report includes all six sections with accurate data for the prior seven days

- Escalation webhook payload includes all ten fields so future team routing requires only a Make.com table update

- All SLA threshold values are adjustable by Parmeet without developer assistance

# **10. Integration Notes for Other Developers**

## **10.1 What Agent 5 Developer Needs to Know**

- Agent 4 reads nine specific fields from the Support Tickets CRM module. All nine must be written by Agent 5 at the correct moments (escalation, first response, resolution). Confirm field names match exactly between Agent 4 and Agent 5 specifications before either developer builds CRM write logic.

- The escalation webhook payload must include all ten fields listed in Section 4.3. Agent 4 uses the escalation_timestamp field from this payload — not from CRM — for SLA calculation. If the payload is missing escalation_timestamp, SLA tracking will fail silently.

## **10.2 What Agent 3 Developer Needs to Know**

- Agent 3 must fire a VIP recalculation completion webhook after the quarterly VIP recalculation job finishes. The webhook fires Make.com Scenario 3 which triggers the Agent 4 VIP audit. Without this webhook, the audit never runs. Coordinate on the exact webhook URL and payload structure.

- The audit uses the same VIP percentage band environment variables as Agent 3 (VIP_HIGH_PCT_SMALL, VIP_STD_PCT_SMALL, VIP_HIGH_PCT_LARGE, VIP_STD_PCT_LARGE, VIP_POPULATION_THRESHOLD). Both agents must read the same values. Confirm these are shared environment variables, not duplicated with different names.

# **11. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token |
| ZOHO_ANALYTICS_CLIENT_ID | Parmeet | OAuth client ID for Zoho Analytics |
| ZOHO_ANALYTICS_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Analytics |
| ZOHO_ANALYTICS_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Analytics |
| ZOHO_MAIL_CLIENT_ID | Parmeet | OAuth client ID for Zoho Mail |
| ZOHO_MAIL_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Mail |
| ZOHO_MAIL_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Mail |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for WorkDrive |
| WORKDRIVE_FOLDER_08_ID | Parmeet | WorkDrive Folder 08 ID for copy rules file |
| AMBASSADORS_MODULE_API_NAME | Parmeet | Exact API name of Ambassadors module in Zoho CRM |
| REFERRALS_MODULE_API_NAME | Parmeet | Exact API name of Referrals module in Zoho CRM |
| SUPPORT_TICKETS_MODULE_API_NAME | Parmeet | Exact API name of Support Tickets module in Zoho CRM |
| SLA_TIER2_FIRST_RESPONSE_HOURS | Parmeet | Hours before Tier 2 first response SLA breach. Default: 24 |
| SLA_VIP_FIRST_RESPONSE_HOURS | Parmeet | Hours before Tier 3 and VIP first response SLA breach. Default: 4 |
| SLA_TIER2_RESOLUTION_HOURS | Parmeet | Hours before Tier 2 resolution SLA breach. Default: 72 |
| SLA_VIP_RESOLUTION_HOURS | Parmeet | Hours before Tier 3 and VIP resolution SLA breach. Default: 24 |
| VIP_AUDIT_TOLERANCE_PCT | Parmeet | Percentage deviation allowed before VIP tier count anomaly alert fires. Default: 10 |
| MAKE_AGENT4_SLA_BREACH_WEBHOOK | Developer | Make.com webhook URL for Scenario 4 SLA breach alerts |
| MAKE_AGENT4_COMPLIANCE_WEBHOOK | Developer | Make.com webhook URL for Scenario 5 content compliance alerts |
| MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK | Developer | Make.com webhook URL fired by Agent 3 after VIP recalculation completes. Agent 4 listens on this to trigger Scenario 3. |
| COORDINATOR_EMAIL | Parmeet | Email address of the human coordinator for checkpoint and alert delivery |
| PARMEET_ALERT_EMAIL | Parmeet | Email address for Parmeet-level alerts (VIP audit anomalies, recalculation failures, SLA breach on VIP) |
| VIP_MANAGER_EMAIL | Parmeet | Email address of the VIP relationship manager for VIP breach escalation copies |

| **NOTE** The five SLA threshold variables and the VIP_AUDIT_TOLERANCE_PCT variable are Parmeet-adjustable without developer assistance. This allows the coordinator to tighten or relax SLA targets as the support team grows without a code deployment. |
| --- |
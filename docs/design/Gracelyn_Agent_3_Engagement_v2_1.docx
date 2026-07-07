**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 3 of 9

**Engagement Agent**

*30-Day Activation Sprint, weekly engagement cycle, story selection by role category,*

*non-referral alternative track, dormant track, and dynamic VIP tier logic*

Version 2.1

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

| **HARD STOP** Do not begin development until Parmeet has confirmed: (1) WorkDrive Folder 05 exists and contains at least four story files tagged with Role_Category metadata; (2) the three new sprint CRM fields (Activation_Sprint_Week, Activation_Sprint_Start_Date, Sprint_Referral_Submitted) are created in the Ambassadors module; (3) the Engagement_Track picklist includes Sprint as a value alongside Standard, Alternative, and Dormant. |
| --- |

| **Tool** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.ALL | Read Ambassadors module. Write activity log, engagement track, VIP tier, and sprint fields. Read Referrals module for milestone detection. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Send all engagement emails and sprint milestone emails from ambassadors@gracelyn.edu. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ, WorkDrive.files.UPDATE | Read Folder 05 (story files), Folder 08 (brand assets). Mark story files as used. | Parmeet |
| Claude API (Anthropic) | API key. Model: claude-sonnet-4-20250514 | Highest token usage agent in the system. Every email in every cycle is generated fresh. Estimate token budget with Parmeet before launch. | Parmeet |
| HeyGen API | API key | Milestone recognition videos only. VIP welcome videos handled by Agent 2. Avatar ID for Dr. Flippen provided by Parmeet. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build all Agent 3 scenarios: activation trigger, sprint week advancement, weekly cycle, milestone detection, dormant detection, VIP supplemental, monthly recalculation. | Parmeet |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 3 is the heartbeat of the ambassador program. It manages every ambassador's journey from their first day of activation through their entire tenure. Version 2.1 adds the 30-Day Activation Sprint as the structured first-month experience for every newly activated ambassador — a four-week milestone cadence that converts newly onboarded ambassadors into active referrers before they need a win-back sequence.

After the sprint, Ambassador 3 maintains weekly contact through a four-week rotating content calendar, detects referral milestones, routes non-active ambassadors into alternative and dormant tracks, and manages the dynamic VIP tier system with quarterly recalculation.

| **30-DAY ACTIVATION SPRINT** The 30-Day Activation Sprint is the single most important addition in Version 2.1. It addresses the most predictable failure point in any ambassador program: ambassadors who complete onboarding but never take a first action. The sprint turns the first 30 days into a structured, milestone-driven experience rather than a passive waiting period. Build and test the sprint before building any other function in this agent. |
| --- |

| **RULE** The weekly engagement cycle (standard calendar) must never fire for an ambassador whose Activation_Sprint_Week field is greater than 0. Sprint ambassadors and standard cycle ambassadors are completely separate populations in every job query. This separation is non-negotiable. |
| --- |

## **2.2 Run Cycle**

| **NOTE** Sprint jobs run at 8:00 AM CST on Mondays — one hour before the standard weekly cycle at 9:00 AM CST. This sequencing ensures sprint ambassadors receive their sprint email before the standard cycle runs, preventing any risk of a sprint ambassador accidentally receiving both emails in the same Monday morning window. |
| --- |

| **Trigger** | **Source** | **Timing** | **Function** |
| --- | --- | --- | --- |
| Ambassador activated | Agent 2 activation webhook | Real-time | Initialize ambassador: set Activation_Sprint_Week = 1, Content_Week_Position = 1, Engagement_Track = Standard, Days_Since_Last_Referral = 0. Send Sprint Week 1 email immediately. |
| Sprint week advancement | Catalyst scheduled job | Monday 8:00 AM CST | Query ambassadors with Activation_Sprint_Week 1-3. Advance to next sprint week. Send the appropriate sprint email for the new week. |
| Sprint Day 30 graduation | Catalyst scheduled job | Monday 8:00 AM CST (with week advancement) | Query ambassadors where Activation_Sprint_Week = 4 AND sprint started 7+ days ago. Graduate to standard cycle: set Activation_Sprint_Week = 0. Send sprint graduation email. |
| Weekly engagement cycle | Catalyst scheduled job | Monday 9:00 AM CST | Query all Standard track active ambassadors where Activation_Sprint_Week = 0. Generate and send personalized weekly email by content week position. Increment week position. Process Alternative and Dormant tracks. |
| Daily milestone detection | Catalyst scheduled job | Daily 7:00 AM CST | Query Referrals module for recent stage changes. Detect first, fifth, tenth referral milestones. Send milestone email and submit HeyGen video job if applicable. |
| Referral stage change | Zoho Flow webhook | Real-time | Send referral notification email E (Applied) or F (Enrolled) to the referring ambassador. |
| Daily dormant detection | Catalyst scheduled job | Daily 7:30 AM CST | Query ambassadors where Last_Engagement_Date > 30 days ago. Attempt re-engagement sequences. |
| Monthly non-referral track check | Catalyst scheduled job | First Monday of month 6:00 AM CST | Query Standard track ambassadors with Activation_Sprint_Week = 0 active more than 90 days with zero referrals. Move to Alternative track. |
| Monthly VIP recalculation | Catalyst scheduled job | First Monday of month 6:30 AM CST | Score all active ambassadors. Apply dynamic tier thresholds. Update VIP_Tier. Send tier upgrade welcome messages. |
| Monthly VIP supplemental | Catalyst scheduled job | First Monday of month 7:00 AM CST | Send automated monthly check-in to all Standard VIP and High VIP ambassadors. Build High VIP personal outreach list as CRM tasks. |

# **3. New CRM Fields Required (v2.1)**

Three new fields must be added to the Zoho CRM Ambassadors module before development begins. These fields are the operational core of the sprint. All three are new in v2.1 and do not exist in the v2.0 Pre-Build Checklist — Parmeet must add them.

| **Field Name** | **API Name** | **Type and Values** |
| --- | --- | --- |
| Activation Sprint Week | Activation_Sprint_Week | Integer. Values 0-4. 0 = not in sprint or graduated. 1-4 = current sprint week. Set to 1 on activation. Set to 0 on Day 30 graduation. |
| Activation Sprint Start Date | Activation_Sprint_Start_Date | Date. Written when ambassador is activated. Used to calculate graduation timing and to exclude sprint days from the 90-day non-referral threshold. |
| Sprint Referral Submitted | Sprint_Referral_Submitted | Checkbox. Set to true when a referral is submitted while Activation_Sprint_Week is 1-4. Drives Week 3 sprint email framing: celebration if true, encouragement if false. |

| **NOTE** The Engagement_Track picklist must also be updated to include Sprint as a value (alongside Standard, Alternative, and Dormant). This allows the coordinator dashboard and Agent 4 reporting to clearly distinguish sprint ambassadors from the standard active population. |
| --- |

# **4. The 30-Day Activation Sprint**

Every newly activated ambassador enters the sprint immediately on activation. The sprint runs for four weeks with one milestone email per week. Each week has a distinct purpose that moves the ambassador progressively from orientation to confident engagement.

| **Week** | **Milestone** | **Email Content and Purpose** |
| --- | --- | --- |
| Sprint Week 1 (Days 1-7) | Certify and connect | Sent immediately on activation. Confirms compliance is complete and referral link is active. Introduces the ambassador portal and where to find everything. Introduces the ambassador community and encourages first engagement. Warm and celebratory tone. This is the first impression of active membership — it must feel like a genuine welcome, not a checklist. |
| Sprint Week 2 (Days 8-14) | First outreach | Sent on the Monday of Week 2. Acknowledges that Week 1 was orientation. Week 2 is about taking the first step. Provides a specific, concrete suggestion: think of one person in your network right now who is already doing the work of teaching but does not have the credential. Share your referral link with them specifically. Includes the referral link prominently. Framed as one person, not a campaign. Soft and specific — not a mass-share ask. |
| Sprint Week 3 (Days 15-21) | First lead | Sent on the Monday of Week 3. Acknowledges that some ambassadors may have already referred someone — celebrates that. For those who have not yet referred anyone, provides a different angle: a success story from a student who was in a similar position. Includes a pre-written shareable message they can forward directly. Coaching tone: what does it look like when this works? Referral link included. |
| Sprint Week 4 (Days 22-30) | 90-day goal | Sent on the Monday of Week 4. This is the final sprint week before the standard cycle begins. Invites the ambassador to reflect on what they want to accomplish in their first 90 days as an active ambassador. Prompts them to think about: how many people could they realistically introduce to Gracelyn? Are there community events, conversations, or contexts where this naturally fits? Frames the standard weekly cycle as ongoing support for their personal goal. Warm close with mission reconnection. |

## **4.1 Sprint Email Tone Principles**

- Sprint emails are warmer and more personally direct than standard calendar emails. They speak to the ambassador as an individual in a specific moment of their journey, not as a member of a large program.

- Week 1 is celebratory — you are now an ambassador, here is everything you need.

- Week 2 is specific — not ask everyone, ask this one person you already have in mind.

- Week 3 is coaching — here is what it looks like when this works, adjusted for whether they have already referred someone.

- Week 4 is reflective and forward-looking — what do you want your first 90 days to look like? No pressure, just intention.

- No sprint email contains a mass-share ask. Every outreach prompt is framed as one person, one conversation.

## **4.2 Sprint Transition and Edge Case Handling**

| **Scenario** | **How Agent 3 Handles It** |
| --- | --- |
| Ambassador submits a referral during the sprint | The sprint continues on its normal schedule. The referral notification email (Email E or F) fires as usual. Agent 3 does not exit the sprint early on a referral — the sprint completes its four weeks regardless. However, Week 3 email detects whether a referral has been submitted and adjusts its tone accordingly: celebration framing if yes, encouragement framing if no. |
| Ambassador completes Sprint Week 4 and graduates | Activation_Sprint_Week is set to 0. Content_Week_Position is set to 1. The ambassador enters the standard four-week content calendar beginning the following Monday. A graduation email fires on Day 30: brief, warm, mission-aligned. Acknowledges the first month and looks forward. No referral ask in the graduation email. |
| Ambassador is VIP_Prospect_Origin = true | The sprint still runs. VIP ambassadors need the structured first-month experience as much as any other ambassador. The sprint emails are generated with additional personalization referencing their specific community and role, but the four-week milestone structure is identical. |
| Non-referral track check on first Monday of month | Ambassadors still in the sprint (Activation_Sprint_Week 1-4) are excluded from the non-referral track check. The 90-day threshold for the Alternative track does not begin counting until the day the ambassador graduates from the sprint (Day 30 approximately). |
| Dormant detection during sprint | Ambassadors still in the sprint are excluded from the dormant detection job. A newly activated ambassador who has not opened emails in 30 days is more likely to be confused or disengaged than truly dormant. The sprint win-back approach (Week 3 coaching and Week 4 goal-setting) is the first re-engagement attempt. Standard dormant detection begins only after sprint graduation. |
| Ambassador never completes compliance (compliance gate) | The sprint never fires if compliance is not complete. Activation_Sprint_Week remains at 0. The compliance win-back sequence (Day 2, 7, 14 reminders, Day 15 win-back survey) runs as normal. The sprint begins only when Agent 2 fires the activation webhook — which fires only on Compliance_Complete = true. |

## **4.3 Sprint Claude Prompts**

Each sprint week uses a distinct Claude API prompt. The system prompt is the same for all four weeks. The user prompt varies by week and includes the Sprint_Referral_Submitted flag for Week 3.

| // Shared system prompt for all four sprint weeks function buildSprintSystemPrompt(copyRules, voiceGuidelines) {   return `You write personalized 30-Day Activation Sprint emails for Gracelyn University ambassadors. These emails are warmer and more personally direct than standard engagement emails. Each email addresses the ambassador at a specific moment in their first month. The tone is supportive, specific, and mission-aligned. Rules: - Never use em dashes - Never say commission. Always say referral fee. - Never use a mass-share ask. Always frame as one person, one conversation. - Address the ambassador by first name - Keep the email under 200 words - End with a single clear next step, not a list COPY RULES: ${copyRules} VOICE GUIDELINES: ${voiceGuidelines}`; } // Week 3 user prompt — adjusts framing based on referral activity function buildSprintWeek3Prompt(ambassador) {   const hasReferred = ambassador.Sprint_Referral_Submitted;   return `Ambassador first name: ${ambassador.firstName} Role category: ${ambassador.roleCategory} Motivation tag: ${ambassador.motivationTag} Has submitted a referral during the sprint: ${hasReferred} Write the Sprint Week 3 email. If has_referred is true: open with genuine celebration of their referral. Acknowledge they are already making an impact. Encourage them to continue. Include referral link. If has_referred is false: open with a success story angle. Share what it looks like when an ambassador refers someone who goes on to succeed. Include a pre-written forwarding message they can send to one specific person. Include referral link.`; } |
| --- |

# **5. Standard Engagement Cycle (Post-Sprint)**

After sprint graduation on Day 30, ambassadors enter the standard four-week content calendar. The standard cycle is identical to the v2.0 specification with one clarification: the non-referral Alternative track threshold is measured from the sprint graduation date, not from the original activation date.

## **5.1 Engagement Tracks**

| **Track** | **Entry Criteria** | **Cadence and Content** |
| --- | --- | --- |
| Sprint (new) | All ambassadors from activation through Day 30. Activation_Sprint_Week = 1, 2, 3, or 4. | Weekly sprint emails firing each Monday. Weeks 1-4 as defined in Section 4. Excluded from standard calendar, non-referral check, and dormant detection during this period. |
| Standard | All ambassadors after sprint graduation (Activation_Sprint_Week = 0). Ambassadors who submit a referral while in Alternative track return to Standard. | Weekly email following four-week content calendar. Full personalization. Referral asks included. |
| Alternative | Active more than 90 days with zero referrals. Detected monthly. Sprint days excluded from the 90-day count. | Bi-weekly email. Three content types rotating monthly: story submission invitation, experience sharing invitation, one-tap referral ask. |
| Dormant | No email open or click activity for 30+ consecutive days and no referral activity. Begins counting after sprint graduation. | Day 30: re-engagement attempt 1. Day 45: attempt 2. Day 60: escalated to coordinator. No automated contact after Day 60. |

## **5.2 Four-Week Content Calendar**

| **Week** | **Theme** | **Content Description** |
| --- | --- | --- |
| Week 1 | Mission Moment | A brief reflection on the Gracelyn mission and why it matters. Personalized to the ambassador's motivation tag: Mission Impact ambassadors receive a student-centered story framing; Professional Growth ambassadors receive a teacher development framing; Kingdom Calling ambassadors receive a faith and calling framing. Referral link included with soft invitation to share. |
| Week 2 | Success Story | A student success story sourced from the WorkDrive Folder 05 buffer, selected by role category match. Story is summarized and personalized by Claude for each ambassador. Referral link included with mission-connect framing. |
| Week 3 | Ambassador Spotlight | Recognition of an active ambassador with highest referral activity in past 30 days. Celebrates the community. Soft referral encouragement. |
| Week 4 | Program Update | Program news and forward-looking message from Parmeet's update_brief.txt in Folder 08. Claude generates mission message if brief not found. Referral link included. |

## **5.3 Story Selection by Role Category**

| **Story Selection Step** | **Logic** |
| --- | --- |
| Step 1: Filter by role category | Query WorkDrive Folder 05 for story files tagged with the ambassador's Role_Category. Story files include a metadata header with a Role_Category field set at submission via Agent 6's intake form. |
| Step 2: Select most recent match | From the filtered set, select the story file with the most recent date in the filename (Story_YYYY-MM-DD format). |
| Step 3: Role category fallback | If no story file matches the ambassador's Role_Category, fall back to any story file tagged Any. If no Any-tagged files exist, fall back to the most recently dated story file regardless of category. |
| Step 4: Empty buffer fallback | If Folder 05 contains no story files at all, use a Claude-generated placeholder story. Send Parmeet an alert that the story buffer is empty. |
| Step 5: Mark file as used | After selecting a story file, write the ambassador's Role_Category and the current date to a Used_By log in WorkDrive Folder 05. |

| async function getMostRecentStoryByCategory(roleCategory, workdriveToken) {   const FOLDER_05_ID = process.env.WORKDRIVE_FOLDER_05_ID;   const listUrl = `https://workdrive.zoho.com/api/v1/files/${FOLDER_05_ID}/files` +     `?sort_by=created_time&sort_order=DESC&limit=50`;   const listResp = await fetch(listUrl, {     headers: { 'Authorization': `Zoho-oauthtoken ${workdriveToken}` }   });   const listData = await listResp.json();   const files = (listData.data ││ []).filter(f =>     f.attributes.name.startsWith('Story_') &&     f.attributes.name.endsWith('.txt')   );   if (files.length === 0) return null;   for (const file of files) {     const content = await downloadStoryFile(file.id, workdriveToken);     const fileCat = parseRoleCategory(content);     if (fileCat === roleCategory ││ fileCat === 'Any') {       return { name: file.attributes.name, content };     }   }   const fallback = files[0];   const content = await downloadStoryFile(fallback.id, workdriveToken);   return { name: fallback.attributes.name, content }; } function parseRoleCategory(fileContent) {   const match = fileContent.match(/^ROLE_CATEGORY:\s*(.+)$/m);   return match ? match[1].trim() : 'Any'; } |
| --- |

## **5.4 Alternative Track Content**

| **Content Type** | **Rotation** | **Content Detail** |
| --- | --- | --- |
| Type 1: Story invitation | Months 1, 4, 7, 10 | Warm invitation to share a student success story they know about. Links to the Agent 6 story intake form. No referral ask. |
| Type 2: Experience invitation | Months 2, 5, 8, 11 | Invitation to share their own Gracelyn experience for the asset library. No referral ask. |
| Type 3: One-tap referral ask | Months 3, 6, 9, 12 | A pre-written message they can forward to one specific person. Framed as: one person, one message, no pressure. Referral link embedded. |

| **NOTE** Alternative track ambassadors who submit a referral return to Standard track immediately. Content_Week_Position resets to 1 and a warm recognition note acknowledges their referral. The alternative track 90-day threshold is calculated from Activation_Sprint_Start_Date + SPRINT_GRADUATION_DAYS, not from the original activation date. Sprint days are not counted toward the Alternative track threshold. |
| --- |

# **6. Dynamic VIP Tier System**

| **Tier** | **Score Threshold** | **Engagement Treatment** |
| --- | --- | --- |
| Not VIP | Below Standard VIP threshold | Standard weekly engagement cycle only. |
| Standard VIP | Top 5% when population under 10,000. Top 2.5% when 10,000 or above. | Automated monthly check-in email in addition to standard weekly emails. Does NOT appear on personal outreach list. |
| High VIP | Top 2.5% when population under 10,000. Top 0.5% when 10,000 or above. | Automated monthly check-in email AND appears on personal outreach list as CRM tasks for VIP Relationship Manager. Tier upgrade triggers personal welcome message. |

## **6.1 VIP Scoring Model**

| **Dimension** | **Points** | **Calculation** |
| --- | --- | --- |
| Referral Activity | 0-40 points | 10 pts per confirmed referral submitted in past 90 days, max 40 pts. |
| Engagement Rate | 0-30 points | 30 pts: 80%+ open/click rate on emails sent. 20 pts: 50-79%. 10 pts: 25-49%. 0 pts: below 25%. |
| Tenure and Consistency | 0-30 points | 10 pts: active 6+ months. 20 pts: 12+ months. 30 pts: 24+ months. Bonus 5 pts for two consecutive prior VIP quarters. Cap at 30. |

## **6.2 Population Threshold Transition**

- Tier percentages shift at the next quarterly recalculation after the active count crosses 10,000.

- Population size is read at the start of each quarterly recalculation.

- All four percentage band values are Parmeet-adjustable environment variables.

- Tier downgrades receive no notification. Tier upgrades receive a recognition message.

## **6.3 VIP Supplemental Cycle**

| async function vipSupplementalCycle(crmToken, mailToken) {   // Automated check-in to ALL Standard VIP and High VIP ambassadors   const allVIP = await queryCRMAmbassadors(     '(VIP_Tier:equals:Standard VIP)OR(VIP_Tier:equals:High VIP)',     crmToken   );   for (const amb of allVIP) {     await sendVIPCheckInEmail(amb, mailToken);   }   // Personal outreach list: High VIP only, no referral in past 30 days   const thirtyDaysAgo = new Date();   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);   const highVIPInactive = await queryCRMAmbassadors(     `(VIP_Tier:equals:High VIP)` +     `AND(Last_Referral_Date:before:${thirtyDaysAgo.toISOString().split('T')[0]})`,     crmToken   );   // Deliver as CRM tasks assigned to VIP relationship manager   for (const amb of highVIPInactive) {     await createCRMTask({       subject: `Personal outreach: ${amb.firstName} ${amb.lastName} (High VIP)`,       assignedTo: process.env.VIP_MANAGER_EMAIL,       dueDate: getNextFriday(),       description: `High VIP ambassador. Score: ${amb.VIP_Score}. Last contact: ${amb.Last_Engagement_Date}.`     }, crmToken);   } } |
| --- |

# **7. Batch Processing for Scale**

At 100,000 ambassadors the weekly engagement cycle must process all Standard track ambassadors within 60 minutes. Sprint ambassadors are processed separately at 8:00 AM and are a far smaller population at any given time (all ambassadors activated in the past 30 days). Both run as concurrent batches.

| async function weeklyEngagementCycle(crmToken, mailToken, workdriveToken) {   const batchSize = parseInt(process.env.WEEKLY_BATCH_SIZE ││ '100');   // Standard track only: exclude sprint ambassadors   const ambassadors = await queryCRMAmbassadors(     '(Engagement_Track:equals:Standard)AND(Activation_Sprint_Week:equals:0)',     crmToken   );   for (let i = 0; i < ambassadors.length; i += batchSize) {     const batch = ambassadors.slice(i, i + batchSize);     await Promise.all(batch.map(amb =>       processAmbassadorWeeklyEmail(amb, crmToken, mailToken, workdriveToken)         .catch(err => logBatchError(amb.id, err))     ));   } } |
| --- |

# **8. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Activation | Agent 2 activation webhook | Initialize ambassador fields including Activation_Sprint_Week = 1, Engagement_Track = Sprint, Activation_Sprint_Start_Date = today. Send Sprint Week 1 email immediately. |
| Scenario 2: Sprint Week Advancement | Monday 8:00 AM CST | Fires sprint advancement Catalyst function. Queries ambassadors with Activation_Sprint_Week 1-3. Advances each to next week. Sends sprint email for new week. Graduates ambassadors where sprint started 28+ days ago (setting Activation_Sprint_Week = 0, Engagement_Track = Standard, Content_Week_Position = 1). Sends graduation email. |
| Scenario 3: Weekly Cycle | Monday 9:00 AM CST | Fires weekly engagement Catalyst function for Standard, Alternative, and Dormant tracks. Sprint ambassadors (Activation_Sprint_Week > 0) are excluded. |
| Scenario 4: Milestone Detection | Daily 7:00 AM CST | Fires milestone detection Catalyst function. Processes all referral milestones. Also checks Sprint_Referral_Submitted flag for sprint ambassadors. |
| Scenario 5: Referral Notification | Zoho Flow webhook on Referral stage change | Sends Email E (Applied) or Email F (Enrolled). Also sets Sprint_Referral_Submitted = true if Activation_Sprint_Week > 0. |
| Scenario 6: Dormant Detection | Daily 7:30 AM CST | Excludes ambassadors with Activation_Sprint_Week > 0. Processes only graduated ambassadors. |
| Scenario 7: Monthly Non-Referral Check | First Monday of month 6:00 AM CST | Excludes ambassadors with Activation_Sprint_Week > 0. 90-day threshold calculated from Activation_Sprint_Start_Date + 30 days (sprint graduation date), not from original activation date. |
| Scenario 8: Monthly VIP Recalculation | First Monday of month 6:30 AM CST | Scores all active ambassadors including sprint graduates. Sprint ambassadors may accumulate VIP score during sprint period if they submit referrals. |
| Scenario 9: Monthly VIP Supplemental | First Monday of month 7:00 AM CST | Sends automated check-in to Standard VIP and High VIP ambassadors. High VIP personal outreach list delivered to VIP Relationship Manager as CRM tasks. |

# **9. CRM Fields Written by Agent 3**

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| Activation_Sprint_Week | Integer 0-4 | NEW in v2.1. 0 = not in sprint or sprint graduated. 1-4 = current sprint week. Set to 1 on activation. Advanced weekly by Monday 8:00 AM CST job. Set to 0 on Day 30 graduation. All sprint-aware jobs check this field before processing. |
| Activation_Sprint_Start_Date | Date | NEW in v2.1. Written when ambassador is activated. Used to calculate Day 30 graduation. Also used to exclude sprint days from the 90-day non-referral track threshold. |
| Sprint_Referral_Submitted | Checkbox | NEW in v2.1. Set to true when a referral is submitted while Activation_Sprint_Week is 1-4. Used by Week 3 sprint email to select celebration vs. encouragement framing. |
| Content_Week_Position | Integer 1-4 | Current position in the four-week content calendar. Incremented after each weekly standard cycle send. Rolls back to 1 after 4. Set to 1 on sprint graduation. |
| Engagement_Track | Picklist | Values: Sprint, Standard, Alternative, Dormant. Set to Sprint on activation. Set to Standard on Day 30 graduation. Updated by monthly non-referral check and dormant detection job. |
| Days_Since_Last_Referral | Integer (auto-calculated) | Calculated daily. Not counted during sprint period. |
| Alternative_Track_Entry_Date | Date | Written when ambassador moves to Alternative track. Used for content type rotation. |
| Alternative_Track_Month | Integer | Count of months since Alternative_Track_Entry_Date. Used to select content type. |
| Re_Engagement_Attempt | Integer 0-2 | Count of re-engagement emails sent. Begins counting after sprint graduation. |
| Escalated_To_Human | Checkbox | Set when ambassador reaches dormant Day 60 without re-engagement. |
| VIP_Score | Integer 0-100 | Calculated quarterly by VIP recalculation job. |
| VIP_Tier | Picklist | Values: Not VIP, Standard VIP, High VIP. Written quarterly. |
| VIP_Tier_Previous | Picklist | Stores prior quarter tier for upgrade detection. |
| VIP_Tier_Upgrade_Date | Date | Written when ambassador is upgraded to a higher tier. |
| Last_Engagement_Date | Date | Updated on each email open, click, or referral submission. Sprint days count toward this field normally. |
| Last_Story_File_Used | Text | Filename of most recently used story file for Week 2 standard calendar emails. |

# **10. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Token refresh fails | try/catch on token refresh | Halt current job. Alert Parmeet. Do not send partial emails. |
| Sprint Week 1 email fails to send | Zoho Mail API error on activation send | Retry once after 60 seconds. If retry fails: alert Parmeet. Log ambassador as Sprint_Week1_Failed in CRM. Sprint week advancement job will attempt Week 1 resend on Monday. |
| Sprint advancement fires but ambassador already at Week 4 | Activation_Sprint_Week = 4 AND sprint started less than 7 days ago | Do not advance. Do not graduate. Wait for next Monday advancement run when Day 30 threshold will be met. |
| Sprint graduation fires but Content_Week_Position already set | CRM field has non-null value | Overwrite to 1. Log the override. Sprint graduation always resets the standard cycle to Week 1. |
| No story files in Folder 05 buffer | getMostRecentStoryByCategory returns null | Use Claude-generated placeholder story. Alert Parmeet. |
| Claude generation fails for one ambassador | Claude API error | Skip that ambassador this cycle. Retry next cycle. Alert Parmeet if more than 5% of batch fails. |
| Email send fails for one ambassador | Zoho Mail API error | Retry once. If retry fails, mark ambassador for next cycle retry. |
| Weekly cycle does not complete within 60 minutes | Catalyst function timeout | Alert Parmeet with batch progress count. Complete remaining in next day's retry. |
| VIP recalculation fails mid-batch | Catalyst error | Roll back all tier changes for current batch. Alert Parmeet. Retain previous quarter's values. Retry next day. |
| Alternative track ambassador submits referral | CRM Referral record created | Move ambassador back to Standard track immediately. Reset Content_Week_Position to 1. |

# **11. Testing Protocol**

## **11.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Sprint initialization on activation | Fire Agent 2 activation webhook for test ambassador | Activation_Sprint_Week = 1, Engagement_Track = Sprint, Activation_Sprint_Start_Date = today. Sprint Week 1 email sent immediately. |
| Sprint Week 1 email content | Review generated Week 1 email for a test ambassador | Email confirms referral link is active. Introduces portal and community. Celebratory tone. No referral ask pressure. |
| Sprint week advancement — Week 1 to Week 2 | Set Activation_Sprint_Week = 1. Run Monday 8:00 AM advancement job | Activation_Sprint_Week = 2. Sprint Week 2 email sent. Content prompts one specific outreach. |
| Sprint week advancement — Week 2 to Week 3 | Set Activation_Sprint_Week = 2, Sprint_Referral_Submitted = false | Activation_Sprint_Week = 3. Week 3 email uses encouragement framing (no referral submitted yet). |
| Sprint Week 3 — referral already submitted | Set Activation_Sprint_Week = 2, Sprint_Referral_Submitted = true | Advancement to Week 3. Week 3 email uses celebration framing. |
| Sprint Week 4 advancement | Set Activation_Sprint_Week = 3 | Activation_Sprint_Week = 4. Week 4 email prompts 90-day goal reflection. Mission reconnection close. |
| Sprint graduation at Day 30 | Set Activation_Sprint_Week = 4 AND Activation_Sprint_Start_Date = 28+ days ago. Run advancement job | Activation_Sprint_Week = 0. Engagement_Track = Standard. Content_Week_Position = 1. Graduation email sent. |
| Standard cycle excludes sprint ambassadors | Set one ambassador Activation_Sprint_Week = 2. Run Monday 9:00 AM weekly cycle | Sprint ambassador does not receive standard weekly email. Only receives sprint advancement email at 8:00 AM. |
| Non-referral check excludes sprint ambassadors | Set Activation_Sprint_Week = 3 on test ambassador. Run monthly non-referral check | Ambassador excluded from Alternative track check regardless of days active or referral count. |
| Dormant detection excludes sprint ambassadors | Set Activation_Sprint_Week = 2. Set Last_Engagement_Date = 35 days ago. Run dormant detection | Ambassador not flagged as dormant. Sprint protection active. |
| 90-day non-referral threshold uses sprint graduation date | Set Activation_Sprint_Start_Date = 60 days ago. Activation_Sprint_Week = 0. Zero referrals. | Ambassador has been in Standard track for approximately 30 days (60 days total minus 30-day sprint). Not yet eligible for Alternative track. Threshold reached at 120 days from original activation. |
| Story selection by role category | Pre-tag story file K12 Educator. Set test ambassador Role_Category = K12 Educator. | K12-tagged story selected for Week 2 standard email. |
| VIP tier thresholds — under 10,000 population | Set active ambassador count to 5,000. | Top 2.5% = High VIP. Next 2.5% = Standard VIP. |
| High VIP personal outreach list filtered correctly | Set test ambassador VIP_Tier = Standard VIP, no referrals in 30 days. | Ambassador does NOT appear on High VIP personal outreach list. |
| No em dashes in any sprint or standard email | Review 20 Claude-generated emails across sprint weeks and standard calendar. | Zero em dashes found in any email body. |

## **11.2 Sprint Integration Test**

| **Sprint Integration Test Must Run Before Standard Cycle Test** Test the sprint in isolation before connecting the standard cycle. The sprint and standard cycle are separate populations and must be confirmed non-overlapping before any production ambassador is activated. |
| --- |

- Activate a test ambassador through Agent 2. Confirm Sprint Week 1 email arrives immediately.

- Confirm Activation_Sprint_Week = 1, Engagement_Track = Sprint, Activation_Sprint_Start_Date = today in CRM.

- Manually advance Activation_Sprint_Week to 2. Run Monday 9:00 AM standard cycle. Confirm sprint ambassador does NOT receive standard cycle email.

- Run Monday 8:00 AM sprint advancement. Confirm Sprint Week 2 email sent and Activation_Sprint_Week = 2.

- Set Sprint_Referral_Submitted = false. Advance to Week 3. Confirm encouragement framing in email.

- Set Sprint_Referral_Submitted = true. Re-run Week 3 generation. Confirm celebration framing in email.

- Advance to Week 4. Confirm 90-day goal reflection content and mission reconnection close.

- Set Activation_Sprint_Start_Date = 28 days ago. Run advancement job. Confirm graduation: Activation_Sprint_Week = 0, Engagement_Track = Standard, Content_Week_Position = 1. Graduation email sent.

- Run monthly non-referral check immediately after graduation with zero referrals. Confirm ambassador NOT moved to Alternative track (30 days in Standard, below 90-day threshold).

## **11.3 Acceptance Criteria**

- Sprint Week 1 email fires within 5 minutes of activation webhook

- Sprint advancement runs every Monday at 8:00 AM CST and completes before 9:00 AM CST standard cycle

- Sprint ambassadors never appear in standard cycle email batch

- Sprint graduation sets Activation_Sprint_Week = 0, Engagement_Track = Standard, Content_Week_Position = 1 in a single atomic update

- Week 3 email correctly detects Sprint_Referral_Submitted and applies correct framing

- 90-day non-referral threshold is calculated from sprint graduation date, not original activation date

- Dormant detection does not fire for ambassadors with Activation_Sprint_Week > 0

- Standard weekly cycle completes within 60 minutes for expected ambassador population

- Zero em dashes in any sprint or standard email content

# **12. Integration Notes for Other Developers**

## **12.1 What Agent 2 Developer Needs to Know**

- The Agent 2 activation webhook must fire for every ambassador who completes compliance, regardless of VIP status. Agent 3 initializes the sprint on this webhook. If the webhook does not fire, the sprint never starts and the ambassador enters the program with no engagement until the following Monday's standard cycle.

- Agent 2 does not set Activation_Sprint_Week. Agent 3 owns all sprint fields. Agent 2 fires the webhook and Agent 3 sets all sprint fields in response.

## **12.2 What Agent 6 Developer Needs to Know**

- Agent 3 reads story files from WorkDrive Folder 05 for Week 2 of the standard calendar. Sprint emails do not use story files. The story buffer is only consumed by the standard cycle. Sprint ambassadors do not deplete the Folder 05 buffer.

## **12.3 What Agent 4 Developer Needs to Know**

- Agent 4 reads the Engagement_Track field for reporting. The Sprint value must be counted separately from Standard in the ambassador health section of the weekly report. Sprint ambassador count is a meaningful leading indicator of future active ambassador growth.

- The Activation_Sprint_Week field can be used by Agent 4 to monitor sprint progression and alert Parmeet if sprint email failure rates are elevated.

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
| ANTHROPIC_API_KEY | Parmeet | Claude API key. Shared across agents. |
| HEYGEN_API_KEY | Parmeet | HeyGen API key for milestone videos only. |
| HEYGEN_AVATAR_ID | Parmeet | Dr. Flippen avatar ID in HeyGen. |
| WORKDRIVE_FOLDER_05_ID | Parmeet | WorkDrive Folder 05 ID for story files. |
| WORKDRIVE_FOLDER_08_ID | Parmeet | WorkDrive Folder 08 ID for brand assets. |
| AMBASSADORS_MODULE_API_NAME | Parmeet | Exact API name of the Ambassadors module in Zoho CRM. |
| REFERRALS_MODULE_API_NAME | Parmeet | Exact API name of the Referrals module in Zoho CRM. |
| SPRINT_GRADUATION_DAYS | Parmeet | Days from Activation_Sprint_Start_Date before graduation fires. Default: 28. Parmeet can adjust without developer assistance. |
| NON_REFERRAL_DAYS_THRESHOLD | Parmeet | Days active (post-sprint) before non-referral check applies. Default: 90. |
| DORMANT_DAYS_THRESHOLD | Parmeet | Days of inactivity (post-sprint) before dormant detection fires. Default: 30. |
| VIP_POPULATION_THRESHOLD | Parmeet | Active ambassador count triggering shift to large-population tier percentages. Default: 10000. |
| VIP_HIGH_PCT_SMALL | Parmeet | High VIP percentage band when population under threshold. Default: 2.5 |
| VIP_STD_PCT_SMALL | Parmeet | Standard VIP percentage band when population under threshold. Default: 5 |
| VIP_HIGH_PCT_LARGE | Parmeet | High VIP percentage band when population at or above threshold. Default: 0.5 |
| VIP_STD_PCT_LARGE | Parmeet | Standard VIP percentage band when population at or above threshold. Default: 2.5 |
| STORY_BUFFER_MINIMUM | Parmeet | Minimum story files before alert fires. Default: 4. |
| MAKE_AGENT3_REFERRAL_WEBHOOK | Developer | Make.com webhook URL for referral notification trigger. |
| MAKE_AGENT3_ERROR_WEBHOOK | Developer | Make.com webhook URL for all Agent 3 error alerts. |
| PARMEET_ALERT_EMAIL | Parmeet | Email for all Agent 3 error and content alerts. |
| VIP_MANAGER_EMAIL | Parmeet | VIP relationship manager email for personal outreach list delivery. |
| WEEKLY_BATCH_SIZE | Developer | Ambassadors processed per concurrent batch in weekly cycle. Default: 100. |

| **NOTE** SPRINT_GRADUATION_DAYS defaults to 28 — this fires the graduation job on the Monday of Week 4 that falls after the 28th day from activation. Parmeet can adjust this without developer assistance. Setting it lower shortens the sprint; setting it higher extends it. Do not set it below 21 (three full weeks) or the sprint emails will overlap incorrectly. |
| --- |
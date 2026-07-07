**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 0 of 9

**Research and Intelligence Agent**

*Prospect profiling, VIP Prospect Pipeline, social listening,*

*motivation intelligence, gap reporting, and influencer cultivation briefings*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Developer 0 stores all credentials as Zoho Catalyst environment variables. No credential is hardcoded. All API calls use environment variables only.

| **HARD STOP** Do not begin development until Parmeet has provided all credentials in the table below and confirmed that WorkDrive Folders 07, 08, and 09 exist and are accessible. Development blocked on credential delivery. |
| --- |

| **Tool** | **Purpose** | **Required Scopes / Notes** |
| --- | --- | --- |
| Zoho CRM | Read and write Prospects module, Ambassadors module | ZohoCRM.modules.ALL, ZohoCRM.settings.READ |
| Zoho WorkDrive | Read brand asset files from Folder 08; write briefing docs to Folder 09; write gap reports to Folder 07 | WorkDrive.files.READ, WorkDrive.files.CREATE |
| Zoho Flow | Trigger downstream Make.com webhooks | ZohoFlow.flows.EXECUTE |
| Claude API (Anthropic) | Prospect assessment, motivation scoring, VIP briefing document generation | API key only. Parmeet provides. |
| Ayrshare (via Make.com) | Social listening data feed for non-email audiences | Configured in Make.com. No direct API call from Agent 0 code. |
| Make.com Webhooks | Trigger Agent 1A-1D recruiting agents; send VIP notifications; on-demand prospect research | Webhook URLs stored as Catalyst environment variables |
| Apollo.io (Phase 2) | Email enrichment for non-educator audiences if gap report confirms need at Day 60 review | Not activated at launch. API key stored but not called. |
| Hunter.io (Phase 2) | Secondary email enrichment fallback | Not activated at launch. API key stored but not called. |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 0 is the intelligence layer that makes every other agent smarter. It runs on a weekly Sunday night schedule and on demand. It profiles prospects from public data, scores each for mission alignment and VIP Prospect threshold, generates briefing documents for high-value influencer and advocate prospects, builds motivation hypotheses for non-email audiences, and reports gaps for future enrichment decisions. No recruiting agent sends a message without Agent 0 data behind it.

## **2.2 Position in the System**

|  | **Feeds Into** | **Fed By** |
| --- | --- | --- |
| Agent 0: Research and Intelligence | Agent 1A (email sequences), Agent 1B (social outreach), Agent 1C (paid ads), Agent 1D (lead capture), Agent 2 (VIP flag on application), Human VIP Relationship Manager (briefing documents), Human Coordinator (VIP Prospect pipeline alerts) | Public web research, social platform data, Zoho CRM existing prospect records, WorkDrive brand assets |

## **2.3 What Agent 0 Does Not Do**

| **Agent 0 Does NOT** | **Reason** |
| --- | --- |
| Contact prospects directly | All outreach is handled by Agents 1A through 1D or by the human relationship manager |
| Use paid enrichment tools at launch | Apollo.io and Hunter.io are configured but dormant. Day 60 gap report determines whether to activate. |
| Access private student or applicant records | Agent 0 operates entirely on public data and CRM prospect records |
| Make spend decisions | Ad targeting intelligence is advisory only. Agent 1C owns all spend decisions with human coordinator checkpoint. |
| Replace human judgment for VIP Prospects | Agent 0 identifies and briefs. Humans cultivate. The pipeline handoff is non-negotiable. |

## **2.4 Run Cycle**

- Weekly run: Every Sunday at 11:00 PM CST. Processes all new prospect discoveries from the week's social listening and web research queue. Results available to recruiting agents by Monday morning.

- On-demand run: Triggered by Parmeet or the coordinator via Make.com dashboard. Accepts a single public profile URL. Useful for researching a specific influencer or community leader before personal outreach begins.

- Day 60 review: Parmeet reviews the accumulated gap reports to determine whether Apollo.io or Hunter.io should be activated for email enrichment of non-educator prospects.

# **3. VIP Prospect Pipeline**

The VIP Prospect Pipeline is the mechanism by which Agent 0 identifies high-value influencers and advocates and routes them away from automated outreach and into human relationship cultivation. This is the most important new function in Agent 0 Version 2.0.

| **Critical Rule** When a prospect is flagged as a VIP Prospect, automated outreach from Agents 1B and 1C is suppressed for that individual. The human relationship manager owns all contact. Automated messages to a VIP Prospect are a relationship risk and are not permitted under any circumstances. |
| --- |

## **3.1 VIP Prospect Scoring Criteria**

Agent 0 scores every profiled prospect on three dimensions. The score determines whether the prospect enters the VIP Prospect Pipeline or is routed to the standard recruiting agents.

| **Scoring Dimension** | **Criteria and Point Allocation** |
| --- | --- |
| Audience Reach (0-40 points) | 40 pts: 50,000+ followers or subscribers across any platform. 30 pts: 20,000-49,999. 20 pts: 10,000-19,999. 10 pts: 5,000-9,999. 0 pts: under 5,000. |
| Organizational Influence (0-30 points) | 30 pts: Leads a network, association, or organization with 500+ members. 20 pts: Leads a community of 100-499 members. 10 pts: Active leadership role in a recognized organization. 0 pts: Individual contributor with no organizational leadership. |
| Mission Alignment (0-30 points) | 30 pts: Content or stated mission directly addresses education access, vulnerable children, teacher development, or faith-based education. 20 pts: Adjacent mission (childcare, youth ministry, literacy). 10 pts: General educator or family advocate. 0 pts: No clear mission alignment. |
| VIP Prospect Threshold | Total score of 60 or above triggers VIP Prospect flag. Briefing document generated. Human relationship manager notified. Prospect enters the VIP Prospect Pipeline. Automated outreach from Agents 1B and 1C is suppressed for this prospect. |

## **3.2 VIP Prospect Pipeline Stages**

Once a prospect is flagged as a VIP Prospect, the human relationship manager owns the relationship through five defined stages. Agent 0's role ends after delivering the briefing document and CRM record. The pipeline stages are tracked in Zoho CRM.

| **Stage** | **Duration** | **Human Coordinator Action** |
| --- | --- | --- |
| Stage 1: Warm Follow | 2-3 weeks | Follow the prospect on all active platforms. Engage genuinely with their content. Like, comment thoughtfully, share where appropriate. No ask yet. Goal: become a familiar, positive presence in their feed. |
| Stage 2: Personal Outreach | 1 week | Send a personal message. Not a template. Reference something specific about their recent work. Introduce Gracelyn's mission briefly. Express genuine alignment between their work and Gracelyn's purpose. No ambassador ask in this message. |
| Stage 3: Ambassador Invitation | 1 week | If Stage 2 receives a positive response, extend the ambassador invitation. Frame it as a mission partnership, not a referral program. Offer a personal call to answer questions. Emphasize that they will have a dedicated point of contact throughout. |
| Stage 4: VIP Onboarding | Ongoing | Prospects who accept go directly to VIP Ambassador onboarding in Agent 2. They receive a personal call rather than automated compliance reminders, white-glove welcome kit, and are flagged in CRM as VIP_Prospect_Origin = true. |
| Stage 5: No Response / Decline | N/A | If Stage 2 receives no response after 7 days, one gentle follow-up only. If declined, mark CRM status as Prospect_Declined. Do not re-approach for 12 months. Log the decline reason if shared. |

## **3.3 VIP Prospect Briefing Document**

Agent 0 generates a plain text briefing document for every VIP Prospect. The document is saved to WorkDrive Folder 09 and a link is delivered to the VIP Relationship Manager by email. The briefing document contains the following sections.

| **Briefing Section** | **Content** |
| --- | --- |
| WHO THIS IS | Two sentences: prospect name, role, organization, and primary platform. |
| AUDIENCE AND REACH | Platform(s), estimated follower or subscriber count, content cadence, and engagement quality assessment. |
| WHY THEY ARE A FIT | Specific mission alignment evidence. Reference their actual content or stated values. One to three sentences. |
| THEIR MOST RESONANT RECENT CONTENT | Title or description of their highest-performing recent post, video, or article. Why it matters for the outreach framing. |
| SUGGESTED FIRST-TOUCH APPROACH | Specific recommendation for Stage 2 personal outreach. What to reference, what angle to take, what NOT to say. Tailored to this person. |
| POTENTIAL CONCERNS | Any flags: competing partnerships, politically sensitive content, past brand controversies, or audience misalignment risks. |
| CRM RECORD LINK | Direct URL to the prospect record in Zoho CRM for the relationship manager's reference. |

| **NOTE** Briefing documents are written by Claude API using the VIP Briefing system prompt. The system prompt instructs Claude to write in Gracelyn's voice, never use em dashes, never say commission (always referral fee), and produce a document a human can act on immediately without additional research. |
| --- |

## **3.4 CRM Fields for VIP Prospect Pipeline**

- VIP_Prospect: Boolean. True if prospect scored 60 or above. Written at Step 8 of the run cycle.

- VIP_Prospect_Score: Numeric. Total score across all three dimensions. Written at Step 8.

- VIP_Prospect_Pipeline_Stage: Picklist. Values: Warm Follow, Personal Outreach, Ambassador Invitation, VIP Onboarding, Declined, Inactive. Updated by human coordinator as relationship progresses.

- VIP_Prospect_Origin: Boolean. Written to Ambassador record when a VIP Prospect converts to active ambassador. Signals white-glove treatment in Agent 2 and Agent 3.

- Prospect_Declined_Date: Date. Written when coordinator marks a prospect as declined. Prevents re-approach for 12 months.

# **4. Standard Prospect Functions**

Prospects who do not meet the VIP Prospect threshold are processed through the standard pipeline: profile building, Claude assessment, CRM upsert, and recruiting agent routing.

| **Function** | **How It Works** | **Output** |
| --- | --- | --- |
| Web research and public profile building | Searches public social profiles, websites, bio pages, media kits, church staff directories, organization websites, and podcast pages to build prospect profiles without paid enrichment tools at launch | Prospect profile record in Zoho CRM with name, role, organization, contact info found, audience size estimate, content themes, and mission alignment indicators |
| Social listening | Monitors conversations in educator Facebook groups, LinkedIn educator communities, homeschool forums, Christian parenting communities, and foster care advocacy groups to identify organically motivated prospects | Prospect list enriched with community engagement data and conversation context that feeds message personalization for recruiting agents |
| Standard prospect scoring | Scores every profiled prospect on mission alignment and organizational influence. Routes to standard recruiting agents unless VIP Prospect threshold is met. | Motivation Tag and Role Category written to CRM prospect record. Recruiting agent webhook fired for standard prospects. |
| VIP Prospect scoring and pipeline entry | Scores every profiled prospect on all three dimensions: audience reach, organizational influence, and mission alignment. Prospects scoring 60 or above are flagged as VIP Prospects. Automated outreach is suppressed. Briefing document is generated and delivered to human relationship manager. | VIP_Prospect flag on CRM record. Briefing document saved to WorkDrive Folder 09. Coordinator notification sent. Prospect enters VIP Prospect Pipeline and is NOT passed to recruiting agents. |
| Motivation hypothesis testing | Tracks organic content engagement across audience types before outreach begins. Compares engagement rates by audience category and motivation frame to validate assumptions before Agent 3 builds segmented content tracks. | Motivation hypothesis data written to CRM audience intelligence fields. Fed to Agent 3 at Day 90 to inform segmented content track build. |
| Gap report generation | Identifies prospects where public research found no usable contact information. Compiled weekly and saved to WorkDrive Folder 07. | Plain text gap report with prospect name, source channel, gap type, and enrichment recommendation. Reviewed by Parmeet at Day 60 to determine whether Apollo.io or Hunter.io should be activated. |

# **5. Target Populations**

Agent 0 profiles prospects across all of the following categories. The Role_Category field written to CRM is used by Agent 1A for email segmentation, by Agent 3 for story selection, and by Agent 6 for content tagging.

| **Category** | **Included Populations** | **Primary Motivation Frame to Test** |
| --- | --- | --- |
| K-12 education professionals | Classroom teachers all grades and subjects, instructional coaches, curriculum specialists, literacy coaches, school counselors, social workers, school psychologists, special education staff, interventionists, school librarians, school nurses, speech-language pathologists, paraprofessionals and support staff | Professional identity and growth. Being recognized as a professional. Credentials, badges, and PD that have career value. |
| Early childhood and childcare | Childcare workers, daycare directors, Head Start staff, early childhood educators, pre-K teachers, childcare co-op organizers | Recognition and belonging. Chronically undervalued workforce. Mission frame: your work matters for vulnerable children. |
| Faith and community | Youth pastors, children's ministry directors, Sunday school teachers, Christian school teachers, homeschool co-op leaders, church education directors, mission organization volunteers | Kingdom impact and calling. Not career. Frame: what God is doing through teachers who love children. |
| Youth-serving professionals | Boys and Girls Club staff, Big Brothers Big Sisters staff, YMCA youth coordinators, after-school program staff, tutors, learning center employees, foster care advocates, child welfare workers, family service coordinators | The problem being solved. These audiences care about vulnerable children first. Mission frame only. |
| Mission-aligned influencers and advocates | Education content creators, homeschool influencers, Christian parenting bloggers, foster care and adoption advocates, literacy advocates, educational equity advocates, rural and underserved community advocates | Audience trust and alignment. They will only promote what their audience would thank them for. VIP Prospect track only. Never automated outreach. |
| Gracelyn community | Current students, alumni, program completers | Pride and gratitude. Paying it forward. The referral fee is secondary to the mission ask. |
| Excluded | Principals, assistant principals, superintendents, district administrators, department heads | Excluded. Conflict of interest risk when recommending Gracelyn to staff they supervise. |

# **6. Run Cycle: Step-by-Step Process**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Token refresh | Refresh all OAuth tokens: Zoho CRM, Zoho WorkDrive, Zoho Flow. If any token refresh fails, halt the run and send Parmeet an alert. Do not proceed with stale credentials. |
| 2 | Read brand assets | Fetch voice guidelines and mission statement from WorkDrive Folder 08. Both files required. If either is missing, halt the run and alert Parmeet. |
| 3 | Parse audience config | Read AGENT0_AUDIENCE_CONFIG environment variable. This JSON defines which communities to monitor, which social channels to search, and which role categories to prioritize this run. Parmeet updates this config without touching code. |
| 4 | Query existing prospects | Pull all existing prospect records from Zoho CRM Prospects module. Build a deduplication index keyed on Social_Profile_URL to avoid re-researching known contacts. |
| 5 | Prospect discovery | For each audience category in the config, execute public web research and social listening. Build raw prospect objects for each new contact found. Skip any prospect whose Social_Profile_URL matches the deduplication index. |
| 6 | Profile building | For each raw prospect, attempt to find public contact information: email address, website, organization page. Write all found data to the prospect profile object. Flag contacts where no email was found for the gap report. |
| 7 | Claude assessment | Pass each prospect profile to Claude API for mission alignment scoring, motivation hypothesis, and role category classification. Parse JSON response. Apply safe defaults if parse fails. |
| 8 | VIP Prospect scoring | Calculate total VIP Prospect score across three dimensions: audience reach (0-40), organizational influence (0-30), mission alignment (0-30). If total score is 60 or above: set VIP_Prospect = true, suppress recruiting agent routing, proceed to Step 9. If below 60: proceed to Step 11. |
| 9 | VIP briefing generation | For VIP Prospects only. Generate plain text briefing document using Claude API with VIP Briefing system prompt. Save to WorkDrive Folder 09 with filename: VIP_Brief_[ProspectName]_[YYYY-MM-DD].txt. Fire VIP notification webhook to Make.com. |
| 10 | CRM upsert | Write prospect record to Zoho CRM Prospects module. Use Social_Profile_URL as the deduplication key. Update existing records rather than creating duplicates. Write all scored fields: Motivation_Tag, Role_Category, Mission_Alignment_Score, VIP_Prospect flag, VIP_Prospect_Score. |
| 11 | Standard routing | For non-VIP prospects with a usable email address: fire recruiting agent trigger webhook to Make.com. Make.com routes to Agent 1A for email outreach. Prospects without an email address are written to CRM with Gap_Type = No_Email and included in the gap report. |
| 12 | Gap report generation | Compile all prospects flagged with gap types this run. Save gap report to WorkDrive Folder 07 with filename: Agent0_Gap_Report_[YYYY-MM-DD].txt. Gap types include: No_Email, No_Public_Profile, Parse_Error, Low_Mission_Alignment. |
| 13 | Recruiting agent trigger | Fire the consolidated recruiting agent webhook to Make.com signaling that this run's prospects are ready. Make.com coordinates handoff to Agents 1A, 1B, 1C, and 1D in parallel. |

# **7. Claude API Prompts**

## **7.1 Prospect Assessment System Prompt**

Used in Step 7. Instructs Claude to score each prospect and return structured JSON only. Max tokens: 500.

| function buildAssessmentSystemPrompt() {   return `You are a prospect assessment engine for the Gracelyn University Ambassador Program. Score this prospect and return valid JSON only. No preamble. No markdown. No explanation. Return only the JSON object. Required JSON fields: {   "motivationHypothesis": string (one of: Professional Growth, Mission Impact,                            Kingdom Calling, Problem Solver, Community Recognition),   "motivationRationale": string (one sentence explaining the hypothesis),   "roleCategory": string (one of: K12 Educator, Early Childhood, Faith Community,                    Youth Serving Professional, Mission Aligned Influencer, Gracelyn Community),   "missionAlignmentScore": number (0-30),   "orgInfluenceScore": number (0-30),   "notes": string (any flags or concerns for human review, or empty string) } Scoring rules: missionAlignmentScore: 30 if content directly addresses education access, vulnerable children, teacher development, or faith-based education. 20 if adjacent mission. 10 if general educator or family advocate. 0 if no clear alignment. orgInfluenceScore: 30 if leads a network or association with 500+ members. 20 if leads a community of 100-499. 10 if active leadership role. 0 if individual contributor only. Never use em dashes. Never say commission. Always say referral fee.`; } |
| --- |

## **7.2 VIP Briefing System Prompt**

Used in Step 9 for VIP Prospects only. Instructs Claude to write a human-actionable briefing document in Gracelyn voice. Max tokens: 800. Plain text output, not JSON.

| function buildVIPBriefingSystemPrompt(voiceGuidelinesAsset) {   return `You are writing a VIP Prospect Briefing Document for the Gracelyn University Ambassador Program VIP Relationship Manager. This document will be used by a human to prepare for personal outreach to a high-value ambassador prospect. Write in a professional, warm, and mission-aligned tone consistent with Gracelyn voice guidelines. GRACELYN VOICE GUIDELINES: ${voiceGuidelinesAsset} Required sections: WHO THIS IS │ AUDIENCE AND REACH │ WHY THEY ARE A FIT │ THEIR MOST RESONANT RECENT CONTENT │ SUGGESTED FIRST-TOUCH APPROACH │ POTENTIAL CONCERNS │ CRM RECORD LINK Rules: - Never use em dashes - Never say commission. Always say referral fee. - Write every section so the relationship manager can act immediately - Be specific. Generic observations are not useful. - Flag any concerns honestly. Do not oversell a prospect.`; } |
| --- |

# **8. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Weekly Run Schedule | Every Sunday at 11:00 PM CST via Make.com scheduled trigger | Fires Agent 0 Catalyst function. Monitors for completion webhook. Logs run status to Zoho Analytics. |
| Scenario 2: VIP Prospect Notification | VIP notification webhook from Agent 0 Catalyst function | Step 1: Send briefing document link to VIP Relationship Manager email. Step 2: Create VIP Prospect Pipeline record in Zoho CRM with Stage = Warm Follow. Step 3: Send coordinator dashboard alert. Step 4: Add prospect to VIP Prospect tracking view in CRM. |
| Scenario 3: Recruiting Agent Trigger | Recruiting trigger webhook from Agent 0 Catalyst function | Fires Agent 1A, 1B, 1C, and 1D webhooks in parallel. Passes run summary including prospect counts by role category and channel. |
| Scenario 4: On-Demand Single Prospect | Manual trigger by Parmeet or coordinator via Make.com dashboard | Accepts a single public profile URL as input. Runs full Agent 0 pipeline for that one prospect. Useful for researching a specific influencer or community leader before outreach. |

# **9. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| OAuth token refresh fails | try/catch on token refresh call | Halt run. Send Parmeet alert email with token name and error. Do not attempt any downstream API calls. |
| WorkDrive brand asset missing | File not found on WorkDrive Folder 08 fetch | Halt run. Send Parmeet alert. Brand assets are required for Claude prompts. |
| AGENT0_AUDIENCE_CONFIG missing or malformed | JSON parse error on env variable read | Halt run. Send Parmeet alert with parse error detail. |
| Claude API returns non-JSON response | JSON parse fails on assessment response | Apply safe defaults. Log raw response to WorkDrive. Continue processing remaining prospects. Include parse error count in gap report. |
| VIP score calculated but briefing generation fails | Claude API error on briefing call | Retry once after 30 seconds. If second attempt fails, write VIP flag to CRM, send Parmeet alert with prospect name, add to manual briefing queue. Do not suppress VIP flag. |
| CRM upsert fails for a prospect | Zoho CRM API error response | Log failed record locally. Retry at end of run. If retry fails, include in error report to Parmeet. |
| VIP notification webhook fails | Make.com webhook returns non-200 | Retry once. If retry fails, send Parmeet direct alert email with prospect name and VIP score. Human follow-up required. |
| Recruiting agent webhook fails | Make.com webhook returns non-200 | Retry once after 60 seconds. If retry fails, send Parmeet alert. Recruiting agents will not receive this run's prospects until resolved. |
| Gap report save fails | WorkDrive API error on file write | Log gap data locally. Retry once. If retry fails, email gap report content directly to Parmeet as plain text. |
| Duplicate prospect detected | Social_Profile_URL match in deduplication index | Skip prospect. Log as duplicate in run summary. Do not create second CRM record. |
| Run exceeds 4 hours | Catalyst function timeout threshold | Send Parmeet alert mid-run. Complete prospects already processed. Log incomplete run. Schedule retry for remaining prospects. |

## **9.1 Parmeet Alert Email Format**

| Subject: [Agent 0 Alert] {Error Type} — {YYYY-MM-DD} Agent 0 encountered an error during the {scheduled/on-demand} run. Error type: {token refresh failure / asset missing / webhook failure / etc} Time: {HH:MM CST} Affected prospect: {name if applicable, or N/A} Error detail: {specific error message} Action required: {what Parmeet needs to do} This alert was generated automatically by Agent 0. Contact your developer if the error repeats after corrective action. |
| --- |

# **10. Testing Protocol**

## **10.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Token refresh | Call token refresh functions individually | All three tokens return successfully. No alert email fires. |
| Brand asset read | Call WorkDrive fetch with Folder 08 path | Both asset files returned as strings. No halt triggered. |
| Audience config parse | Set AGENT0_AUDIENCE_CONFIG to valid JSON and call parse function | Config object returned with expected fields. No error. |
| Deduplication | Call upsertProspectRecord() with a prospect URL already in CRM | Existing record updated. No duplicate record created. |
| Standard prospect assessment | Pass a mock educator prospect to Claude API | Valid JSON returned with all required fields: motivationHypothesis, missionAlignmentScore, orgInfluenceScore, roleCategory. |
| VIP Prospect scoring below threshold | Mock prospect with audience reach 10 pts, influence 15 pts, alignment 20 pts (total 45) | VIP_Prospect = false. Prospect routed to recruiting agents. No briefing generated. No VIP notification fired. |
| VIP Prospect scoring above threshold | Mock prospect with audience reach 40 pts, influence 20 pts, alignment 30 pts (total 90) | VIP_Prospect = true. Briefing document generated and saved to WorkDrive Folder 09. VIP notification webhook fires. Prospect NOT passed to recruiting agents. |
| VIP briefing document generation | Call generateVIPBriefing() with a mock VIP prospect | Plain text briefing file appears in WorkDrive Folder 09 with correct filename format VIP_Brief_[Name]_[YYYY-MM-DD].txt. |
| Gap report generation | Call generateGapReport() with mock prospects including no-email gaps | Plain text gap report appears in WorkDrive Folder 07 with correct date filename. |
| Claude parse failure safe defaults | Pass malformed JSON as Claude response to parser | Safe default object returned. Error logged. Processing continues. |
| VIP notification retry | Simulate webhook failure on first attempt | Retry fires after 30 seconds. If retry also fails, Parmeet receives direct alert email. |
| Recruiting agent webhook | Call triggerRecruitingAgents() with mock run summary | Make.com Scenario 3 receives webhook and returns HTTP 200. |
| On-demand single prospect | Trigger Make.com Scenario 4 with a known public educator LinkedIn URL | Full pipeline runs for that single prospect. CRM record created. Gap report or briefing generated as appropriate. |

## **10.2 Integration Test**

After all unit tests pass, run a full end-to-end integration test with Parmeet present before activating the weekly schedule.

- Confirm WorkDrive Folder 08 contains both brand asset files

- Confirm AGENT0_AUDIENCE_CONFIG is populated with at least two audience categories

- Confirm VIP_PROSPECT_SCORE_THRESHOLD is set in Catalyst environment variables

- Confirm WORKDRIVE_FOLDER_09 exists and is writable

- Manually trigger the on-demand scenario with a known public educator profile URL

- Verify Claude API receives prospect data and returns valid JSON assessment

- Verify VIP score is calculated correctly for the test prospect

- Verify CRM prospect record created with all fields populated including Role_Category and Motivation_Tag

- If test prospect is VIP: verify briefing document appears in WorkDrive Folder 09 with correct filename

- If test prospect is VIP: verify VIP manager notification email is sent and pipeline record created in CRM

- If test prospect is VIP: verify recruiting agent webhook does NOT fire

- If test prospect is not VIP: verify recruiting agent webhook fires

- Verify gap report generated in WorkDrive Folder 07

- Verify Parmeet receives no error alert emails indicating a clean run

## **10.3 Acceptance Criteria**

Parmeet signs off on Agent 0 as complete when all of the following are confirmed.

- Weekly schedule fires Sunday at 11:00 PM CST without manual intervention

- On-demand scenario accepts a single URL and returns a complete CRM record within 10 minutes

- VIP Prospect scoring correctly flags prospects at or above the threshold and suppresses recruiting agent routing

- VIP briefing documents appear in WorkDrive Folder 09 within 5 minutes of VIP flag being set

- VIP Relationship Manager receives notification email within 5 minutes of briefing document creation

- Standard prospects are correctly routed to recruiting agent webhook

- Gap report appears in WorkDrive Folder 07 after every run

- No duplicate CRM records created across three consecutive test runs

- All error scenarios tested and alerts confirmed delivered to Parmeet

- Parmeet confirms she can update AGENT0_AUDIENCE_CONFIG without developer assistance

# **11. Integration Notes for Downstream Developers**

## **11.1 What Agents 1A, 1B, 1C, and 1D Receive from Agent 0**

- Every prospect passed to recruiting agents has a Role_Category field. Use this for segmentation. Do not assume role from email domain or name.

- Every prospect has a Motivation_Tag field. Use this to select the correct message frame. Do not override with assumptions.

- Prospects with VIP_Prospect = true will never appear in the recruiting agent webhook payload. They are handled exclusively by the human relationship manager.

- Prospects with Gap_Type = No_Email will appear in the CRM but not in the recruiting email webhook. Agent 1B social outreach may still reach them if a social profile URL is present.

## **11.2 What Agent 2 Receives from Agent 0**

- Ambassador applications originating from VIP Prospect Pipeline will have VIP_Prospect_Origin = true on the Ambassador record. Agent 2 must route these to the VIP onboarding track regardless of auto-approve status.

- VIP_Prospect_Origin ambassadors receive a personal call from the coordinator, not automated compliance reminders. Agent 2 must suppress the standard compliance reminder sequence for this flag.

## **11.3 What Agent 3 Receives from Agent 0**

- Role_Category on the Ambassador record is set by Agent 0 at prospect stage and carried through to the Ambassador record at onboarding. Agent 3 uses Role_Category for story selection. Do not overwrite this field.

- Motivation_Tag on the Ambassador record informs Agent 3 content frame selection. This field is set by Agent 0 and refined at onboarding survey. Agent 3 reads but does not write this field.

# **12. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID for Zoho CRM |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho CRM |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho CRM |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for Zoho WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho WorkDrive |
| WORKDRIVE_FOLDER_07 | Parmeet | WorkDrive Folder 07 ID for analytics and gap reports |
| WORKDRIVE_FOLDER_08 | Parmeet | WorkDrive Folder 08 ID for brand assets |
| WORKDRIVE_FOLDER_09 | Parmeet | WorkDrive Folder 09 ID for VIP prospect briefings |
| ANTHROPIC_API_KEY | Parmeet | Claude API key from Anthropic console |
| AGENT0_AUDIENCE_CONFIG | Parmeet | JSON string defining audience categories, social channels, and role priorities. Parmeet updates without touching code. |
| VIP_PROSPECT_SCORE_THRESHOLD | Parmeet | Numeric threshold for VIP Prospect flag. Default: 60. Parmeet may adjust after first 90-day review. |
| MAKE_VIP_NOTIFICATION_WEBHOOK | Developer | Make.com webhook URL for Scenario 2 VIP notification |
| MAKE_RECRUITING_TRIGGER_WEBHOOK | Developer | Make.com webhook URL for Scenario 3 recruiting agent trigger |
| PARMEET_ALERT_EMAIL | Parmeet | Email address for all Agent 0 error and alert notifications |
| VIP_RELATIONSHIP_MANAGER_EMAIL | Parmeet | Email address of the VIP relationship manager who receives briefing document notifications |
| APOLLO_API_KEY | Parmeet | Apollo.io API key. Stored but not called at launch. Activated at Day 60 if gap report warrants it. |
| HUNTER_API_KEY | Parmeet | Hunter.io API key. Stored but not called at launch. Secondary enrichment fallback. |
| AGENT0_RUN_MODE | Developer | Values: WEEKLY (default), ON_DEMAND. Controls which code path executes on trigger. |

| **NOTE** All environment variables are set by Parmeet in the Zoho Catalyst console before development begins on any agent. Developer 0 coordinates with Parmeet on the variable list above. No variable is hardcoded in any file. |
| --- |
**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 1B of 9

**Social Outreach Agent**

*Organic social posting, community monitoring, educator prospecting,*

*and VIP Prospect Pipeline support for human relationship cultivation*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store all credentials as Zoho Catalyst environment variables. No credential is hardcoded in any file.

| **HARD STOP** Do not begin development until Parmeet has provided all credentials listed below and confirmed that WorkDrive Folders 02, 07, 08, and 09 exist and are accessible. Development is blocked on credential delivery. |
| --- |

| **Tool / Platform** | **Credential Required** | **Notes** | **Obtain From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.CREATE, ZohoCRM.modules.UPDATE | Read Prospects and Ambassadors. Write new prospect records. Write Social Post Log records. | Parmeet |
| Zoho Social | API access token and Portal ID. Scopes: ZohoSocial.streams.READ, ZohoSocial.profiles.READ | Read-only. Used for engagement monitoring only. No posting via Zoho Social. Confirm connected platforms with Parmeet. | Parmeet |
| Ayrshare API | Static API key | Used for all social posting to LinkedIn, Facebook, and Instagram. Posting permissions for all three platforms required. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ | Read Folder 02 (Approved Content), Folder 07 (Gap Reports), Folder 08 (Brand Assets), Folder 09 (VIP Briefings — read only). | Parmeet |
| Zoho Catalyst | CLI credentials and project access | Full developer access to deploy serverless functions. | Parmeet |
| Claude API (Anthropic) | API key. Model: claude-sonnet-4-20250514 | Caption generation and VIP Prospect pipeline support tasks. Pay per use. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build the weekly post schedule scenario and the VIP pipeline CRM update scenarios. | Parmeet |
| Facebook Graph API | Read-only access token | Community monitoring only. No posting via Graph API. All posting through Ayrshare. | Parmeet |
| LinkedIn API | Read-only access token | Community monitoring only. All posting through Ayrshare. | Parmeet |

## **1.1 Authentication Code**

All Zoho API calls use OAuth 2.0 with the token refresh pattern. Ayrshare uses a static API key. Zoho Social uses its own OAuth token for read-only monitoring.

| async function getZohoAccessToken(refreshToken, clientId, clientSecret) {   const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {     method: 'POST',     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },     body: new URLSearchParams({       refresh_token: refreshToken,       client_id:     clientId,       client_secret: clientSecret,       grant_type:    'refresh_token'     })   });   const data = await response.json();   if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));   return data.access_token; } // Refresh all Zoho tokens at function start const crmToken       = await getZohoAccessToken(   process.env.ZOHO_CRM_REFRESH_TOKEN,   process.env.ZOHO_CRM_CLIENT_ID,   process.env.ZOHO_CRM_CLIENT_SECRET ); const workdriveToken = await getZohoAccessToken(   process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN,   process.env.ZOHO_WORKDRIVE_CLIENT_ID,   process.env.ZOHO_WORKDRIVE_CLIENT_SECRET ); // Zoho Social token: read-only, used for monitoring only (not posting) const socialToken    = process.env.ZOHO_SOCIAL_ACCESS_TOKEN; // Ayrshare: static API key, no refresh needed const ayrshareKey    = process.env.AYRSHARE_API_KEY; |
| --- |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 1B manages Gracelyn's organic social presence across LinkedIn, Facebook, and Instagram. It does three things: it posts prescribed recruiting content on a weekly schedule; it monitors educator and mission-aligned communities for prospecting signals; and it supports the VIP Prospect Pipeline by surfacing timely engagement context for the human relationship manager.

Agent 1B does not send direct messages to any individual. It posts public content, monitors communities, writes prospecting intelligence to CRM, and creates coordinator alerts. All direct outreach is handled by Agent 1A via email or by the human relationship manager for VIP Prospects.

| **VIP Prospect Rule** Prospects flagged as VIP_Prospect = true in Zoho CRM must never receive automated outreach or direct messages from Agent 1B. Agent 1B posts public content that VIP Prospects may encounter organically. It does not target them. If Agent 1B discovers a VIP-flagged account during community monitoring, it suppresses all outreach actions for that account immediately. |
| --- |

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Agent 0 weekly complete | Agent 0 Scenario 3 fires a webhook to all four recruiting sub-agents after its Sunday night run. Agent 1B reads the channel intelligence from WorkDrive Folder 07 to prioritize which communities to monitor that week. |
| TRIGGERED BY | Make.com weekly post schedule | A separate Make.com scenario runs every Tuesday and Thursday at 10:00 AM CST to post prescribed social content via Ayrshare. |
| READS FROM | WorkDrive Folder 02 | Approved social content assets ready for Ayrshare posting. Parmeet manages this folder. |
| READS FROM | WorkDrive Folder 07 | Agent 0 gap report and channel intelligence. Agent 1B reads the most recent report to identify priority communities for monitoring. |
| READS FROM | WorkDrive Folder 08 | Brand asset files: ambassador_copy_rules.txt and ambassador_voice_guidelines.txt. |
| READS FROM | WorkDrive Folder 09 | VIP Prospect briefing documents. Agent 1B reads briefings to understand which specific influencers the relationship manager is cultivating so organic posting near those accounts is contextually aware. |
| WRITES TO | Zoho CRM: Prospects module | New prospects discovered through community monitoring. Sets Channel_Source to the specific community or platform where found. |
| WRITES TO | Zoho CRM: Social Post Log | Every Ayrshare post logged with platform, post ID, content summary, and timestamp for Agent 4 compliance monitoring. |
| WRITES TO | Zoho CRM: VIP Pipeline Stage | Updates VIP_Prospect_Pipeline_Stage when the coordinator logs a stage progression. Agent 1B does not advance stages autonomously — it surfaces engagement signals only. |
| FEEDS INTO | Agent 0 | Prospecting signals from community monitoring: educators who engage with Gracelyn content are flagged for Agent 0 to profile and score on its next weekly run. |
| FEEDS INTO | Agent 1A | New prospect records written to CRM by Agent 1B are picked up by Agent 1A on its next email sequence run. |

# **3. Inputs**

## **3.1 Approved Content Assets (WorkDrive Folder 02)**

Folder 02 contains all social content approved for posting. Parmeet manages this folder. Agent 1B reads files that do not have the _POSTED suffix. After posting, Agent 1B renames the file to append _POSTED to prevent re-posting. If the folder contains no unposted assets, Agent 1B sends a low-content alert and exits the post cycle gracefully.

## **3.2 Gap Report and Channel Intelligence (WorkDrive Folder 07)**

Agent 0 saves a gap report to Folder 07 after every weekly run. Agent 1B reads this report at the start of the intelligence cycle to identify which audience categories have the most un-contactable prospects (no email found). These categories represent the highest-value communities for social monitoring that week. If the gap report is absent, Agent 1B runs with its default community config and sends Parmeet an alert.

## **3.3 Brand Assets (WorkDrive Folder 08)**

Folder 08 contains ambassador_copy_rules.txt and ambassador_voice_guidelines.txt. Both files are required for caption generation. Agent 1B fetches them fresh at the start of each post cycle. If either file is missing, the post cycle halts and Parmeet is alerted.

## **3.4 VIP Prospect Briefings (WorkDrive Folder 09 — Read Only)**

Folder 09 contains briefing documents generated by Agent 0 for each VIP Prospect. Agent 1B reads these briefings to understand which accounts the relationship manager is actively cultivating. This allows Agent 1B to apply MISSION_KEYWORDS matching contextually — an engagement signal from a VIP Prospect's account carries more weight than an engagement signal from an unknown account. Agent 1B does not write to Folder 09.

# **4. Run Cycles**

## **4.1 Post Cycle — Runs Tuesday and Thursday at 10:00 AM CST**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Read approved assets | Fetch all files from WorkDrive Folder 02. Filter to files that have not been posted (do not have the _POSTED suffix). If no unposted assets remain, send Parmeet a low-content alert and exit the post cycle gracefully without error. |
| 2 | Select asset for this run | Select the oldest unposted asset. This ensures content is used in the order Parmeet intended. |
| 3 | Read brand assets | Fetch ambassador_copy_rules.txt and ambassador_voice_guidelines.txt from WorkDrive Folder 08. Both required. Halt post cycle with alert if either is missing. |
| 4 | Generate captions | Pass the asset content and brand assets to Claude API. Generate platform-native captions for LinkedIn, Facebook, and Instagram. LinkedIn: professional, 3-4 sentences, hashtags at end. Facebook: warm and conversational, 2-3 sentences, 2-3 hashtags. Instagram: hook-first, 2-3 sentences, 5-8 hashtags, emojis acceptable. Return JSON with three caption fields. |
| 5 | Post via Ayrshare | Call Ayrshare API with the generated captions and asset image. Post to all three platforms in a single Ayrshare call. Log each platform response code. A failure on one platform does not block the others. |
| 6 | Write Social Post Log | Write one CRM Social Post Log record per platform with: platform, Ayrshare post ID, caption text, asset filename, timestamp, and post status (success or failed). |
| 7 | Mark asset as posted | Rename the asset file in WorkDrive Folder 02 by appending _POSTED to the filename. This prevents it from being selected again on the next run. |

## **4.2 Intelligence Cycle — Runs After Agent 0 Weekly Complete**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Read Agent 0 gap report | Fetch the most recent gap report from WorkDrive Folder 07. Parse the gap report for audience categories with the highest no-contact-found rate. These are the priority communities for social monitoring this week. |
| 2 | Monitor priority communities | Search priority communities on Facebook and LinkedIn for educators, childcare workers, faith community leaders, and mission-aligned advocates who are actively posting about teacher development, educational equity, or Gracelyn-adjacent topics. Use read-only API tokens. Do not engage directly from this function. |
| 3 | Filter existing prospects | Query Zoho CRM Prospects module for existing Social_Profile_URL records. Deduplicate against discovered profiles. Only proceed with net-new discoveries. |
| 4 | Write new prospects to CRM | For each net-new discovery: create a Prospect record with name (if public), Social_Profile_URL, Channel_Source (specific community name), Outreach_Status = Identified, Contact_Found = false, and Role_Category (best estimate from profile context). Do not set VIP_Prospect flag. Agent 0 scores VIP status on its next weekly run. |
| 5 | Flag high-engagement educators | Identify educators who engaged with any Gracelyn-posted content in the past 7 days (likes, comments, shares). Write their Social_Profile_URL to a High_Engagement_Flag field in their existing Prospect record, or create a new Prospect record if they are not already in the system. These profiles are prioritized for Agent 0 VIP scoring. |

# **5. VIP Prospect Pipeline Support**

Agent 1B plays a supporting role in the VIP Prospect Pipeline managed by the human relationship manager. Its role is to surface timely engagement intelligence that helps the coordinator act on warm signals without monitoring every account manually. Agent 1B never advances a pipeline stage autonomously. Stage progression is always a human coordinator action logged in CRM.

| **VIP Pipeline Stage** | **Agent 1B Role** |
| --- | --- |
| Stage 1: Warm Follow | Agent 1B monitors public content from accounts in the Warm Follow stage. If an account posts content that is highly relevant to Gracelyn's mission in the current week, Agent 1B generates a coordinator alert: a one-sentence note identifying the post, why it is relevant, and a suggested genuine engagement response. This gives the coordinator timely context without requiring them to monitor every account manually. |
| Stage 2: Personal Outreach | Agent 1B has no automated role in Stage 2. The coordinator owns all personal outreach. Agent 1B continues passive monitoring only. |
| Stage 3: Ambassador Invitation | Agent 1B has no automated role in Stage 3. The coordinator owns the invitation conversation. |
| Stage 4: VIP Onboarding | Once a VIP Prospect accepts and transitions to Ambassador, Agent 1B updates the prospect CRM record status to Converted. The Ambassador record is created by Agent 2. |
| Stage 5: No Response or Decline | Agent 1B writes no automated follow-up. If a prospect is marked Declined by the coordinator, Agent 1B suppresses all monitoring activity for that account and sets a 12-month re-approach suppression flag in CRM. |

## **5.1 Warm Follow Engagement Alert — Detail**

The warm follow alert is Agent 1B's primary contribution to the VIP Prospect Pipeline. It fires when a prospect in Stage 1 (Warm Follow) posts content that matches the MISSION_KEYWORDS environment variable within the current monitoring window.

- Agent 1B checks Folder 09 for active VIP Prospect briefings to identify which accounts are in Stage 1.

- If an account in Stage 1 posts content containing one or more MISSION_KEYWORDS, Agent 1B generates an alert payload: prospect name, post URL, matched keywords, and a one-sentence suggested engagement response.

- The alert is delivered as a CRM task assigned to the VIP Relationship Manager — not an email. CRM tasks appear in the coordinator's daily work queue and are time-stamped, creating an audit trail of cultivation activity.

- Agent 1B generates a maximum of one warm follow alert per VIP Prospect per week to prevent alert fatigue.

- The coordinator decides whether to engage with the post. There is no automated engagement action.

| **NOTE** MISSION_KEYWORDS is a Catalyst environment variable maintained by Parmeet. It is a comma-separated list of words and phrases. Parmeet updates it without touching code. Initial suggested values: vulnerable children, teacher development, educational equity, faith educator, underserved students, teacher shortage, paraprofessional, early childhood, foster care, mission-driven education. |
| --- |

# **6. Coordinator Alerts**

| **Alert Type** | **Content and Delivery** |
| --- | --- |
| Warm Follow engagement signal | Sent when a VIP Prospect in Stage 1 posts mission-relevant content. Content: prospect name, post link, one-sentence relevance summary, suggested engagement response. Delivered as a CRM task assigned to the VIP Relationship Manager. Not an email — a CRM task so it appears in the coordinator's daily work queue. |
| Low content alert | Sent when Folder 02 has no unposted assets remaining. Content: alert that content queue is empty, count of days since last post, request for Parmeet to upload new assets. Delivered by email to Parmeet. |
| Post failure alert | Sent when an Ayrshare post fails on any platform. Content: platform name, error code, asset filename. Delivered by email to Parmeet. Does not block posting to other platforms. |
| New high-engagement prospect | Sent weekly when community monitoring identifies educators with unusually high engagement on Gracelyn content. Content: list of names and Social_Profile_URLs flagged for Agent 0 priority scoring on next run. Delivered as a summary in the Agent 1B weekly run report to Parmeet. |

# **7. Claude API Usage**

## **7.1 Caption Generation System Prompt**

| function buildCaptionSystemPrompt(copyRules, voiceGuidelines) {   return `You generate platform-native social media captions for Gracelyn University ambassador recruiting content. Platform requirements: LinkedIn: Professional tone. 3-4 sentences. No hashtags in body. 3-5 relevant hashtags at end on a new line. Facebook: Warm and conversational. 2-3 sentences. 2-3 hashtags at end. Instagram: Hook-first. 2-3 sentences. 5-8 hashtags. Emojis acceptable. COPY RULES (follow all without exception): ${copyRules} VOICE GUIDELINES: ${voiceGuidelines} Return valid JSON only. No preamble. No markdown fences. {   'linkedin': '<LinkedIn caption>',   'facebook': '<Facebook caption>',   'instagram': '<Instagram caption>'   end of JSON return value } |
| --- |

# **8. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Weekly Post Schedule | Every Tuesday and Thursday at 10:00 AM CST | Fires Agent 1B post cycle Catalyst function. Logs result to Zoho Analytics coordinator dashboard. |
| Scenario 2: Intelligence Cycle Trigger | Agent 0 Scenario 3 recruiting webhook | Fires Agent 1B intelligence cycle Catalyst function. Agent 1B reads the gap report and runs community monitoring. |
| Scenario 3: VIP Warm Follow Alert | Agent 1B Catalyst function webhook on engagement signal | Receives engagement signal payload. Creates CRM task assigned to VIP Relationship Manager. Task includes prospect name, post link, and suggested engagement note. |
| Scenario 4: Low Content Alert | Agent 1B Catalyst function webhook on empty queue | Sends low-content email to Parmeet. Includes count of days since last post. |
| Scenario 5: Run Summary | Agent 1B Catalyst function on run completion | Sends weekly run summary to Parmeet: posts published, new prospects discovered, high-engagement flags, VIP warm follow alerts sent, and any errors. |

# **9. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Token refresh fails | try/catch on token refresh call | Halt run. Send Parmeet alert. Do not proceed with stale credentials. |
| WorkDrive Folder 02 empty (no unposted assets) | File list returns zero unposted files | Send low-content alert to Parmeet. Exit post cycle gracefully. Intelligence cycle continues. |
| Brand asset file missing from Folder 08 | File fetch returns error | Halt post cycle. Send Parmeet alert. Intelligence cycle may continue without brand assets. |
| Ayrshare post fails on one platform | Non-200 response from Ayrshare for that platform | Log failure in Social Post Log. Send Parmeet alert. Continue posting to other platforms. |
| Ayrshare post fails on all platforms | Non-200 responses from all three platform calls | Log all failures. Send Parmeet alert. Do not retry automatically. Coordinator decides whether to retry manually. |
| Claude API returns non-JSON captions | JSON parse error on caption response | Log raw response. Send Parmeet alert. Skip this post cycle run. Do not post without valid captions. |
| CRM write fails for new prospect | Zoho CRM API error | Log failed prospect data locally. Retry once at end of intelligence cycle. If retry fails, include in run summary email to Parmeet. |
| VIP Prospect account detected in standard monitoring | Account Social_Profile_URL matches VIP_Prospect = true in CRM | Remove from standard prospect pipeline immediately. Do not write outreach fields. Log detection. No further automated action. |
| Gap report missing from Folder 07 | File fetch returns error | Skip intelligence cycle channel prioritization. Run community monitoring with default audience config. Send Parmeet alert that gap report was not found. |

# **10. Testing Protocol**

## **10.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Token refresh | Call token refresh functions individually | All tokens return successfully. No alert fires. |
| Unposted asset selection | Populate Folder 02 with one asset without _POSTED suffix and one with | Only the unposted asset is selected for the post cycle. |
| Caption generation | Pass mock asset and brand assets to Claude API | Valid JSON returned with linkedin, facebook, and instagram caption fields. |
| Ayrshare post — one platform failure | Simulate one platform returning 400 | Other two platforms post successfully. Failure logged in Social Post Log. Parmeet alert fires. |
| _POSTED rename | Run full post cycle with a test asset | Asset filename in Folder 02 has _POSTED appended after successful post. |
| Deduplication on intelligence cycle | Pre-populate CRM with a Social_Profile_URL matching one discovered prospect | Duplicate is skipped. Only net-new prospects are written to CRM. |
| VIP Prospect suppression | Pre-set a discovered prospect's CRM record to VIP_Prospect = true | Prospect is not written to standard outreach fields. No recruiting webhook fires for this account. |
| Warm follow engagement alert | Simulate a VIP Prospect posting content matching mission keywords | CRM task created and assigned to VIP Relationship Manager. No email or direct message sent. |
| Low content alert | Set Folder 02 to contain only _POSTED assets | Low content alert email fires to Parmeet. Post cycle exits gracefully. |
| Gap report missing | Remove gap report from Folder 07 before intelligence cycle | Intelligence cycle runs with default config. Parmeet alert fires noting missing gap report. |
| CRM write retry | Simulate CRM API failure on first write attempt | Retry fires at end of cycle. If retry fails, prospect included in Parmeet run summary. |

## **10.2 Integration Test**

Run after all unit tests pass. Parmeet present for integration test.

- Confirm Folder 02 contains at least two unposted assets

- Confirm Folder 07 contains a gap report from Agent 0

- Confirm Folder 08 contains both brand asset files

- Confirm Folder 09 contains at least one VIP Prospect briefing document

- Confirm MISSION_KEYWORDS environment variable is populated

- Trigger post cycle manually and confirm post appears on all three platforms

- Confirm Social Post Log record created in CRM for each platform

- Confirm asset renamed with _POSTED suffix in Folder 02

- Trigger intelligence cycle and confirm new prospect records written to CRM

- Confirm VIP_Prospect = true accounts are suppressed from standard prospect pipeline

- Simulate a VIP Prospect (Stage 1) posting mission-keyword content and confirm CRM task is created and assigned to VIP Relationship Manager

- Confirm low-content alert fires when Folder 02 contains only _POSTED assets

- Confirm run summary delivered to Parmeet at end of intelligence cycle

## **10.3 Acceptance Criteria**

- Post cycle fires Tuesday and Thursday at 10:00 AM CST without manual intervention

- Posts appear on LinkedIn, Facebook, and Instagram with platform-appropriate captions

- Social Post Log written to CRM for every post on every platform

- Assets renamed with _POSTED suffix after posting and never re-posted

- Intelligence cycle runs after every Agent 0 weekly complete webhook

- Net-new prospects written to CRM with correct Channel_Source and Role_Category fields

- VIP_Prospect = true accounts never receive outreach fields or appear in recruiting pipeline

- Warm follow engagement alerts delivered as CRM tasks, not emails

- Maximum one warm follow alert per VIP Prospect per week

- Low-content alert fires before content queue is exhausted

- Parmeet confirms she can update MISSION_KEYWORDS without developer assistance

# **11. Integration Notes for Other Developers**

## **11.1 What Agent 0 Developer Needs to Know**

- Agent 1B reads the gap report from WorkDrive Folder 07. The gap report must be saved by Agent 0 before the recruiting webhook fires. Confirm timing with Agent 0 developer.

- Prospects discovered by Agent 1B are written to CRM with VIP_Prospect not set. Agent 0 scores VIP status on its next weekly run. Agent 1B never sets the VIP_Prospect flag.

- Agent 1B reads Folder 09 briefing documents to identify Stage 1 accounts. Agent 0 writes these files. Confirm the filename convention with Agent 0 developer so Agent 1B can parse them correctly.

## **11.2 What Agent 1A Developer Needs to Know**

- Agent 1B writes Outreach_Status = Identified and Channel_Source to new prospect records. Agent 1A updates these records to Outreach_Sent when it sends email sequence 1. There is no email overlap between the two agents.

## **11.3 What Agent 2 Developer Needs to Know**

- When a VIP Prospect converts through the pipeline and accepts the ambassador invitation, Agent 1B updates the Prospect record status to Converted. Agent 2 creates the Ambassador record from that point. Coordinate on the exact CRM field and value that triggers Agent 2's VIP onboarding track.

## **11.4 What Agent 4 Developer Needs to Know**

- Every post is written to the CRM Social Post Log before posting. Agent 4 can query this log to review post content against copy rules. The Social Post Log includes full caption text, not just a summary, so Agent 4 has everything it needs for compliance review.

# **12. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID for Zoho CRM |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho CRM |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho CRM |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for Zoho WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho WorkDrive |
| ZOHO_SOCIAL_ACCESS_TOKEN | Parmeet | Read-only access token for Zoho Social monitoring. No posting. |
| ZOHO_SOCIAL_PORTAL_ID | Parmeet | Zoho Social portal ID. Confirm with Parmeet. |
| AYRSHARE_API_KEY | Parmeet | Static API key for Ayrshare posting. No refresh required. |
| FACEBOOK_READ_TOKEN | Parmeet | Read-only Facebook Graph API token for community monitoring. |
| LINKEDIN_READ_TOKEN | Parmeet | Read-only LinkedIn API token for community monitoring. |
| ANTHROPIC_API_KEY | Parmeet | Claude API key. Shared with other agents. Do not generate a separate key. |
| WORKDRIVE_FOLDER_02 | Parmeet | WorkDrive Folder 02 ID for approved social content assets. |
| WORKDRIVE_FOLDER_07 | Parmeet | WorkDrive Folder 07 ID for Agent 0 gap reports. |
| WORKDRIVE_FOLDER_08 | Parmeet | WorkDrive Folder 08 ID for brand asset files. |
| WORKDRIVE_FOLDER_09 | Parmeet | WorkDrive Folder 09 ID for VIP Prospect briefing documents. Read only from Agent 1B. |
| MAKE_AGENT1B_INTELLIGENCE_WEBHOOK | Developer | Make.com webhook URL for Scenario 2 intelligence cycle trigger. |
| MAKE_VIP_WARM_FOLLOW_WEBHOOK | Developer | Make.com webhook URL for Scenario 3 VIP warm follow alert. |
| MAKE_LOW_CONTENT_WEBHOOK | Developer | Make.com webhook URL for Scenario 4 low content alert. |
| PARMEET_ALERT_EMAIL | Parmeet | Email address for all Agent 1B error and alert notifications. |
| VIP_RELATIONSHIP_MANAGER_EMAIL | Parmeet | Email address of the VIP Relationship Manager for warm follow CRM task assignment. |
| MISSION_KEYWORDS | Parmeet | Comma-separated keywords for warm follow content matching. Example: vulnerable children, teacher development, educational equity, faith educator. Parmeet updates without touching code. |

| **NOTE** All environment variables are set by Parmeet in the Zoho Catalyst console before development begins. Developer 1B coordinates with Parmeet on the variable list above. No variable is hardcoded in any file. |
| --- |
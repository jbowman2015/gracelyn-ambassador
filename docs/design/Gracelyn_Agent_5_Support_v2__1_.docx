**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 5 of 9

**Ambassador Support Agent**

*Portal chat, OpenAI knowledge base, tiered escalation routing,*

*SLA timestamp capture, and future-ready team routing webhook payload*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store all credentials as Zoho Catalyst environment variables. No credential is hardcoded.

| **HARD STOP** Do not begin development until: (1) Parmeet has confirmed the existing OpenAI assistant configuration and whether Agent 5 extends the same assistant or creates a new one; (2) the Support Tickets CRM module exists with all nine SLA fields listed in Section 7; (3) the knowledge base is drafted and ready for review. Building without a complete knowledge base produces an unusable agent. |
| --- |

| **EXISTING SYSTEM — READ BEFORE BUILDING** Agent 5 extends the existing OpenAI chat that is already live on the Gracelyn website. It does not replace it. Understand the existing implementation before writing a single line of code. The existing chat handles general Gracelyn website inquiries. Agent 5 adds an ambassador-specific knowledge layer and portal integration. Confirm the exact API version, assistant ID, and thread management approach with Parmeet before building. |
| --- |

| **Tool** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| OpenAI API | API key for the existing Gracelyn website chat system. Confirm whether the ambassador knowledge base extension uses the same key or a new key. | Agent 5 extends the existing OpenAI assistant. Understand the existing configuration before building any extension. | Parmeet |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.CREATE, ZohoCRM.modules.UPDATE | Read Ambassadors module. Write Support Tickets module including all nine SLA timestamp fields. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Send escalation notifications from ambassadors@gracelyn.edu. Also sends fallback escalation when Make.com webhook fails. | Parmeet |
| WordPress REST API | Admin username and application password for wp-agent5 user | Verify authenticated ambassador WordPress sessions. Use application password, not login password. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ | Read ambassador_copy_rules.txt and ambassador_program_descriptions.txt from Folder 08. | Parmeet |
| Zoho Catalyst | CLI credentials and project access | Full developer access to deploy Agent 5 serverless function. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build escalation routing scenario with urgent and standard paths. | Parmeet |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 5 is the ambassador's first point of contact for all support questions submitted through the WordPress portal chat widget. It verifies the ambassador's identity, queries the OpenAI knowledge base, returns an answer, classifies the resolution tier, writes a Support Ticket to CRM, and fires an escalation webhook for Tier 2 and above tickets. A well-supported ambassador is an active ambassador.

Version 2.0 introduces two significant changes: (1) the escalation webhook payload is extended to ten fields to support Agent 4 SLA tracking and future team routing without any Catalyst code changes; and (2) the Support Ticket CRM record now captures all nine SLA timestamp fields that Agent 4 monitors. The agent's core chat and escalation logic is unchanged.

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | WordPress portal chat widget | Authenticated ambassador submits a question. WordPress calls Agent 5 Catalyst function with session token and message text. |
| READS FROM | WordPress REST API | Verifies the ambassador's session is valid and active before processing any question. |
| READS FROM | Zoho CRM: Ambassadors module | Reads ambassador status, referral link, VIP flag, role category, and motivation tag for identity verification and personalized responses. |
| READS FROM | Zoho CRM: Referrals module | Reads referral stage data when ambassadors ask about specific referral progress. Never exposes student identity. |
| READS FROM | WorkDrive Folder 08 | Brand asset files: copy rules and program descriptions injected into the OpenAI system prompt. |
| WRITES TO | Zoho CRM: Support Tickets module | Creates one ticket per chat session. Writes all nine SLA timestamp fields at the correct moments. Agent 4 reads these fields for SLA tracking. |
| FEEDS INTO | Make.com escalation scenario | Fires escalation webhook for every Tier 2 and above ticket. Payload includes all ten fields required by Agent 4 for SLA tracking and future team routing. |
| FEEDS INTO | Human support coordinator | Escalation email routed by Make.com. Coordinator receives full question context without needing to open CRM. |
| FEEDS INTO | Agent 4 | Support Tickets module records are monitored by Agent 4 for SLA breach detection and weekly reporting. |

## **2.3 What Agent 5 Does NOT Do**

- Answer questions about admissions, program requirements, or enrollment for prospective students. Those go to the existing Gracelyn website chat.

- Modify any CRM records beyond creating Support Ticket records. It never changes ambassador status, referral stages, or payment records.

- Make decisions about referral eligibility or payment. It reports what CRM says and directs ambassadors to the coordinator for disputes.

- Send emails to ambassadors. All ambassador-facing email is owned by Agents 1A through 4.

- Handle questions from unauthenticated users. Every interaction begins with WordPress session verification. No session, no response.

- Write SLA_Breached or Resolution_SLA_Breached fields to Support Tickets. These are written exclusively by Agent 4.

# **3. Escalation Tiers**

| **Tier** | **Criteria** | **Action** |
| --- | --- | --- |
| Tier 1: Resolved | OpenAI assistant answers the question accurately from the knowledge base. No escalation signals in response. | Write ticket with Resolution_Status = Resolved and Resolution_Timestamp = now. No escalation webhook fired. |
| Tier 2: Escalated | OpenAI response indicates it cannot fully resolve the question, or ambassador asks for human help explicitly, or question involves a dispute or correction request. | Write ticket with Escalation_Timestamp = now. Fire escalation webhook. Standard routing path (24-hour SLA). |
| Tier 3: Complex | Question involves payment disputes, account suspension, fraud allegations, or any matter requiring coordinator judgment beyond standard knowledge base scope. | Write ticket with Escalation_Timestamp = now. Set is_urgent = true in webhook payload. Fire escalation webhook. Urgent routing path (4-hour SLA). |
| VIP Priority | Ambassador CRM record has VIP_Flag = true. Tier classification is overridden to VIP Priority regardless of question complexity. | Write ticket with Escalation_Timestamp = now and Ambassador_VIP_Status = true. Fire escalation webhook. Coordinator and VIP relationship manager both notified. 4-hour SLA. |

| **NOTE** The tier classification happens after the OpenAI response is received — not before. Agent 5 always attempts to answer the question first. The tier is determined by whether the answer was satisfactory and whether the question warrants human review. VIP Priority is the only tier that overrides this logic by flagging based on ambassador status rather than question content. |
| --- |

# **4. Process Steps**

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Receive and validate payload | WordPress sends POST to Catalyst function with: session_token (WordPress session cookie), message_text (ambassador question), thread_id (optional, for conversation continuity). Validate: session_token present and non-empty, message_text present and non-empty, message_text under 2,000 characters. Return validation error to WordPress if any check fails. Do not create a CRM record for invalid payloads. |
| 2 | Refresh all OAuth tokens | Refresh CRM, Mail, and WorkDrive tokens. If any token refresh fails, return FALLBACK_RESPONSE to WordPress and send Parmeet alert. Do not proceed with stale credentials. |
| 3 | Verify WordPress session | Call WordPress REST API with session_token to confirm the user is authenticated and has ambassador role. Extract user email from the verified session. If verification fails, return NOT_VERIFIED_RESPONSE. Do not create a CRM record. |
| 4 | Read ambassador CRM record | Query Zoho CRM Ambassadors module by email extracted from WordPress session. Confirm Status = Active. Read: VIP_Flag, Role_Category, Motivation_Tag, Referral_Link, Referral_Code. If ambassador is not Active, return a message directing them to contact support and create a minimal ticket. |
| 5 | Read support brand assets | Fetch ambassador_copy_rules.txt and ambassador_program_descriptions.txt from WorkDrive Folder 08. Inject into OpenAI system prompt. Continue with empty strings if files are missing but alert Parmeet. |
| 6 | Create or continue OpenAI thread | If thread_id is present in the payload and is a valid OpenAI thread ID, add the message to the existing thread (conversation continuity). If no thread_id or thread not found, create a new thread. Store the thread_id for return to WordPress. |
| 7 | Submit message and poll for response | Add the ambassador's message to the thread. Create a run with the ambassador OpenAI assistant ID. Poll for run completion at 2-second intervals up to 30 seconds. If run fails or times out, return FALLBACK_RESPONSE and create Tier 2 escalation ticket. |
| 8 | Classify tier | Read the OpenAI response text. Classify tier using the logic in Section 5. VIP_Flag overrides tier classification to VIP Priority regardless of response content. |
| 9 | Write Support Ticket to CRM | Create Support Ticket record with all required fields including the nine SLA timestamp fields. Write Escalation_Timestamp only for Tier 2 and above. Write Resolution_Timestamp = now for Tier 1. Write ticket_id for use in escalation webhook payload. |
| 10 | Fire escalation webhook (Tier 2+) | For Tier 2, Tier 3, and VIP Priority: fire Make.com escalation webhook with the full ten-field payload defined in Section 6. If webhook fails, retry once after 30 seconds. If retry fails, send fallback escalation email directly via Zoho Mail to coordinator. |
| 11 | Return response to WordPress | Return JSON to WordPress with: success: true, response: OpenAI answer text, thread_id: thread ID for conversation continuity, ticket_id: CRM ticket ID. WordPress renders the response in the portal chat widget. |

# **5. Tier Classification Logic**

After receiving the OpenAI response, Agent 5 classifies the tier using the following logic. Classification is sequential: stop at the first match.

| function classifyTier(responseText, ambassadorContext, questionText) {   // VIP override: always highest priority   if (ambassadorContext.isVIP) return 'VIP Priority';   // Tier 3: Complex matters requiring coordinator judgment   const complexSignals = [     'payment dispute', 'account suspended', 'fraud', 'incorrect amount',     'escalate to management', 'speak to someone senior'   ];   if (complexSignals.some(s => questionText.toLowerCase().includes(s))) return 'Tier 3';   // Tier 2: OpenAI could not resolve or ambassador requests human   const escalationSignals = [     'support coordinator', 'human', 'cannot fully answer',     'please contact', 'reach out to our team'   ];   if (escalationSignals.some(s => responseText.toLowerCase().includes(s))) return 'Tier 2';   if (questionText.toLowerCase().includes('speak to a person')) return 'Tier 2';   // Tier 1: Resolved by knowledge base   return 'Tier 1'; } |
| --- |

## **5.1 Issue Category Classification**

Issue category is classified from question content keywords before the OpenAI response is generated. It is written to the CRM ticket and included in the escalation webhook payload.

| **Issue Category** | **Question Patterns That Map to This Category** |
| --- | --- |
| Payment | Questions containing: referral fee, payment, paid, when do I get, how much, bank, PayPal, Wise, Tremendous, tax, 1099, earnings, payout |
| Compliance | Questions containing: agreement, ethics, training, compliance, signature, document, activate, referral link not working, portal access |
| Referral Tracking | Questions containing: referral, tracking, link, applied, enrolled, status, attribution, my student, did they apply |
| Portal Access | Questions containing: login, password, dashboard, portal, can't access, account, profile, settings |
| Recruiting | Questions containing: recruiting link, ambassador recruiting, recruit, invite another educator, secondary fee, my recruits |
| Other | Any question that does not match the above patterns. Default category. |

# **6. Escalation Webhook Payload**

Version 2.0 extends the escalation webhook payload to ten fields. All ten must be present in every escalation webhook. Agent 4 depends on these fields for SLA tracking and reporting. Future team routing requires only a Make.com routing table update when a second coordinator is hired.

| **Critical Coordination Point** The escalation_timestamp field in the webhook payload must be the exact same value as the Escalation_Timestamp field written to the CRM Support Ticket record in Step 9. Agent 4 uses the webhook payload timestamp for initial SLA calculation and the CRM timestamp for ongoing monitoring. If they do not match, SLA tracking will be inaccurate. Write the timestamp once and use it in both places. |
| --- |

| **Field** | **Value and Purpose** |
| --- | --- |
| ticket_id | CRM Support Ticket record ID. Written by Agent 5 at ticket creation. Agent 4 uses to link SLA tracking to the specific ticket record. |
| ambassador_id | CRM Ambassador record ID. Agent 4 uses to pull ambassador profile context in the coordinator dashboard. |
| ambassador_name | Ambassador first and last name. Displayed in coordinator alert email subject line so coordinator knows who needs help without opening CRM. |
| tier | Values: Tier 2, Tier 3, VIP Priority. Make.com uses to route to urgent or standard path. Agent 4 uses to apply the correct SLA target. |
| issue_category | Values: Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other. Future team routing field. When a second coordinator is hired, Make.com routes Payment and Compliance to one person and Portal Access and Recruiting to another. Only a Make.com table update is required — no Catalyst code change. |
| is_urgent | Boolean. True when tier = Tier 3 or VIP Priority. Make.com uses to route to Path A (urgent) vs. Path B (standard). |
| is_vip | Boolean. True when ambassador VIP_Flag = true. Make.com copies escalation to VIP relationship manager in addition to support coordinator. |
| resolution_complexity | Values: Simple, Moderate, Complex. Helps coordinator estimate resolution effort before opening the ticket. Included in coordinator alert email body. |
| question_text | Full text of the ambassador's question. Included in escalation email so coordinator has complete context without opening CRM. |
| escalation_timestamp | ISO 8601 timestamp when the escalation was created. Agent 4 reads this field to calculate SLA elapsed time. This must be the exact same timestamp written to the Escalation_Timestamp field in the CRM Support Ticket record. |

## **6.1 Payload Code**

| function buildEscalationPayload(ticket, ambassador, questionText, tier, issueCategory) {   const escalationTimestamp = new Date().toISOString();   return {     ticket_id:            ticket.id,     ambassador_id:        ambassador.id,     ambassador_name:      ambassador.firstName + ' ' + ambassador.lastName,     tier:                 tier,     issue_category:       issueCategory,     is_urgent:            tier === 'Tier 3' ││ tier === 'VIP Priority',     is_vip:               ambassador.isVIP,     resolution_complexity: classifyComplexity(questionText),     question_text:        questionText,     escalation_timestamp: escalationTimestamp   }; } function classifyComplexity(questionText) {   const complex  = ['dispute', 'incorrect', 'suspended', 'fraud', 'wrong amount'];   const moderate = ['payment', 'referral fee', 'tracking', 'not showing'];   if (complex.some(s  => questionText.toLowerCase().includes(s))) return 'Complex';   if (moderate.some(s => questionText.toLowerCase().includes(s))) return 'Moderate';   return 'Simple'; } |
| --- |

# **7. Support Ticket CRM Fields**

Agent 5 writes the following fields to the Support Tickets CRM module. All fields must exist in the module before development begins. Coordinate with the Agent 4 developer to confirm field names match exactly between the two agents.

| **CRM Field** | **Written When** | **Value** |
| --- | --- | --- |
| Ticket_Tier | Ticket creation | Tier 1, Tier 2, Tier 3, or VIP Priority based on classification. |
| Issue_Category | Ticket creation | Payment, Compliance, Referral Tracking, Portal Access, Recruiting, or Other. Classified by Agent 5 from question content. |
| Ambassador_VIP_Status | Ticket creation | True if ambassador VIP_Flag = true. False otherwise. |
| Resolution_Complexity | Ticket creation | Simple, Moderate, or Complex. Estimated by Agent 5 from question type. |
| Resolution_Status | Ticket creation or resolution | Resolved (Tier 1), Escalated (Tier 2+), or Failed (fallback). |
| Escalation_Timestamp | Tier 2+ ticket creation | ISO 8601 timestamp. Must match escalation_timestamp in webhook payload exactly. Agent 4 uses this for SLA calculation. |
| First_Response_Timestamp | Written by coordinator or Agent 5 when first human response is sent | ISO 8601 timestamp. Agent 4 reads to calculate time-to-first-response SLA. |
| Resolution_Timestamp | Tier 1 ticket creation (immediate) or when coordinator marks resolved | ISO 8601 timestamp. Agent 4 reads to calculate time-to-resolution SLA. |
| SLA_Breached | Written by Agent 4, not Agent 5 | Agent 5 must not write this field. Agent 4 owns all SLA breach detection and writes this field after monitoring. |

# **8. Knowledge Base**

The ambassador knowledge base is the most important pre-build deliverable for Agent 5. Parmeet must complete and review the knowledge base before any ambassador is activated. The eight topic areas below define the scope of what the knowledge base must cover.

| **Knowledge Base Pre-Build Requirement** The knowledge base must be complete and reviewed by Parmeet and Dr. Flippen before Agent 5 goes live. An incomplete knowledge base produces incorrect answers. Incorrect answers from an AI system damage ambassador trust more than no system at all. Do not activate Agent 5 until the knowledge base sign-off is received. |
| --- |

| **Topic** | **Common Questions** | **Key Accuracy Requirements** |
| --- | --- | --- |
| Referral tracking | How does my referral link work? Why is my referral not showing? How long does attribution take? | Referral link includes ambassador's unique code. Attribution is tracked at application. Processing time is 24 to 48 hours. Never say commission. |
| Referral fees | When do I earn my referral fee? How much is the referral fee? How is the fee paid? | 4 consecutive months of active enrollment required. $100 undergraduate, $200 graduate. Payment via PayPal, ACH, Wise, or Tremendous. Never say commission. |
| Compliance and portal | How do I complete my compliance steps? Why can't I see my referral link? Where is my portal? | Combined compliance form with three signature sections. Referral link appears after compliance completion. Portal login is WordPress. |
| Ambassador recruiting | How does my recruiting link work? When do I earn a recruiting referral fee? How does secondary fee work? | Recruiting referral fee: $50 undergraduate, $100 graduate. Paid after recruited ambassador's referred student completes 4 months. Two-layer maximum depth. |
| International payment | How do I receive my payment outside the US? What payment methods are available internationally? | US: PayPal or ACH. International Wise-supported countries: Wise. All other international: Tremendous virtual prepaid card. Country of residence determines available methods. |
| Program rules | Can I refer myself? Can I refer a family member? What are the program rules? | Self-referral is prohibited. Household referrals are prohibited. All referrals must be genuine independent prospective students. Violations result in disqualification. |
| Portal navigation | Where is my referral link? Where do I see my referred students? How do I update my payment info? | Referral link is on Dashboard Home after compliance completion. Referred student count (no names) is on Referral Activity page. Payment info is on Account Settings. |
| Support and escalation | I have a problem that the chat cannot resolve. How do I reach a human? | Direct to the coordinator contact. Response expected within 24 hours for standard tickets. VIP ambassadors can expect same-day response. |

## **8.1 International Payment Coverage**

Version 2.0 adds international payment support to the program. The knowledge base must be updated to cover all three payment tiers: US ambassadors (PayPal or ACH), international ambassadors in Wise-supported countries (Wise), and all other international ambassadors (Tremendous virtual prepaid card). Agent 5 must answer international payment questions accurately to avoid ambassador confusion at the point of payment.

# **9. Make.com Scenario Configuration**

| **Step** | **Module** | **Path** | **Configuration** |
| --- | --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Both | Create webhook. Store URL as MAKE_ESCALATION_WEBHOOK_URL in Catalyst. Receives all Tier 2 and above escalations from Agent 5. |
| 2 | Router | Both | Route on is_urgent field. True (Tier 3 or VIP Priority) takes Path A. False (Tier 2) takes Path B. |
| 3a | Email — Zoho Mail | Path A: Urgent | To: SUPPORT_COORDINATOR_EMAIL and PARMEET_ALERT_EMAIL. If is_vip = true, also CC VIP_MANAGER_EMAIL. Subject: URGENT: Ambassador Support — [tier] — [ambassador_name]. Body: question_text, ambassador_name, ambassador_id, tier, issue_category, resolution_complexity, ticket_id, escalation_timestamp. Response expected within 4 hours. |
| 3b | Email — Zoho Mail | Path B: Standard | To: SUPPORT_COORDINATOR_EMAIL only. Subject: Ambassador Support Ticket — [ambassador_name] — [ticket_id]. Body: question_text, ambassador_name, tier, issue_category, resolution_complexity, ticket_id. Response expected within 24 hours. |
| 4 | Email — Zoho Mail | Error path | Fires if webhook receives error. To: PARMEET_ALERT_EMAIL. Subject: Agent 5 Escalation Failed. Body: full payload and error detail. |

# **10. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** | **Alert Parmeet?** |
| --- | --- | --- | --- |
| WordPress session verification fails | REST API non-200 or user not found | Return NOT_VERIFIED_RESPONSE. No CRM ticket. | No: expected for expired sessions. |
| Ambassador not Active in CRM | Status not Active in CRM record | Return message directing to support. Create minimal ticket. | No individually. Yes if 10+ consecutive CRM failures. |
| WorkDrive brand assets missing | File not found in Folder 08 | Continue with empty strings. Log warning. | Yes: assets missing from Folder 08. |
| OpenAI thread creation fails | API error on thread create | Return FALLBACK_RESPONSE. Create Tier 2 escalation ticket. | Yes: OpenAI API failure. |
| OpenAI run times out (30 seconds) | Poll reaches max attempts | Return FALLBACK_RESPONSE. Create Tier 2 escalation ticket. | Yes: include thread ID. |
| OpenAI run fails | status = failed | Return FALLBACK_RESPONSE. Create Tier 2 escalation ticket. | Yes: include run ID and thread ID. |
| CRM ticket creation fails | CRM API non-200 | Log failure. Return response to ambassador. Continue. | Yes: include question text and email for manual ticket. |
| Make.com escalation webhook fails | fetch non-200 | Retry once after 30 seconds. If retry fails: send fallback email directly to coordinator via Zoho Mail. | Yes on second failure. |
| Message over 2,000 characters | Payload validation check | Return validation error to WordPress. No CRM ticket. | No: normal input validation. |

## **10.1 Fallback Response**

| const FALLBACK_RESPONSE = {   success:  true,   response: 'We are experiencing a technical issue right now. ' +             'Your question has been forwarded to our support team ' +             'and you will hear back within 24 hours. ' +             'We apologize for the inconvenience.',   thread_id: null }; const NOT_VERIFIED_RESPONSE = {   success:  false,   response: 'Your session could not be verified. ' +             'Please log in to the ambassador portal and try again.',   thread_id: null }; |
| --- |

# **11. Testing Protocol**

## **11.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| WordPress session verification | Call Agent 5 with a valid WordPress session token for an active test ambassador. | Ambassador email extracted from session. CRM query succeeds. Processing continues. |
| Unauthenticated access blocked | Call Agent 5 without a valid session token. | NOT_VERIFIED_RESPONSE returned. No CRM ticket created. |
| Tier 1 classification and ticket | Submit a question the knowledge base answers fully. | Ticket created with Tier 1, Resolution_Status = Resolved, Resolution_Timestamp = now. No escalation webhook. |
| Tier 2 classification and ticket | Submit a question that triggers escalation language in the OpenAI response. | Ticket created with Tier 2, Escalation_Timestamp = now. Escalation webhook fires. Coordinator receives email. |
| Tier 3 classification | Submit a payment dispute question. | Ticket created with Tier 3. is_urgent = true in webhook payload. Coordinator and Parmeet both receive alert. |
| VIP Priority override | Submit any question as a VIP-flagged test ambassador. | Ticket tier = VIP Priority regardless of question. Coordinator and VIP relationship manager both notified. |
| Escalation webhook payload completeness | Inspect Make.com Scenario 1 webhook receipt on Tier 2 escalation. | All ten fields present: ticket_id, ambassador_id, ambassador_name, tier, issue_category, is_urgent, is_vip, resolution_complexity, question_text, escalation_timestamp. |
| Escalation_Timestamp matches webhook field | Compare CRM Escalation_Timestamp to webhook escalation_timestamp field. | Values are identical ISO 8601 strings. Agent 4 SLA calculation depends on this match. |
| issue_category classification — Payment | Submit 'When will I receive my referral fee?' | issue_category = Payment in CRM ticket and webhook payload. |
| issue_category classification — Compliance | Submit 'Why can't I see my referral link?' | issue_category = Compliance in CRM ticket and webhook payload. |
| issue_category classification — Portal Access | Submit 'I cannot log in to the portal.' | issue_category = Portal Access in CRM ticket and webhook payload. |
| International payment question answered correctly | Submit 'How do I get paid if I live in Uganda?' | Response mentions Wise or Tremendous. No mention of ACH for international. Response uses referral fee, not commission. |
| Conversation continuity | Submit two messages in the same session using the thread_id returned from the first. | Second response reflects context from first message. Thread ID consistent across both. |
| Webhook retry on failure | Simulate Make.com webhook returning non-200. | Retry fires after 30 seconds. If retry also fails, fallback email sent to coordinator via Zoho Mail. |
| Knowledge base accuracy — no commission language | Review 10 OpenAI responses across different question types. | Zero instances of the word commission in any response. |

## **11.2 Integration Test**

- Confirm knowledge base is complete and reviewed by Parmeet before integration test begins

- Log in as a test ambassador in the WordPress portal. Confirm chat widget is visible and functional

- Submit a Tier 1 question: Where is my referral link? Verify: response mentions Dashboard Home, uses referral fee not commission, Support Ticket created with Tier 1 Resolved

- Submit a Tier 2 question: My referral is not showing up and I need help. Verify: response indicates escalation, Tier 2 ticket created, coordinator receives escalation email within 5 minutes

- Inspect the escalation email and confirm all ten payload fields are visible in the email body

- Compare Escalation_Timestamp in CRM ticket to escalation_timestamp in Make.com webhook receipt. Confirm they match exactly

- Submit a payment dispute question. Verify: Tier 3 ticket created, is_urgent = true, coordinator and Parmeet both receive urgent alert

- Log in as a VIP test ambassador. Submit any question. Verify: VIP Priority tier, coordinator and VIP relationship manager both notified

- Submit an international payment question: How do I get paid if I live in Nigeria? Verify: response mentions Tremendous, not ACH, and uses referral fee language

- Test conversation continuity: submit two messages in the same session using the thread_id from the first response. Verify context continuity in second response

- Test unauthenticated access: call Catalyst function without valid session token. Verify NOT_VERIFIED_RESPONSE and no CRM ticket

## **11.3 Acceptance Criteria**

- Knowledge base complete and reviewed by Parmeet and Dr. Flippen before any ambassador is activated

- Tier 1 questions resolved within 20 seconds with no escalation

- Tier 2 escalation email delivered to coordinator within 5 minutes of ticket creation

- All ten escalation payload fields present in every webhook. Coordinator can confirm by reviewing Make.com webhook log

- Escalation_Timestamp in CRM matches escalation_timestamp in webhook exactly

- VIP Priority tier assigned to all VIP ambassador questions regardless of question type

- International payment questions answered correctly with Wise and Tremendous options

- Zero instances of commission language in any knowledge base response

- Unauthenticated requests return NOT_VERIFIED_RESPONSE with no CRM record created

# **12. Integration Notes for Other Developers**

## **12.1 What Agent 4 Developer Needs to Know**

- Agent 5 writes nine SLA fields to the Support Tickets CRM module. Field names are listed in Section 7. Agent 4 reads all nine. Confirm field names match exactly before either agent writes a CRM call. A mismatch silently breaks Agent 4 SLA tracking.

- The escalation_timestamp in the webhook payload is the same value as Escalation_Timestamp in CRM. Agent 4 reads both. They must be identical ISO 8601 strings. Agent 5 generates the timestamp once and uses it in both places.

- Agent 5 does not write SLA_Breached or Resolution_SLA_Breached. Those fields are owned exclusively by Agent 4. If Agent 5 accidentally writes these fields, Agent 4 SLA breach detection will malfunction.

# **13. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| OPENAI_API_KEY | Parmeet | API key for OpenAI. Confirm whether this is the same key as the existing website chat or a new key. |
| OPENAI_ASSISTANT_ID | Parmeet | OpenAI assistant ID for the ambassador knowledge base assistant. Distinct from any other Gracelyn website assistant. |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token |
| ZOHO_MAIL_CLIENT_ID | Parmeet | OAuth client ID for Zoho Mail |
| ZOHO_MAIL_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Mail |
| ZOHO_MAIL_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Mail |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for WorkDrive |
| WORDPRESS_SITE_URL | Parmeet | Base URL for WordPress REST API session verification |
| WORDPRESS_APP_PASSWORD | Parmeet | Application password for wp-agent5 WordPress user |
| WORDPRESS_APP_USERNAME | Parmeet | Username of the wp-agent5 WordPress user |
| WORKDRIVE_FOLDER_08_ID | Parmeet | WorkDrive Folder 08 ID for brand assets |
| AMBASSADORS_MODULE_API_NAME | Parmeet | Exact API name of Ambassadors module in Zoho CRM |
| SUPPORT_TICKETS_MODULE_API_NAME | Parmeet | Exact API name of Support Tickets module in Zoho CRM. Must match exactly what Agent 4 uses. |
| MAKE_ESCALATION_WEBHOOK_URL | Developer | Make.com webhook URL for Scenario 1 escalation routing |
| SUPPORT_COORDINATOR_EMAIL | Parmeet | Email address of the human support coordinator for escalation delivery |
| VIP_MANAGER_EMAIL | Parmeet | Email address of the VIP relationship manager for VIP escalation copies |
| PARMEET_ALERT_EMAIL | Parmeet | Email for Parmeet-level alerts |
| OPENAI_POLL_INTERVAL_MS | Developer | Milliseconds between OpenAI run completion polls. Default: 2000. |
| OPENAI_POLL_MAX_ATTEMPTS | Developer | Maximum poll attempts before timeout. Default: 15 (30 seconds at 2-second interval). |

| **NOTE** SUPPORT_TICKETS_MODULE_API_NAME must be the exact same value used by Agent 4. Both agents write to and read from the same CRM module. If the names differ, they will be operating on different modules. Confirm this value with Parmeet and share it between Agent 4 and Agent 5 developers before either builds any CRM write logic. |
| --- |
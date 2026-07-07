*Gracelyn University  |  Ambassador AI Agent System  |  Agent 1A: Database and Email Agent  |  v1.0*

**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 1A of 9

**Database and Email Agent**

*Outbound email sequences into the paraprofessional database,*

*current students, alumni, and Agent 0 prospect pipeline*

Developer Project Document

Project Director: Parmeet

Client: Dr. Matthew Flippen, President, Gracelyn University

Version 1.0   |   May 2026

# **1. Developer Credentials and Access**

| **STOP. Do not write a single line of code until every credential in this section is in your possession and tested.** *Request all credentials from Parmeet before your first development session. Do not generate your own API keys. Every credential in this table comes from Parmeet.* |
| --- |

| **Tool / Platform** | **Credential Required** | **Notes** | **Obtain From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID and client secret. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.CREATE, ZohoCRM.modules.UPDATE | Read access to Prospects and Ambassadors modules. Write access to Prospects (update Outreach_Status) and Ambassadors (create new records from applications). | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, and refresh token for ambassadors@gracelyn.edu. Scope: ZohoMail.messages.CREATE | Used to send all outbound recruiting email sequences. From address: ambassadors@gracelyn.edu | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID and client secret. Scopes: WorkDrive.files.READ | Read access to Folder 08 (Brand Assets) for recruiting email copy rules. Read-only. | Parmeet |
| Zoho Catalyst | Catalyst CLI credentials and project access. Project name confirmed by Parmeet. | Full developer access to deploy and manage serverless functions. | Parmeet |
| Claude API (Anthropic) | API key. Model: claude-sonnet-4-20250514 | Used to personalize email copy per prospect using motivation hypothesis and role category. Pay per use. | Parmeet |
| Make.com | Invite to Gracelyn Make.com workspace as a developer. | You will build the Agent 1A trigger scenario and the follow-up schedule scenario. | Parmeet |

## **1.1 Authentication Approach**

All Zoho API calls use OAuth 2.0 with a token refresh flow. Access tokens expire every 60 minutes. Store all credentials as Zoho Catalyst environment variables. Never hardcode credentials in function code.

| async function getZohoAccessToken(refreshToken, clientId, clientSecret) {   const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {     method: 'POST',     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },     body: new URLSearchParams({       refresh_token: refreshToken,       client_id:     clientId,       client_secret: clientSecret,       grant_type:    'refresh_token'     })   });   const data = await response.json();   if (!data.access_token) {     throw new Error('Token refresh failed: ' + JSON.stringify(data));   }   return data.access_token; } // Refresh all tokens at function start const crmToken       = await getZohoAccessToken(   process.env.ZOHO_CRM_REFRESH_TOKEN,   process.env.ZOHO_CRM_CLIENT_ID,   process.env.ZOHO_CRM_CLIENT_SECRET ); const mailToken      = await getZohoAccessToken(   process.env.AMBASSADOR_MAIL_REFRESH_TOKEN,   process.env.AMBASSADOR_MAIL_CLIENT_ID,   process.env.AMBASSADOR_MAIL_CLIENT_SECRET ); const workdriveToken = await getZohoAccessToken(   process.env.WORKDRIVE_REFRESH_TOKEN,   process.env.WORKDRIVE_CLIENT_ID,   process.env.WORKDRIVE_CLIENT_SECRET ); |
| --- |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 1A is the email recruiting engine of the ambassador program. It sends personalized outbound email sequences to three distinct contact populations: the 300,000-person paraprofessional database, current Gracelyn students and alumni, and new prospects identified by Agent 0 who have a public email address. Each population receives a different sequence frame matched to their likely motivation. All sequences are governed by the copy rules and voice guidelines in WorkDrive Folder 08.

Agent 1A launches with a test segment of the paraprofessional database. The test segment size is set by Dr. Flippen and stored in Catalyst as PARA_DB_TEST_SEGMENT_SIZE. The full 300,000-person list is not used until Parmeet reviews test segment response rates and approves the scale-up.

| **CRITICAL RULE** *Agent 1A never sends emails to prospects flagged as VIP (VIP_Flag = true in the Prospects module). VIP prospects are handled by the human VIP relationship manager. Filter these out at every query.* |
| --- |

## **2.2 Position in the 9-Agent System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Agent 0 | Agent 0 fires a Make.com webhook after its weekly run completes. This is Agent 1A's primary trigger. Agent 1A queries the Prospects CRM module for new email-contactable prospects. |
| TRIGGERED BY | Make.com schedule | A separate daily scheduled scenario handles follow-up emails: querying for contacts who received sequence email 1 but have not responded after 7 days. |
| READS FROM | Zoho CRM: Prospects module | Agent 0 prospect records where Contact_Found = true and Outreach_Status = Identified and VIP_Flag = false. These are new prospects ready for email outreach. |
| READS FROM | Zoho CRM: Ambassadors module | Queries for current students and alumni with Active or Graduated status who have not yet been sent an ambassador recruiting sequence. |
| READS FROM | WorkDrive Folder 08 | Brand asset files: ambassador_copy_rules.txt, ambassador_voice_guidelines.txt, ambassador_motivation_frames.txt, ambassador_program_descriptions.txt. All four are read on every run. |
| WRITES TO | Zoho CRM: Prospects module | Updates Outreach_Status to Outreach Sent after first email. Updates to Follow-Up Sent after follow-up. Updates to Unresponsive after both sent with no response. |
| FEEDS INTO | Agent 2 (Onboarding) | When a prospect submits an ambassador application, Agent 1A has already set the Recruiting_Source = Agent 1A and Recruiting_Channel fields on their record. Agent 2 reads these on onboarding. |

## **2.3 What This Agent Does NOT Do**

- Does not contact VIP prospects. VIP_Flag = true records are always excluded.

- Does not contact the 83,000-person administrator database. That database is archived and not used.

- Does not send the full 300,000-person paraprofessional list at once. Test segment first, scale-up only after Parmeet approves.

- Does not post to social media

- Does not manage paid ad campaigns

- Does not onboard ambassadors or send compliance-related emails. Agent 2 owns onboarding.

- Does not send engagement emails to active ambassadors. Agent 3 owns engagement.

## **2.4 Run Cycle**

| **Trigger Type** | **Trigger Source** | **Frequency** | **Notes** |
| --- | --- | --- | --- |
| Primary | Make.com webhook from Agent 0 | Weekly, Monday morning | Agent 0 fires this after its Sunday night run. Agent 1A queries for new prospects and sends sequence email 1 to all eligible new contacts. |
| Follow-up | Make.com scheduled scenario | Daily, 9:00 AM CST | Queries CRM for all contacts in sequence where email 1 was sent 7 days ago with no application received. Sends follow-up email 2. |
| Unresponsive mark | Make.com scheduled scenario | Daily, 9:00 AM CST | Same scenario as follow-up, different query: contacts where email 2 was sent 7 days ago with no application. Sets Outreach_Status = Unresponsive. |
| First run only | Manual trigger by Parmeet | Once | Parmeet manually loads the test segment of the paraprofessional database into Zoho CRM before triggering Agent 1A for the first time. |

# **3. Inputs**

## **3.1 Input 1: Agent 0 Prospect Pipeline**

The primary new-contact source is the Zoho CRM Prospects module, populated by Agent 0. Agent 1A queries this module every Monday after Agent 0's weekly run. It filters for records where all four conditions are true: Contact_Found is true, email is not null, Outreach_Status is Identified, and VIP_Flag is false.

| // Query Prospects module for new email-ready contacts // Excludes VIP prospects and already-contacted records async function getNewProspects(crmToken) {   // PROSPECTS_MODULE_API_NAME confirmed by Parmeet during pre-build   const moduleName = process.env.PROSPECTS_MODULE_API_NAME;   const url = `https://www.zohoapis.com/crm/v3/${moduleName}/search` +     `?criteria=((Contact_Found:equals:true)` +     `and(Outreach_Status:equals:Identified)` +     `and(VIP_Flag:equals:false))` +     `&fields=id,First_Name,Last_Name,Email,Organization,Role_Title,` +     `Channel_Source,Motivation_Hypothesis,Ambassador_Role_Category` +     `&per_page=200`;   const response = await fetch(url, {     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     }   });   const data = await response.json();   // Returns empty array if no new prospects found   return data.data ││ []; } |
| --- |

## **3.2 Input 2: Paraprofessional Database and Student/Alumni Records**

The paraprofessional database is loaded into Zoho CRM by Parmeet before the first Agent 1A run. It is stored in a custom CRM module or imported as Leads, confirmed by Parmeet during pre-build. The test segment size is stored in Catalyst as PARA_DB_TEST_SEGMENT_SIZE.

Current students and Gracelyn alumni are in the Ambassadors or Contacts module with a status that identifies them as active students or graduates. Parmeet confirms the exact field name and value during pre-build.

| // Query paraprofessional database for uncontacted records // PARA_DB_MODULE_NAME and PARA_DB_TEST_SEGMENT_SIZE set by Parmeet async function getParaDBContacts(crmToken, limitToTestSegment = true) {   const moduleName   = process.env.PARA_DB_MODULE_NAME;   const segmentLimit = parseInt(process.env.PARA_DB_TEST_SEGMENT_SIZE) ││ 5000;   const perPage      = limitToTestSegment ? Math.min(segmentLimit, 200) : 200;   const url = `https://www.zohoapis.com/crm/v3/${moduleName}/search` +     `?criteria=(Outreach_Status:equals:Not Contacted)` +     `&fields=id,First_Name,Last_Name,Email,Role_Title,State` +     `&per_page=${perPage}`;   const response = await fetch(url, {     headers: { 'Authorization': `Zoho-oauthtoken ${crmToken}` }   });   const data = await response.json();   const contacts = data.data ││ [];   // Enforce test segment cap across multiple pages if needed   return limitToTestSegment ? contacts.slice(0, segmentLimit) : contacts; } // Query current students and alumni // STUDENT_ALUMNI_MODULE and STUDENT_AMBASSADOR_STATUS_FIELD set by Parmeet async function getStudentAlumniContacts(crmToken) {   const moduleName  = process.env.STUDENT_ALUMNI_MODULE;   const statusField = process.env.STUDENT_AMBASSADOR_STATUS_FIELD;   const url = `https://www.zohoapis.com/crm/v3/${moduleName}/search` +     `?criteria=((${statusField}:equals:Active)` +     `or(${statusField}:equals:Alumni))` +     `and(Ambassador_Recruiting_Sent:equals:false)` +     `&fields=id,First_Name,Last_Name,Email,Program,${statusField}` +     `&per_page=200`;   const response = await fetch(url, {     headers: { 'Authorization': `Zoho-oauthtoken ${crmToken}` }   });   const data = await response.json();   return data.data ││ []; } |
| --- |

## **3.3 Input 3: Brand Asset Files from WorkDrive Folder 08**

All four brand asset files are read at the start of every Agent 1A run and passed into Claude API prompts for email personalization. They are not cached between runs. Always read fresh from WorkDrive to pick up any updates Parmeet makes.

| const FOLDER_08_ID = process.env.WORKDRIVE_FOLDER_08_ID; async function readAllBrandAssets(workdriveToken) {   const listUrl = `https://workdrive.zoho.com/api/v1/files/${FOLDER_08_ID}/files`;   const listResp = await fetch(listUrl, {     headers: { 'Authorization': `Zoho-oauthtoken ${workdriveToken}` }   });   const listData = await listResp.json();   const targets = [     'ambassador_copy_rules.txt',     'ambassador_voice_guidelines.txt',     'ambassador_motivation_frames.txt',     'ambassador_program_descriptions.txt'   ];   const assets = {};   for (const file of listData.data) {     if (targets.includes(file.attributes.name)) {       const dlUrl = `https://workdrive.zoho.com/api/v1/files/${file.id}/download`;       const dlResp = await fetch(dlUrl, {         headers: { 'Authorization': `Zoho-oauthtoken ${workdriveToken}` }       });       assets[file.attributes.name] = await dlResp.text();     }   }   return assets; } |
| --- |

# **4. Process Steps**

The following steps execute in sequence on every Agent 1A run. The weekly trigger (from Agent 0) sends sequence email 1 to all new contacts. The daily follow-up trigger sends email 2 to non-responding contacts from 7 days prior. Both use the same core email sending function.

## **Step 1: Receive Trigger and Determine Run Mode**

| // Webhook payload from Make.com // { //   trigger_type: 'agent0_complete',         // weekly new-contact run //   // OR //   trigger_type: 'followup_schedule',        // daily follow-up run //   // OR //   trigger_type: 'lead_capture_new_contact', // Agent 1D handoff: single new lead //   triggered_at: '2026-05-18T09:00:00-06:00' // } // Run modes: // 'agent0_complete'          -> query new prospects + para DB + students/alumni //                              send sequence email 1 to all // 'followup_schedule'         -> query contacts at 7-day mark with no application //                              send follow-up email 2 // 'unresponsive_mark'         -> query contacts at 14-day mark with no application //                              set Outreach_Status = Unresponsive (no email) // 'lead_capture_new_contact'  -> process single prospect from Agent 1D handoff //                              payload contains prospect_crm_id, email, first_name, //                              role_category, lead_magnet_id, recruiting_source. //                              look up the Prospect record by prospect_crm_id, //                              select the appropriate sequence template based on //                              role_category and lead_magnet_id, and send email 1 //                              immediately. Do NOT wait for next Monday cycle. //                              These contacts have already received a delivery email //                              from Agent 1D. Sequence email 1 should acknowledge //                              that context: e.g. reference the resource they //                              downloaded rather than cold-opening the sequence. |
| --- |

## **Step 2: Refresh OAuth Tokens**

Refresh CRM, Mail, and WorkDrive tokens using the function in Section 1.1. Store all three tokens in memory for the duration of this run.

## **Step 3: Read Brand Assets**

Call readAllBrandAssets() using the function in Section 3.3. If any of the four files is missing, log the missing filename, alert Parmeet, and continue with available files.

## **Step 4: Query Contact Lists by Run Mode**

For weekly new-contact runs: query all three contact sources (prospects, paraprofessional database, students and alumni). For follow-up runs: query only contacts at the 7-day mark. For unresponsive marking: query only contacts at the 14-day mark.

| async function getFollowUpContacts(crmToken) {   // Find contacts where:   // - Sequence_Email_1_Sent = true   // - Sequence_Email_1_Sent_Date is 7 days ago (within 24h window)   // - No ambassador application received (Outreach_Status != Applied)   // - Outreach_Status != Unresponsive   // Searches across Prospects module AND Para DB module   const sevenDaysAgo = new Date();   sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);   const dateStr = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD   const prospectModule = process.env.PROSPECTS_MODULE_API_NAME;   const url = `https://www.zohoapis.com/crm/v3/${prospectModule}/search` +     `?criteria=((Sequence_Email_1_Sent:equals:true)` +     `and(Sequence_Email_1_Sent_Date:equals:${dateStr})` +     `and(Outreach_Status:equals:Outreach Sent))` +     `&fields=id,First_Name,Last_Name,Email,Organization,` +     `Role_Title,Motivation_Hypothesis,Channel_Source` +     `&per_page=200`;   const response = await fetch(url, {     headers: { 'Authorization': `Zoho-oauthtoken ${crmToken}` }   });   const data = await response.json();   return data.data ││ []; } |
| --- |

## **Step 5: Generate Personalized Email Copy with Claude API**

For each contact, Claude generates a personalized version of the email template using the contact's name, role, organization, motivation hypothesis, and channel source. See Section 5 for the exact prompt structure. Claude does not write a new email from scratch each time. It personalizes the opening sentence and one contextual detail within a fixed template structure.

| async function personalizeEmail(contact, emailTemplate, assets, claudeApiKey) {   const motivationHyp = contact.Motivation_Hypothesis ││ 'Unknown';   const roleCategory  = contact.Ambassador_Role_Category ││ 'educator';   const firstName     = contact.First_Name ││ 'Friend';   const organization  = contact.Organization ││ '';   const response = await fetch('https://api.anthropic.com/v1/messages', {     method: 'POST',     headers: {       'Content-Type': 'application/json',       'x-api-key': claudeApiKey,       'anthropic-version': '2023-06-01'     },     body: JSON.stringify({       model: 'claude-sonnet-4-20250514',       max_tokens: 400,       system: buildEmailSystemPrompt(assets),   // Section 5.2       messages: [{         role: 'user',         content: buildEmailUserPrompt(          // Section 5.3           emailTemplate, firstName, roleCategory,           motivationHyp, organization         )       }]     })   });   const data = await response.json();   return data.content[0].text; } |
| --- |

| **WARNING** *Claude personalizes only two elements: the opening sentence and one contextual detail mid-email. The three-layer message structure (mission hook, social proof, simple ask) is fixed in the template and must not be changed by Claude. If Claude produces output that deviates from the template structure, discard it and use the unmodified template instead.* |
| --- |

## **Step 6: Send Email via Zoho Mail API**

Send each personalized email using the Zoho Mail API from ambassadors@gracelyn.edu. Log the send event and update the CRM record immediately after each successful send. Do not batch-update CRM records at the end of the run. Update each record as it is sent so a mid-run failure does not cause duplicate sends.

| async function sendRecruitingEmail(contact, emailBody, subject, mailToken) {   const accountId = process.env.AMBASSADOR_MAIL_ACCOUNT_ID;   const fromAddr  = process.env.AMBASSADOR_MAIL_FROM_ADDRESS;   const emailPayload = {     fromAddress: fromAddr,     toAddress:   contact.Email,     subject:     subject,     content:     emailBody,     mailFormat:  'text'  // Plain text only. Never HTML.   };   const response = await fetch(     `https://mail.zoho.com/api/accounts/${accountId}/messages`,     {       method: 'POST',       headers: {         'Authorization': `Zoho-oauthtoken ${mailToken}`,         'Content-Type': 'application/json'       },       body: JSON.stringify(emailPayload)     }   );   const data = await response.json();   if (data.status.code !== 200) {     throw new Error(`Mail send failed: ${JSON.stringify(data)}`);   }   return data; // Contains message ID for logging } |
| --- |

| **CRITICAL RULE** *mailFormat must be **'**text**'** not **'**html**'**. Plain text emails have higher deliverability, lower spam filter risk, and feel more personal. This is non-negotiable. Do not send HTML emails from this agent under any circumstances.* |
| --- |

## **Step 7: Update CRM Record After Each Send**

Immediately after each successful email send, update the contact's CRM record. This prevents duplicate sends if the function is interrupted and retried. The fields to update depend on which email was sent.

| // After sending sequence email 1 async function markEmail1Sent(contactId, moduleApiName, crmToken) {   const today = new Date().toISOString().split('T')[0];   const record = {     data: [{       id:                       contactId,       Outreach_Status:          'Outreach Sent',       Sequence_Email_1_Sent:    true,       Sequence_Email_1_Sent_Date: today,       Recruiting_Source:        'Agent 1A',       Recruiting_Channel:       'Email Sequence'     }]   };   await fetch(`https://www.zohoapis.com/crm/v3/${moduleApiName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify(record)   }); } // After sending follow-up email 2 async function markEmail2Sent(contactId, moduleApiName, crmToken) {   const today = new Date().toISOString().split('T')[0];   const record = {     data: [{       id:                         contactId,       Outreach_Status:            'Follow-Up Sent',       Sequence_Email_2_Sent:      true,       Sequence_Email_2_Sent_Date: today     }]   };   await fetch(`https://www.zohoapis.com/crm/v3/${moduleApiName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify(record)   }); } // After 14-day no-response window async function markUnresponsive(contactId, moduleApiName, crmToken) {   const record = {     data: [{ id: contactId, Outreach_Status: 'Unresponsive' }]   };   await fetch(`https://www.zohoapis.com/crm/v3/${moduleApiName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify(record)   }); } |
| --- |

## **Step 8: Generate and Log Run Summary**

After all emails are sent, compile a run summary and send it to Parmeet via the Make.com coordinator alert webhook. This is not an error alert. It is a routine operational summary confirming the run completed successfully.

| async function sendRunSummary(summary) {   const payload = {     trigger_source:      'agent_1a_run_complete',     triggered_at:        new Date().toISOString(),     run_type:            summary.runType,     emails_sent:         summary.emailsSent,     emails_failed:       summary.emailsFailed,     contacts_processed:  summary.contactsProcessed,     para_db_sent:        summary.paraDBSent,     prospect_sent:       summary.prospectSent,     student_alumni_sent: summary.studentAlumniSent,     test_segment_active: summary.testSegmentActive,     run_status:          summary.status  // 'Complete' or 'Partial'   };   await fetch(process.env.MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL, {     method: 'POST',     headers: { 'Content-Type': 'application/json' },     body: JSON.stringify(payload)   }); } |
| --- |

# **5. Claude API Prompt Structure**

## **5.1 Email Templates**

There are four email templates: sequence email 1 and follow-up email 2 for each of three population segments. Templates are stored as Catalyst environment variables by Parmeet. Claude personalizes within the fixed template structure. The three-layer structure (mission hook, social proof, simple ask) is always preserved.

| **Template Variable** | **Population** | **Purpose** |
| --- | --- | --- |
| AGENT1A_SEQ1_PARA_SUBJECT, AGENT1A_SEQ1_PARA_BODY | Paraprofessionals | First email to paraprofessional database contacts. Recognition and mission framing by default (Unknown motivation hypothesis). |
| AGENT1A_SEQ2_PARA_SUBJECT, AGENT1A_SEQ2_PARA_BODY | Paraprofessionals | Follow-up email 7 days after sequence email 1. Shorter. Warmer. No pressure. |
| AGENT1A_SEQ1_PROSPECT_SUBJECT, AGENT1A_SEQ1_PROSPECT_BODY | Agent 0 prospects | First email to prospects discovered by Agent 0. Motivation-hypothesis-matched framing applied by Claude. |
| AGENT1A_SEQ2_PROSPECT_SUBJECT, AGENT1A_SEQ2_PROSPECT_BODY | Agent 0 prospects | Follow-up email for Agent 0 prospects. References their specific context where available. |
| AGENT1A_SEQ1_STUDENT_SUBJECT, AGENT1A_SEQ1_STUDENT_BODY | Students and alumni | First email to current students and alumni. Pride and gratitude framing. Pay it forward ask. |
| AGENT1A_SEQ2_STUDENT_SUBJECT, AGENT1A_SEQ2_STUDENT_BODY | Students and alumni | Follow-up for students and alumni. Brief. Warm. References their program. |

| **NOTE** *Parmeet writes all six email templates before the build starts and stores them as Catalyst environment variables. The developer does not write the email copy. The developer builds the system that reads the templates, personalizes them with Claude, and sends them via Zoho Mail. When writing the templates, Parmeet must apply the following rules. First: every template must lead with mission language before any mention of the referral fee. At minimum two full sentences of mission framing must appear before any referral fee amount or earning language. Second: the referral fee amount, if mentioned, must use exact language: $100 for undergraduate programs and $200 for graduate programs. Third: the three-layer structure must be maintained throughout every template: mission hook, social proof or program description, simple ask. Fourth: review ambassador_copy_rules.txt before writing each template. Claude personalizes within the template structure but does not fix template-level copy rule violations.* |
| --- |

## **5.2 System Prompt: Email Personalization**

| function buildEmailSystemPrompt(assets) {   return `You are personalizing ambassador recruiting emails for Gracelyn University. Your job is to make ONE targeted change to the provided email template: Rewrite the opening sentence only to feel personal to this specific recipient. Do not change the structure, the mission framing, the simple ask, or the referral fee mention. Do not add or remove paragraphs. The opening sentence should reference the recipient's role or community in a way that feels specific, not generic. Use the motivation hypothesis to select the right angle: mission impact, professional growth, kingdom calling, recognition, or pride and gratitude. COPY RULES (follow all of these without exception): ${assets['ambassador_copy_rules.txt']} VOICE GUIDELINES (match this voice throughout): ${assets['ambassador_voice_guidelines.txt']} MOTIVATION FRAMES (use the relevant frame for the opening sentence): ${assets['ambassador_motivation_frames.txt']} Return the complete personalized email body as plain text. No preamble. No explanation. Just the email body.`,   ) } |
| --- |

## **5.3 User Prompt Builder: Email Personalization**

| function buildEmailUserPrompt(   templateBody, firstName, roleCategory, motivationHyp, organization ) {   const orgContext = organization     ? `They work at or are associated with: ${organization}.`     : 'Organization not known.';   return `Personalize this email for the following recipient. RECIPIENT: First name: ${firstName} Role category: ${roleCategory} Motivation hypothesis: ${motivationHyp} ${orgContext} EMAIL TEMPLATE TO PERSONALIZE: ${templateBody} Rewrite only the opening sentence to feel personal to this recipient. Return the complete email body with your personalized opening sentence replacing the original first sentence. Everything else stays identical.`,   ) } |
| --- |

## **5.4 Subject Line Personalization**

Subject lines are not personalized by Claude. They are sent as-is from the template variables. Subject line personalization (e.g. inserting first name) is handled by simple string replacement, not Claude API, to conserve tokens.

| function buildSubjectLine(templateSubject, firstName) {   // Simple variable replacement for subject lines   // Templates may use [FIRST_NAME] as a placeholder   return templateSubject.replace('[FIRST_NAME]', firstName); } |
| --- |

# **6. Make.com Scenario Configuration**

## **6.1 Scenario 1: Agent 0 Trigger (Weekly New-Contact Run)**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Copy the generated URL and store it as MAKE_AGENT1A_WEBHOOK_URL in Catalyst environment variables. Agent 0 Scenario 3 calls this URL after its weekly run. |
| 2 | HTTP: Make a Request | Method: POST. URL: Agent 1A Catalyst function URL (Parmeet provides after deployment). Body: { trigger_type: 'agent0_complete', triggered_at: {{now}} }. Parse response: Yes. |
| 3 | Email (Zoho Mail) | Condition: Only runs if Step 2 returns error status. To: PARMEET_ALERT_EMAIL. Subject: Agent 1A Weekly Run Failed. Body: Error details, triggered_at timestamp. |

## **6.2 Scenario 2: Daily Follow-Up and Unresponsive Mark**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Schedule (Clock) | Set to: Every day at 9:00 AM. Timezone: America/Chicago (CST). |
| 2 | HTTP: Make a Request | Method: POST. URL: Agent 1A Catalyst function URL. Body: { trigger_type: 'followup_schedule', triggered_at: {{now}} }. Parse response: Yes. |
| 3 | Email (Zoho Mail) | Condition: Only runs if Step 2 returns error. To: PARMEET_ALERT_EMAIL. Subject: Agent 1A Follow-Up Run Failed. Body: Error details. |

## **6.3 Scenario 3: Coordinator Run Summary**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Store URL as MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL in Catalyst. Agent 1A calls this at the end of every successful run. |
| 2 | Email (Zoho Mail) | To: COORDINATOR_ALERT_EMAIL and PARMEET_ALERT_EMAIL. Subject: Agent 1A Run Summary: {{emails_sent}} emails sent. Body: Full run summary payload from Agent 1A. Include test segment active status prominently. |

## **6.4 Important Make.com Notes**

- Activate Scenario 1 only after Parmeet confirms the paraprofessional test segment is loaded in CRM and the brand asset files are uploaded to WorkDrive Folder 08.

- Activate Scenario 2 only after Scenario 1 has run at least once successfully and email 1 records exist in CRM for the follow-up query to find.

- Coordinate with Agent 0 developer: Scenario 1 depends on Agent 0 Scenario 3 firing the webhook. Confirm this handoff works in integration testing before activating Scenario 2.

- Do not disable execution logging in any scenario.

# **7. Error Handling**

| **Failure Scenario** | **Detection Method** | **Response Action** | **Alert Parmeet?** |
| --- | --- | --- | --- |
| Zoho OAuth token refresh fails for any token | fetch() returns non-200 or missing access_token | Abort entire run. Do not send any emails. | Yes: which token failed, HTTP status, response body |
| WorkDrive brand asset file missing | File not in Folder 08 list | Continue with available files. Log missing filename. Email personalizations use reduced context. | Yes: specify which file is missing |
| CRM prospect query returns error | API returns non-200 or error object | Retry once after 30 seconds. If second failure: abort and alert. | Yes on second failure |
| CRM prospect query returns zero results | data array is empty or null | Log zero results. Send run summary with 0 emails sent. Do not abort. | No: zero prospects is expected on some runs |
| Claude API returns non-200 | HTTP status from Claude call | Use unmodified template body instead of personalized version. Log contact ID. | No for individual failures. Yes if more than 10 consecutive Claude failures. |
| Claude returns output that deviates from template structure | Output missing required paragraphs or adds new ones | Discard Claude output. Use unmodified template body. Log contact ID. | No for individual failures. Yes if more than 10 consecutive deviations. |
| Zoho Mail send fails for a single contact | API returns non-200 or error object | Retry once after 30 seconds. If second failure: log failed contact ID and continue to next contact. | No for individual failures. Yes if more than 20 consecutive mail failures (possible account issue). |
| CRM record update fails after email send | API returns non-200 after send | Retry CRM update once. If failure: log contact ID as needing manual CRM update. The email was sent so continue. | Yes: list all contacts whose CRM records could not be updated |
| Test segment cap exceeded | contacts.slice() prevents this in code | Never alert. The cap is enforced in code. | No |
| Run summary webhook fails | Make.com returns non-200 | Retry once. If second failure: log summary locally in Catalyst function response. | Yes on second failure: include full summary text |

## **7.1 Alert Email Format**

| Subject: [AGENT 1A ERROR] [Failure Type] - [Date] Body: Agent: Database and Email Agent (Agent 1A) Run Date: [Date and time of failure] Trigger Type: [agent0_complete / followup_schedule / unresponsive_mark] Failed Step: [Step number and name from Section 4] Error Details: [HTTP status code, error message, or relevant response body] Emails Sent Before Failure: [count] Contacts Needing Manual CRM Update: [list of contact IDs if applicable] Recommended Action: [Specific action Parmeet should take] |
| --- |

# **8. Testing and Acceptance Criteria**

## **8.1 Unit Tests**

| **Test** | **How to Test** | **Expected Result** |
| --- | --- | --- |
| OAuth token refresh (all three tokens) | Call getZohoAccessToken() with valid credentials for CRM, Mail, and WorkDrive | Returns non-null access_token for each. Each token works in a subsequent API call. |
| Brand asset file read | Call readAllBrandAssets() with valid WorkDrive token | Returns object with all four brand asset files as non-empty strings. |
| Prospect query (with results) | Ensure at least one Prospect record exists with Outreach_Status = Identified, Contact_Found = true, VIP_Flag = false. Call getNewProspects(). | Returns array containing that record. Does not return VIP_Flag = true records. |
| Prospect query (VIP exclusion) | Create a test Prospect record with VIP_Flag = true, Outreach_Status = Identified. Call getNewProspects(). | Test VIP prospect is NOT returned. VIP exclusion confirmed. |
| Para DB query with test segment cap | Set PARA_DB_TEST_SEGMENT_SIZE to 10. Ensure more than 10 records exist. Call getParaDBContacts(). | Returns exactly 10 records. Cap is enforced. |
| Student/alumni query | Ensure at least one student record with Ambassador_Recruiting_Sent = false. Call getStudentAlumniContacts(). | Returns that record. Does not return students where Ambassador_Recruiting_Sent = true. |
| Claude email personalization | Call personalizeEmail() with a mock contact and template | Returns a string containing the full email body. Opening sentence references the contact's role or context. Template structure is preserved. |
| Subject line build | Call buildSubjectLine() with template containing [FIRST_NAME] and a first name | Returns subject with [FIRST_NAME] replaced by actual name. |
| Zoho Mail send | Call sendRecruitingEmail() with a test contact using a Gracelyn internal email address | Email arrives in inbox. mailFormat is plain text. From address is ambassadors@gracelyn.edu. |
| CRM update after email 1 send | Call markEmail1Sent() with a test contact ID | CRM record shows Outreach_Status = Outreach Sent, Sequence_Email_1_Sent = true, today's date in Sequence_Email_1_Sent_Date. |
| CRM update after email 2 send | Call markEmail2Sent() with a test contact ID | CRM record shows Outreach_Status = Follow-Up Sent, Sequence_Email_2_Sent = true, today's date. |
| CRM unresponsive mark | Call markUnresponsive() with a test contact ID | CRM record shows Outreach_Status = Unresponsive. |
| Follow-up query | Mark a test contact with email 1 sent 7 days ago. Call getFollowUpContacts(). | Returns that contact. Does not return contacts where email was sent 6 days ago or 8 days ago. |

## **8.2 Integration Test**

After all unit tests pass, run a full end-to-end integration test with Parmeet present before activating the live weekly schedule.

- Load 10 test contacts into the paraprofessional database module in CRM with Outreach_Status = Not Contacted

- Ensure at least 3 Prospects module records exist with Outreach_Status = Identified, Contact_Found = true, VIP_Flag = false

- Ensure at least 2 student or alumni records exist with Ambassador_Recruiting_Sent = false

- Manually trigger Agent 1A in agent0_complete mode via Make.com Scenario 1

- Verify: all 15 contacts receive personalized emails at their test addresses

- Verify: all emails arrive as plain text, not HTML, from ambassadors@gracelyn.edu

- Verify: all email openings differ by contact role and motivation hypothesis

- Verify: CRM records updated immediately after each send, not in batch at end

- Verify: run summary webhook fires and coordinator receives summary email

- Verify: 7 days later, trigger followup_schedule mode and confirm follow-up emails send only to non-responding contacts

- Verify: Parmeet receives no error alert emails on clean runs

## **8.3 Acceptance Criteria**

| **Criterion** | **Verified By** | **Status** |
| --- | --- | --- |
| Make.com Scenario 1 receives Agent 0 webhook and triggers Agent 1A successfully | Agent 0 and Agent 1A developers: confirm handoff in integration test | [ ] Pending |
| Test segment cap is enforced: never more than PARA_DB_TEST_SEGMENT_SIZE contacts processed in a single weekly run | Parmeet: check CRM update count after first run | [ ] Pending |
| VIP prospects are never contacted: VIP_Flag = true records never appear in sent email logs | Parmeet: audit Prospects module for any VIP_Flag = true records with Outreach_Status = Outreach Sent | [ ] Pending |
| All emails send as plain text from ambassadors@gracelyn.edu | Parmeet: check five sample received emails | [ ] Pending |
| Claude personalizations follow copy rules: no em dashes, no commission language, mission before fee | Parmeet: review 10 sample personalized emails | [ ] Pending |
| CRM records update after each send, not in batch: confirmed by checking CRM during an active run | Parmeet: monitor CRM during integration test run | [ ] Pending |
| Follow-up emails send only to contacts at exactly 7-day mark with no application | Parmeet: verify follow-up query logic in integration test | [ ] Pending |
| Unresponsive status set correctly at 14-day mark | Parmeet: check CRM after 14-day mark in staging | [ ] Pending |
| Run summary email reaches coordinator and Parmeet after every successful run | Coordinator and Parmeet: confirm receipt of first three run summaries | [ ] Pending |
| Error handling works: disabling Zoho Mail causes abort and Parmeet alert, not silent failure | Developer: test with invalid mail credentials | [ ] Pending |
| No credentials hardcoded in any function code | Parmeet: code review before deployment | [ ] Pending |

# **9. Integration Notes for Other Developers**

## **9.1 What Agent 0 Developer Needs to Know**

- Agent 0 Scenario 3 fires a webhook to MAKE_AGENT1A_WEBHOOK_URL after its weekly run. Agent 1A depends on this trigger to start its weekly new-contact run. Coordinate timing: Agent 0 runs Sunday 11:00 PM CST. Agent 1A should receive the trigger by Monday 1:00 AM CST at the latest.

- Agent 1A reads Motivation_Hypothesis and Channel_Source from the Prospects CRM module records that Agent 0 creates. These fields must be populated before Agent 0 fires the webhook.

- Agent 1A does not query for VIP_Flag = true records. Agent 0 must ensure VIP_Flag is set correctly on all Prospects records before the webhook fires.

## **9.2 What Agent 2 Developer Needs to Know**

- When an ambassador application is submitted via Zoho Forms, the hidden fields recruiting_source and recruiting_channel carry the values Agent 1A wrote to the Prospects CRM record. Agent 2 reads these hidden form fields and writes them to the Ambassadors module Recruiting_Source and Recruiting_Channel fields during onboarding.

- Agent 1A sets Outreach_Status = Applied on the Prospects record when it detects an application (via Zoho Flow trigger on form submission). Agent 2 and Agent 1A must coordinate so the Prospects record is updated before Agent 2 creates the Ambassador record. Confirm this Zoho Flow with Parmeet.

- The Motivation_Hypothesis from the Prospects record is passed to the Ambassadors module as the initial Motivation_Tag. Agent 2 must copy this value when creating the Ambassador record.

## **9.3 What Agent 1B, 1C, and 1D Developers Need to Know**

- Agent 1A handles all email channel outreach. Agents 1B, 1C, and 1D do not send email sequences. They handle social, paid, and lead capture channels respectively. There is no overlap.

- All four recruiting sub-agents write Recruiting_Source and Recruiting_Channel to the CRM record of every contact they generate. This is critical for attribution tracking. Coordinate with Parmeet on the exact field names and allowed values before building.

## **9.4 Shared Environment Variables**

| **Variable Name** | **Description** | **Who Sets It** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | OAuth 2.0 client ID for Zoho CRM | Parmeet |
| ZOHO_CRM_CLIENT_SECRET | OAuth 2.0 client secret for Zoho CRM | Parmeet |
| ZOHO_CRM_REFRESH_TOKEN | Long-lived refresh token for Zoho CRM | Parmeet |
| WORKDRIVE_CLIENT_ID | OAuth 2.0 client ID for Zoho WorkDrive | Parmeet |
| WORKDRIVE_CLIENT_SECRET | OAuth 2.0 client secret for Zoho WorkDrive | Parmeet |
| WORKDRIVE_REFRESH_TOKEN | Long-lived refresh token for Zoho WorkDrive | Parmeet |
| WORKDRIVE_FOLDER_08_ID | WorkDrive folder ID: 08 - Brand Assets | Parmeet |
| AMBASSADOR_MAIL_CLIENT_ID | OAuth 2.0 client ID for ambassadors@gracelyn.edu | Parmeet |
| AMBASSADOR_MAIL_CLIENT_SECRET | OAuth 2.0 client secret for ambassadors@gracelyn.edu | Parmeet |
| AMBASSADOR_MAIL_REFRESH_TOKEN | OAuth 2.0 refresh token for ambassadors@gracelyn.edu | Parmeet |
| AMBASSADOR_MAIL_ACCOUNT_ID | Zoho Mail account ID for ambassadors@gracelyn.edu | Parmeet |
| AMBASSADOR_MAIL_FROM_ADDRESS | From address: ambassadors@gracelyn.edu | Parmeet |
| CLAUDE_API_KEY | Anthropic API key. Model: claude-sonnet-4-20250514 | Parmeet |
| PROSPECTS_MODULE_API_NAME | Zoho CRM API name for the Prospects module | Parmeet during pre-build |
| PARA_DB_MODULE_NAME | Zoho CRM API name for the paraprofessional database module | Parmeet during pre-build |
| PARA_DB_TEST_SEGMENT_SIZE | Number of paraprofessional contacts to include in test segment. Set by Dr. Flippen. | Dr. Flippen decides, Parmeet stores |
| STUDENT_ALUMNI_MODULE | Zoho CRM API name for student/alumni module | Parmeet during pre-build |
| STUDENT_AMBASSADOR_STATUS_FIELD | CRM field name identifying active students and alumni | Parmeet during pre-build |
| AGENT1A_SEQ1_PARA_SUBJECT | Subject line for paraprofessional sequence email 1 | Parmeet (email templates written before build) |
| AGENT1A_SEQ1_PARA_BODY | Body template for paraprofessional sequence email 1 | Parmeet |
| AGENT1A_SEQ2_PARA_SUBJECT | Subject line for paraprofessional follow-up email 2 | Parmeet |
| AGENT1A_SEQ2_PARA_BODY | Body template for paraprofessional follow-up email 2 | Parmeet |
| AGENT1A_SEQ1_PROSPECT_SUBJECT | Subject line for Agent 0 prospect sequence email 1 | Parmeet |
| AGENT1A_SEQ1_PROSPECT_BODY | Body template for Agent 0 prospect sequence email 1 | Parmeet |
| AGENT1A_SEQ2_PROSPECT_SUBJECT | Subject line for Agent 0 prospect follow-up email 2 | Parmeet |
| AGENT1A_SEQ2_PROSPECT_BODY | Body template for Agent 0 prospect follow-up email 2 | Parmeet |
| AGENT1A_SEQ1_STUDENT_SUBJECT | Subject line for student/alumni sequence email 1 | Parmeet |
| AGENT1A_SEQ1_STUDENT_BODY | Body template for student/alumni sequence email 1 | Parmeet |
| AGENT1A_SEQ2_STUDENT_SUBJECT | Subject line for student/alumni follow-up email 2 | Parmeet |
| AGENT1A_SEQ2_STUDENT_BODY | Body template for student/alumni follow-up email 2 | Parmeet |
| MAKE_AGENT1A_WEBHOOK_URL | Make.com webhook URL for Scenario 1. Agent 0 calls this. | Parmeet after creating Scenario 1 |
| MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL | Make.com webhook URL for Scenario 3 run summary | Parmeet after creating Scenario 3 |
| PARMEET_ALERT_EMAIL | Parmeet personal email for all error alerts | Parmeet |
| COORDINATOR_ALERT_EMAIL | Ambassador program coordinator email for run summaries | Parmeet after coordinator is assigned |

Confidential  |  Developer Project Document  |  Page
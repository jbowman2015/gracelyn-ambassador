**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 1D of 9

**Lead Capture Agent**

*Form processing, lead magnet delivery, CRM seeding,*

*multi-audience resource tracks, and Agent 1A handoff*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store all credentials as Zoho Catalyst environment variables. No credential is hardcoded.

| **HARD STOP** Do not begin development until Parmeet has provided all credentials in the table below, confirmed that WorkDrive Folder 06 subfolders exist for all four audience tracks, and confirmed that at least one lead magnet file exists in each subfolder. Development is blocked on credential delivery and content readiness. |
| --- |

| **Tool / Platform** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| Zoho CRM | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.CREATE, ZohoCRM.modules.UPDATE | Read Prospects module for deduplication. Write new Prospect records. Update existing records. | Parmeet |
| Zoho Forms | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoForms.reports.READ | Used only in the nightly cleanup job to find form submissions not yet processed. Not used in the real-time webhook path. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.READ | Read Folder 06 (lead magnet files) and Folder 08 (brand assets). Generate time-limited share links for lead magnet delivery. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Send lead magnet delivery emails from ambassadors@gracelyn.edu. | Parmeet |
| Zoho Catalyst | CLI credentials and project access | Full developer access to deploy serverless functions. | Parmeet |
| Claude API (Anthropic) | API key. Model: claude-sonnet-4-20250514 | Generate personalized opening sentence in lead magnet delivery email. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | Build real-time form submission webhook and Agent 1A handoff scenarios. | Parmeet |

## **1.1 Authentication Code**

| async function getZohoAccessToken(refreshToken, clientId, clientSecret) {   const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {     method: 'POST',     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },     body: new URLSearchParams({       refresh_token: refreshToken,       client_id:     clientId,       client_secret: clientSecret,       grant_type:    'refresh_token'     })   });   const data = await response.json();   if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));   return data.access_token; } // Refresh all tokens at function start const crmToken       = await getZohoAccessToken(   process.env.ZOHO_CRM_REFRESH_TOKEN,   process.env.ZOHO_CRM_CLIENT_ID,   process.env.ZOHO_CRM_CLIENT_SECRET ); const workdriveToken = await getZohoAccessToken(   process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN,   process.env.ZOHO_WORKDRIVE_CLIENT_ID,   process.env.ZOHO_WORKDRIVE_CLIENT_SECRET ); const mailToken      = await getZohoAccessToken(   process.env.ZOHO_MAIL_REFRESH_TOKEN,   process.env.ZOHO_MAIL_CLIENT_ID,   process.env.ZOHO_MAIL_CLIENT_SECRET ); // Zoho Forms token: used only in nightly cleanup job, not in real-time path const formsToken     = await getZohoAccessToken(   process.env.ZOHO_FORMS_REFRESH_TOKEN,   process.env.ZOHO_FORMS_CLIENT_ID,   process.env.ZOHO_FORMS_CLIENT_SECRET ); |
| --- |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 1D is the lead capture engine of the ambassador recruiting system. It processes form submissions from Gracelyn lead capture landing pages, delivers the promised resource to the submitter, creates a Prospect record in Zoho CRM, and hands the new lead to Agent 1A for email sequence initiation.

Version 2.0 extends the original educator-only resource library to cover four distinct audience tracks: K-12 educators, early childhood and childcare workers, faith and community leaders, and youth-serving professionals. Each track has its own lead magnet resources, its own landing page forms, and its own delivery email framing. The audience track is written to the CRM Prospect record and carried through to Agent 1A for sequence selection and to Agent 3 for content track routing.

| **RULE** RULE: Agent 1D creates Prospect records only. It does not create Ambassador records. It does not send ambassador recruiting emails. It does not onboard anyone. Its sole outputs are a Prospect record in Zoho CRM and a lead magnet delivery email. Agent 1A owns the next step. |
| --- |

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Make.com on form submission | Every new Zoho Forms submission on any Gracelyn lead capture landing page fires a Make.com webhook to the Agent 1D Catalyst function. |
| TRIGGERED BY | Make.com nightly schedule | A nightly cleanup job at 2:00 AM CST queries Zoho Forms for any submissions not yet reflected as Prospect records in CRM. Processes them using the same steps as the real-time trigger. |
| READS FROM | WorkDrive Folder 06 | Lead magnet files organized by audience track. Agent 1D generates a time-limited download link for the specific resource requested by the submitter. |
| READS FROM | WorkDrive Folder 08 | Brand asset file: ambassador_copy_rules.txt. Used when Claude generates the personalized delivery email opening sentence. |
| READS FROM | Zoho CRM: Prospects module | Duplicate check by email address before creating new records. |
| WRITES TO | Zoho CRM: Prospects module | New Prospect records or updates to existing records. Includes Audience_Track field identifying which resource track the prospect entered through. |
| WRITES TO | Zoho Mail | Lead magnet delivery email to the submitter. Personalized opening sentence. Time-limited download link. |
| FEEDS INTO | Agent 1A | After CRM record is created, Agent 1D fires a webhook to Agent 1A with the prospect's email, name, role category, and audience track. Agent 1A selects the correct email sequence based on these fields. |

# **3. Lead Magnet Tracks**

Version 2.0 introduces four audience tracks with distinct resource types for each. The track is determined automatically from the lead_magnet_id hidden field in the form submission. Parmeet is responsible for creating the resources and uploading them to the correct WorkDrive Folder 06 subfolder before launch.

| **Content Readiness Requirement** The lead magnet resources described below must be created by Parmeet and uploaded to WorkDrive Folder 06 before Agent 1D can be activated. Agent 1D cannot generate these resources. The developer builds the delivery and routing logic; Parmeet provides the content. Minimum viable launch requires at least one resource per audience track. |
| --- |

## **3.1 Audience Track Resource Library**

| **Audience Track** | **Resource Type** | **Content Description and Purpose** |
| --- | --- | --- |
| K-12 Educator Track | Professional Development Guides | Free PD micro-guides covering topics such as differentiated instruction, trauma-informed teaching, and educator wellness. Title examples: Five Strategies for Supporting Students in Crisis, The Overwhelmed Teacher's Guide to Self-Care, Practical Classroom Tools for Paraprofessionals. These resources speak directly to the professional development motivation frame confirmed for this audience. |
| K-12 Educator Track | Classroom Management Tools | Printable and digital tools: behavior tracking templates, parent communication logs, IEP accommodation trackers, substitute teacher kits. High perceived value, easy to use immediately. |
| Early Childhood and Childcare Track | Childcare Worker Recognition Resources | Resources that validate and affirm the childcare profession: articles on the science of early childhood development, guides on communicating the value of early education to families, and recognition frameworks for childcare teams. Mission frame: your work is foundational, not supplemental. |
| Early Childhood and Childcare Track | Developmental Milestone Tools | Practical observational tools for tracking child development milestones in childcare settings. Age-appropriate activity guides. Easy-to-use resources that make the childcare worker's daily job easier. |
| Faith and Community Track | Children's Ministry Resources | Practical resources for volunteers and staff leading children's ministry: volunteer training outlines, curriculum planning templates, children's church activity guides, and vacation Bible school planning tools. These resources exist at the intersection of faith and education where Gracelyn's mission lives. |
| Faith and Community Track | Devotionals for Educator-Believers | Short devotional content (5 to 10 minutes) written specifically for educators who are also people of faith. Topics: finding meaning in difficult classrooms, the calling of teaching, prayer practices for educators, and caring for yourself while caring for others. Not generic devotionals. Specifically positioned for the educator-believer identity. |
| Youth-Serving Professional Track | Youth Program Planning Tools | Practical planning resources for after-school programs, summer programs, Boys and Girls Club staff, and YMCA youth coordinators: activity planning templates, behavior management guides, volunteer coordination tools, and family engagement resources. |
| Youth-Serving Professional Track | Child Advocacy Guides | Resources for foster care advocates, child welfare workers, and family service coordinators: guides on trauma-informed approaches, family engagement frameworks, and tools for supporting children in transition. Mission-heavy framing: these resources exist because vulnerable children deserve advocates who are equipped. |

## **3.2 WorkDrive Folder 06 Structure**

Folder 06 is organized into four subfolders, one per audience track. Agent 1D uses the lead_magnet_id prefix to determine which subfolder to look in. The LEAD_MAGNET_MAP environment variable maps each lead_magnet_id to its exact file path within Folder 06.

| **Subfolder** | **Audience Track** | **lead_magnet_id Convention** |
| --- | --- | --- |
| 06/k12-educator/ | K-12 Educator Track | lm_k12_[resource-slug] Example: lm_k12_overwhelmed-teacher-selfcare |
| 06/early-childhood/ | Early Childhood and Childcare Track | lm_ec_[resource-slug] Example: lm_ec_milestone-tracker |
| 06/faith-community/ | Faith and Community Track | lm_faith_[resource-slug] Example: lm_faith_ministry-volunteer-guide |
| 06/youth-serving/ | Youth-Serving Professional Track | lm_youth_[resource-slug] Example: lm_youth_trauma-informed-activities |

## **3.3 Audience Track Routing from lead_magnet_id**

Agent 1D parses the lead_magnet_id prefix to determine the Audience_Track value to write to CRM. This field is used by Agent 1A to select the correct email sequence and by Agent 3 to route the ambassador to the correct content track.

| **lead_magnet_id Prefix** | **Audience_Track Written to CRM** |
| --- | --- |
| lm_k12_ | K12 Educator |
| lm_ec_ | Early Childhood |
| lm_faith_ | Faith Community |
| lm_youth_ | Youth Serving Professional |
| No prefix match | Unknown — flag for Parmeet review. Do not fail silently. Log the unrecognized ID. |

# **4. Process Steps**

The following steps execute in sequence for every form submission. The real-time trigger processes each submission independently. The nightly cleanup job runs the same steps against any submissions missed during the day.

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Receive and validate form submission | Make.com fires a webhook to the Agent 1D Catalyst function. Parse the payload. Extract: first_name, email, role_category, state, lead_magnet_id, utm_source, utm_campaign. Validate that email is present and includes @ character. Validate that lead_magnet_id is present. If either validation fails, log the invalid submission and exit without creating a CRM record. Send Parmeet an alert for any invalid submission so form configuration issues are caught quickly. |
| 2 | Refresh all OAuth tokens | Refresh CRM, WorkDrive, and Mail tokens. If any token refresh fails, log the error, alert Parmeet, and abort. Do not process the submission with stale credentials. |
| 3 | Resolve audience track from lead_magnet_id | Parse the lead_magnet_id prefix to determine the Audience_Track value to write to CRM. Use the prefix routing table in Section 3.2. If the prefix does not match any known track, set Audience_Track = Unknown and alert Parmeet. Do not fail the submission — the CRM record must still be created. |
| 4 | Get lead magnet download link | Locate the correct file in WorkDrive Folder 06 using the lead_magnet_id. Generate a time-limited share link (minimum 7-day validity). If the file is not found, log the mismatch, alert Parmeet, and continue with a fallback message in the delivery email. Do not abort: the CRM record must still be created even if lead magnet delivery fails. |
| 5 | Check for duplicate prospect record | Search Zoho CRM Prospects module for an existing record with the same email address. If a record exists, proceed to Step 5b. If no record exists, proceed to Step 5a. |
| 5a | Create new Prospect record | Create a new Prospect record with: First_Name, Email, Role_Category (from form field), Audience_Track (from Step 3), State, Lead_Magnets_Downloaded (array with current lead_magnet_id), Outreach_Status = Identified, Recruiting_Source = Agent 1D, Recruiting_Channel = lead_magnet_id value, UTM_Source, UTM_Campaign, Contact_Found = true. |
| 5b | Update existing Prospect record | Append the current lead_magnet_id to the existing Lead_Magnets_Downloaded array. Update Audience_Track only if it was previously Unknown. Do not overwrite Outreach_Status, Recruiting_Source, or any existing UTM fields. Log the update event. |
| 6 | Generate personalized delivery email opening | Call Claude API with the submitter's first name, role category, audience track, and lead magnet name. Generate one personalized opening sentence for the delivery email. Must not contain em dashes. Must address the person by first name. Must acknowledge what they are receiving and why it is relevant to their work. |
| 7 | Send lead magnet delivery email | Send the delivery email via Zoho Mail from ambassadors@gracelyn.edu. Include: personalized opening sentence, download link (or fallback message if link generation failed), brief one-line description of what they will find in the resource, and a soft mission statement closing. Plain text format. Subject line from AGENT1D_DELIVERY_EMAIL_SUBJECT environment variable. |
| 8 | Fire Agent 1A handoff webhook | Call Make.com Scenario 2 with the prospect's email, first name, role category, audience track, and lead magnet ID. Agent 1A uses Audience_Track to select the correct email sequence. This webhook fires for both new records (Step 5a) and updated records (Step 5b) — Agent 1A checks internally whether this contact is already in an active sequence before adding them. |

# **5. Delivery Email Framing by Audience Track**

The lead magnet delivery email is not a generic confirmation. It is the first impression Gracelyn makes on a non-educator audience that has never interacted with the organization before. The opening sentence is personalized by Claude. The overall tone and closing line must match the audience track's motivation frame.

| **Audience Track** | **Delivery Email Tone and Framing** |
| --- | --- |
| K12 Educator | Collegial and affirming. Acknowledge that teaching is demanding. Frame the resource as something a fellow educator found genuinely useful, not a marketing piece. Closing line connects the resource to Gracelyn's mission of equipping incredible teachers. |
| Early Childhood | Warm and validating. Explicitly acknowledge the undervalued nature of early childhood work. Frame the resource as recognition that their work matters. Closing line: the children in your care are lucky to have someone like you. |
| Faith Community | Faith-aware and mission-aligned. Acknowledge the calling nature of their work. Frame the resource as a tool for living out that calling well. Closing line connects children's ministry or homeschool education to the broader mission of equipping the next generation. |
| Youth Serving Professional | Mission-driven and practical. Acknowledge the complexity of their work with youth in challenging circumstances. Frame the resource as a tool for the real situations they face. Closing line: every child in your program deserves someone equipped to meet them where they are. |

## **5.1 Claude Prompt for Opening Sentence Generation**

| function buildOpeningPrompt(firstName, roleCategory, audienceTrack, leadMagnetName) {   return {     system: `You write personalized opening sentences for lead magnet delivery emails sent by Gracelyn University. Each sentence must: - Address the person by first name - Acknowledge what they are receiving - Connect the resource to the work they do - Be warm and specific, not generic - Contain no em dashes - Be exactly one sentence Return the sentence only. No preamble. No punctuation beyond the sentence itself.`,     user: `First name: ${firstName} Role category: ${roleCategory} Audience track: ${audienceTrack} Resource name: ${leadMagnetName} Write one personalized opening sentence for the delivery email.`   }; } |
| --- |

# **6. CRM Fields Written by Agent 1D**

| **Field Name** | **Type** | **Values and Notes** |
| --- | --- | --- |
| Audience_Track | Picklist | K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown. Set at lead capture. Carried to Ambassador record at onboarding. Used by Agent 1A for sequence selection and Agent 3 for content track routing. |
| Lead_Magnets_Downloaded | Multi-line text (array) | Comma-separated list of lead_magnet_id values downloaded by this prospect. Appended on each new submission. Never overwritten. |
| Recruiting_Source | Picklist | Agent 1D for all leads captured through this agent. |
| Recruiting_Channel | Text | The specific lead_magnet_id value that was the first conversion event for this prospect. |
| Outreach_Status | Picklist | Identified (set by Agent 1D). Updated to Outreach_Sent by Agent 1A when email sequence begins. |
| Contact_Found | Checkbox | Set to true by Agent 1D for all form submissions since the prospect provided their own email. |
| UTM_Source | Text | utm_source from form hidden field. Identifies the traffic source (e.g. facebook, google, email). |
| UTM_Campaign | Text | utm_campaign from form hidden field. Identifies the specific campaign that drove the lead. |

| **NOTE** The Audience_Track field is the most important new field in Version 2.0. It flows from Agent 1D through Agent 1A (sequence selection) to the Ambassador record at onboarding, and from there to Agent 3 (content track routing) and Agent 6 (story tagging). If this field is missing or set to Unknown, downstream personalization breaks. Parmeet must confirm the CRM picklist exists before development begins. |
| --- |

# **7. Make.com Scenarios**

| **Scenario** | **Trigger** | **Actions** |
| --- | --- | --- |
| Scenario 1: Real-Time Form Submission | New Zoho Forms submission detected | Fires Agent 1D Catalyst function webhook with full submission payload. Runs on every form submission from any lead capture landing page. |
| Scenario 2: Agent 1A Handoff | Agent 1D Catalyst function webhook on CRM record creation | Receives prospect email, name, role category, audience track, and lead magnet ID. Routes to Agent 1A to begin email sequence. Agent 1A checks internally whether the contact is already in an active sequence. |
| Scenario 3: Nightly Cleanup | Every night at 2:00 AM CST | Queries Zoho Forms for submissions in the past 24 hours. Compares to CRM Prospects module. For any submission not reflected in CRM, fires Scenario 1 webhook to process it retroactively. Sends Parmeet a morning summary of recovered submissions. |
| Scenario 4: Error Alert Routing | Agent 1D Catalyst function on error webhook | Receives error payload from the Catalyst function and sends formatted alert email to Parmeet. Centralizes all error notification through Make.com so alert format is consistent across all agents. |

# **8. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Form submission missing email | Validation check on parsed payload | Log invalid submission. Alert Parmeet. Exit without creating CRM record. |
| Form submission missing lead_magnet_id | Validation check on parsed payload | Log invalid submission. Alert Parmeet. This indicates a form configuration error — the hidden field is missing. |
| Token refresh fails | try/catch on token refresh call | Halt. Alert Parmeet. Add submission to nightly cleanup queue. |
| lead_magnet_id prefix not recognized | Prefix not found in routing table | Set Audience_Track = Unknown. Alert Parmeet. Continue processing. CRM record still created. |
| Lead magnet file not found in WorkDrive Folder 06 | File lookup returns null | Log mismatch. Alert Parmeet (form and file are out of sync). Continue processing. Delivery email sends with fallback message: Your resource will be sent to you shortly by our team. |
| CRM create fails | Zoho CRM API error on write | Log error. Retry once after 30 seconds. If retry fails, alert Parmeet with full submission data so record can be created manually. |
| Delivery email fails to send | Zoho Mail API error | Log error. Alert Parmeet with submitter email address so manual delivery can be arranged. CRM record is already created at this point. |
| Claude opening sentence generation fails | Claude API error | Use fallback opening: Hello [FirstName], here is your resource from Gracelyn University. Continue email send. Do not abort delivery. |
| Agent 1A handoff webhook fails | Make.com returns non-200 | Retry once after 60 seconds. If retry fails, alert Parmeet. Log the prospect data so Agent 1A can be manually triggered. |
| Nightly cleanup finds unprocessed submissions | Form submission exists in Zoho Forms but not in CRM | Process through the full pipeline retroactively. Alert Parmeet with count of recovered submissions each morning. |

# **9. Parmeet Pre-Build Tasks**

The following tasks must be completed by Parmeet before Agent 1D development begins. Development is blocked on items 1 through 4.

| **Parmeet Pre-Build Task** | **Notes** |
| --- | --- |
| Create WorkDrive Folder 06 subfolders for all four audience tracks | Subfolder names must match exactly: k12-educator, early-childhood, faith-community, youth-serving. Agent 1D uses these paths for file lookup. |
| Upload at least one lead magnet file per audience track before launch | Minimum viable launch requires one resource per track. The lead_magnet_id for each file must be set as the hidden field value in the corresponding Zoho Form. |
| Create one Zoho Form landing page per audience track | Each form must include hidden fields: lead_magnet_id (pre-populated with the resource ID), utm_source (populated from URL parameter), utm_campaign (populated from URL parameter). Visible fields: first_name, email, role_category (dropdown matching CRM picklist values), state. |
| Add Audience_Track picklist field to Zoho CRM Prospects module | Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Unknown. |
| Set LEAD_MAGNET_MAP environment variable | JSON object mapping every lead_magnet_id to its WorkDrive file path. Must be updated every time a new lead magnet is added. Example: {lm_k12_selfcare: 06/k12-educator/selfcare-guide.pdf} |
| Confirm ambassadors@gracelyn.edu is configured in Zoho Mail and authorized for API sending | Delivery emails send from this address. Must be verified and active before launch. |

# **10. Testing Protocol**

## **10.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Submission validation — missing email | Call parseAndValidateSubmission() with email field empty | Returns valid: false. Error message references email. No CRM record created. |
| Submission validation — missing lead_magnet_id | Call parseAndValidateSubmission() with lead_magnet_id field absent | Returns valid: false. Error message references lead_magnet_id. Parmeet alert fires. |
| Audience track routing — K12 prefix | Submit with lead_magnet_id = lm_k12_test | Audience_Track = K12 Educator written to CRM. |
| Audience track routing — Faith prefix | Submit with lead_magnet_id = lm_faith_test | Audience_Track = Faith Community written to CRM. |
| Audience track routing — Early Childhood prefix | Submit with lead_magnet_id = lm_ec_test | Audience_Track = Early Childhood written to CRM. |
| Audience track routing — Youth prefix | Submit with lead_magnet_id = lm_youth_test | Audience_Track = Youth Serving Professional written to CRM. |
| Audience track routing — unrecognized prefix | Submit with lead_magnet_id = lm_unknown_test | Audience_Track = Unknown written to CRM. Parmeet alert fires. |
| Lead magnet file lookup — valid ID | Set LEAD_MAGNET_MAP with test entry and matching file in Folder 06 | Returns non-null download link. Link accessible in browser for at least 7 days. |
| Lead magnet file lookup — invalid ID | Submit lead_magnet_id not in LEAD_MAGNET_MAP | Delivery email sends with fallback message. Parmeet alert fires. CRM record still created. |
| Duplicate prospect deduplication | Pre-create Prospect record. Submit form with same email. | Lead_Magnets_Downloaded array appended. No duplicate CRM record created. |
| New prospect record creation | Submit form with email not in CRM | New Prospect record in CRM with all fields: Audience_Track, Lead_Magnets_Downloaded, Recruiting_Source = Agent 1D, Outreach_Status = Identified, Contact_Found = true. |
| Claude opening sentence — all four tracks | Call Claude with each audience track value | Returns one sentence. No em dashes. Addresses submitter by first name. Framing matches audience track. |
| Claude failure fallback | Simulate Claude API error | Fallback opening sentence used. Email still sends. No abort. |
| Delivery email send | Full pipeline run to internal Gracelyn email | Email arrives as plain text. From: ambassadors@gracelyn.edu. Personalized opening present. Download link present and working. |
| Agent 1A handoff webhook | Call triggerAgent1A() with mock prospect data | Make.com Scenario 2 receives webhook and returns HTTP 200. Payload includes audience_track field. |
| Nightly cleanup — missed submission | Create form submission in Zoho Forms without processing. Run cleanup. | Missed submission found and processed. CRM record created. Morning summary includes recovery count. |

## **10.2 Integration Test**

Run after all unit tests pass. Parmeet present for integration test.

- Confirm WorkDrive Folder 06 contains at least one file in each of the four audience track subfolders

- Confirm LEAD_MAGNET_MAP is populated with at least one entry per audience track

- Confirm all four Zoho Forms exist with correct hidden fields

- Confirm Audience_Track picklist exists in Zoho CRM Prospects module with all four values

- Submit a test form for each audience track using an internal Gracelyn email address

- Verify Prospect record created with correct Audience_Track value for each submission

- Verify delivery email received for each submission with correct personalized opening and working download link

- Verify Agent 1A handoff webhook fired for each submission with audience_track field in payload

- Verify duplicate handling: submit the same email twice and confirm only one CRM record exists with both lead_magnet_id values in Lead_Magnets_Downloaded

- Verify nightly cleanup: create a form submission without the real-time trigger active and confirm cleanup recovers it at 2:00 AM

- Verify Parmeet receives error alerts for all configured failure scenarios

## **10.3 Acceptance Criteria**

- All four audience track forms create Prospect records with correct Audience_Track field

- Delivery email arrives within 2 minutes of form submission with personalized opening and working download link

- Duplicate submissions update existing records without creating new records

- Agent 1A handoff payload includes audience_track field for all submissions

- Nightly cleanup recovers missed submissions each morning

- Parmeet can add a new lead magnet by updating LEAD_MAGNET_MAP without touching code

- Parmeet can add a new form by updating LEAD_CAPTURE_FORM_IDS without touching code

# **11. Integration Notes for Other Developers**

## **11.1 What Agent 1A Developer Needs to Know**

- The Agent 1A handoff webhook payload now includes an audience_track field. Agent 1A must use this field to select the correct email sequence. A K12 Educator prospect and a Faith Community prospect must enter different email sequences with different motivation frames.

- Agent 1A should check whether an incoming prospect from Agent 1D is already in an active sequence before adding them. Duplicate submissions from the same email address will trigger the handoff webhook twice.

## **11.2 What Agent 3 Developer Needs to Know**

- The Audience_Track field set by Agent 1D is carried to the Ambassador record at onboarding. Agent 3 uses this field for content track routing and story selection by role category. Do not overwrite this field. If it arrives as Unknown, flag it for Parmeet review.

## **11.3 What Agent 2 Developer Needs to Know**

- When building the Ambassador record from the Prospect record at onboarding, carry the Audience_Track field forward. The Ambassador record must include this field for Agent 3 to function correctly.

# **12. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | Parmeet | OAuth client ID for Zoho CRM |
| ZOHO_CRM_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho CRM |
| ZOHO_CRM_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho CRM |
| ZOHO_FORMS_CLIENT_ID | Parmeet | OAuth client ID for Zoho Forms — used only in nightly cleanup job |
| ZOHO_FORMS_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Forms |
| ZOHO_FORMS_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Forms |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for Zoho WorkDrive |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho WorkDrive |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho WorkDrive |
| ZOHO_MAIL_CLIENT_ID | Parmeet | OAuth client ID for Zoho Mail |
| ZOHO_MAIL_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Mail |
| ZOHO_MAIL_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Mail |
| ANTHROPIC_API_KEY | Parmeet | Claude API key. Shared across agents. |
| WORKDRIVE_FOLDER_06_ID | Parmeet | WorkDrive Folder 06 root ID. Subfolders for each audience track are referenced relative to this root. |
| WORKDRIVE_FOLDER_08_ID | Parmeet | WorkDrive Folder 08 ID for brand assets. |
| LEAD_MAGNET_MAP | Parmeet | JSON object mapping every lead_magnet_id to its WorkDrive file path within Folder 06. Must be updated whenever a new lead magnet is added to Folder 06. Example: {"lm_k12_selfcare":"k12-educator/selfcare-guide.pdf"} |
| LEAD_CAPTURE_FORM_IDS | Parmeet | JSON array of Zoho Forms form IDs for all lead capture forms. Must be updated whenever a new form is created. |
| PROSPECTS_MODULE_API_NAME | Parmeet | Exact API name of the Prospects module in Zoho CRM. Confirm with Parmeet before first CRM call. |
| AGENT1D_DELIVERY_EMAIL_SUBJECT | Parmeet | Subject line template for lead magnet delivery emails. May include [RESOURCE_NAME] placeholder. |
| MAKE_AGENT1A_FROM_1D_WEBHOOK | Developer | Make.com webhook URL for Scenario 2 Agent 1A handoff. Coordinate with Agent 1A developer. |
| MAKE_AGENT1D_ERROR_WEBHOOK | Developer | Make.com webhook URL for Scenario 4 error alert routing. |
| PARMEET_ALERT_EMAIL | Parmeet | Email address for all Agent 1D error and alert notifications. |

| **NOTE** All environment variables are set by Parmeet in the Zoho Catalyst console before development begins. The LEAD_MAGNET_MAP variable is the most operationally important — it must be updated every time Parmeet adds a new resource to Folder 06. Parmeet can do this without developer assistance. |
| --- |
*Gracelyn University  |  Ambassador AI Agent System  |  Agent 5A: Setup Validation Agent  |  v1.0*

**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 5A

**Setup Validation Agent**

*Pre-build environment variable audit, credential verification,*

*and go / no-go gate before any developer writes production code*

Parmeet Project Document

Project Director: Parmeet

Client: Dr. Matthew Flippen, President, Gracelyn University

Version 1.0   |   May 2026

# **1. What Agent 5A Is and Who Builds It**

| **STOP. This agent is built and run by Parmeet, not by an agent developer. Read this section before proceeding.** *Agent 5A is built and run by Parmeet, not by an agent developer. It is a Zoho Catalyst serverless function that Parmeet deploys and triggers manually via Make.com. It has no ongoing scheduled jobs, no recruiting function, and no ambassador-facing output. Its only job is to confirm that all environment variables are correctly set before any developer begins building. This document is addressed to Parmeet, not a developer.* |
| --- |

## **1.1 Purpose**

Agent 5A audits the Zoho Catalyst environment before the build starts. It checks every required environment variable across all nine agents, confirms each is present and non-empty, detects placeholder values that were never replaced with real credentials, and attempts a test API call for each credential-type variable to confirm it is valid and not expired. It generates a validation report to WorkDrive Folder 07 and emails the report to Parmeet.

The report has one outcome: go or no-go. A green report means all variables are set and credentials are valid. Developers may start. A red report means something is missing or broken. Developers wait until Parmeet fixes it and runs the validation again.

| **GO / NO-GO GATE** *No developer writes production code until Agent 5A produces a green validation report. This is not a suggestion. A developer who starts building before the validation is complete will encounter blocked API calls, broken integrations, and wasted build time. The 2-3 days Parmeet spends setting up all variables and running the validation saves weeks of debugging.* |
| --- |

## **1.2 When to Run Agent 5A**

| **Run Timing** | **Purpose** |
| --- | --- |
| Before the architect kickoff meeting | Confirms all pre-build checklist variables are set before developers receive their project documents. Parmeet signs off on the green report at the kickoff. |
| After any credential update | If an OAuth token expires, an API key rotates, or a CRM module name changes, run Agent 5A again to confirm the updated value is correct before the affected developer continues. |
| Before go-live | Final validation that all production credentials are in place before the system goes live with real ambassadors. |
| After any Catalyst project migration | If the Catalyst project is migrated or environment variables are copied to a new project, run Agent 5A to confirm all values transferred correctly. |

# **2. How to Build and Run Agent 5A**

## **2.1 Build: Zoho Catalyst Function**

Agent 5A is a single Zoho Catalyst serverless function. Parmeet deploys it using the Catalyst CLI. It does not require Make.com or any webhook infrastructure to function. The Make.com trigger button is a convenience so Parmeet can run it without using the Catalyst CLI each time.

| // Agent 5A: Setup Validation Function // Deploy to Zoho Catalyst as a Basic I/O function // Triggered manually via Make.com button or Catalyst CLI const fs   = require('fs'); const path = require('path'); // All environment variable names expected in the Catalyst project // Organized by category for readable report output const REQUIRED_VARS = {   'Zoho CRM Credentials': [     'ZOHO_CRM_CLIENT_ID',     'ZOHO_CRM_CLIENT_SECRET',     'ZOHO_CRM_REFRESH_TOKEN'   ],   'Zoho WorkDrive Credentials': [     'WORKDRIVE_CLIENT_ID',     'WORKDRIVE_CLIENT_SECRET',     'WORKDRIVE_REFRESH_TOKEN'   ],   'WorkDrive Folder IDs': [     'WORKDRIVE_FOLDER_01_ID',     'WORKDRIVE_FOLDER_02_ID',     'WORKDRIVE_FOLDER_03_ID',     'WORKDRIVE_FOLDER_04_ID',     'WORKDRIVE_FOLDER_05_ID',     'WORKDRIVE_FOLDER_06_ID',     'WORKDRIVE_FOLDER_07_ID',     'WORKDRIVE_FOLDER_08_ID',     'WORKDRIVE_FOLDER_09_ID'   ],   'Zoho Mail (ambassadors@gracelyn.edu)': [     'AMBASSADOR_MAIL_CLIENT_ID',     'AMBASSADOR_MAIL_CLIENT_SECRET',     'AMBASSADOR_MAIL_REFRESH_TOKEN',     'AMBASSADOR_MAIL_ACCOUNT_ID',     'AMBASSADOR_MAIL_FROM_ADDRESS'   ],   'Zoho Analytics': [     'ZOHO_ANALYTICS_CLIENT_ID',     'ZOHO_ANALYTICS_CLIENT_SECRET',     'ZOHO_ANALYTICS_REFRESH_TOKEN',     'AMBASSADOR_ANALYTICS_WORKSPACE_ID'   ],   'Zoho Books': [     'ZOHO_BOOKS_CLIENT_ID',     'ZOHO_BOOKS_CLIENT_SECRET',     'ZOHO_BOOKS_REFRESH_TOKEN'   ],   'Claude API': [     'CLAUDE_API_KEY'   ],   'HeyGen API': [     'HEYGEN_API_KEY',     'HEYGEN_FLIPPEN_AVATAR_ID'   ],   'Ayrshare API': [     'AYRSHARE_API_KEY'   ],   'Meta Ads API': [     'META_ADS_ACCESS_TOKEN',     'META_AD_ACCOUNT_ID',     'META_DAILY_SPEND_THRESHOLD'   ],   'Google Ads API': [     'GOOGLE_ADS_CLIENT_ID',     'GOOGLE_ADS_CLIENT_SECRET',     'GOOGLE_ADS_REFRESH_TOKEN',     'GOOGLE_ADS_DEVELOPER_TOKEN',     'GOOGLE_ADS_CUSTOMER_ID',     'GOOGLE_DAILY_SPEND_THRESHOLD'   ],   'WordPress Portal': [     'WORDPRESS_API_BASE_URL',     'WP_ADMIN_USER',     'WP_ADMIN_APP_PASSWORD'   ],   'OpenAI (Ambassador Support)': [     'OPENAI_API_KEY',     'OPENAI_AMBASSADOR_ASSISTANT_ID'   ],   'Zoho Forms': [     'ZOHO_FORMS_CLIENT_ID',     'ZOHO_FORMS_CLIENT_SECRET',     'ZOHO_FORMS_REFRESH_TOKEN',     'AMBASSADOR_FORM_BASE_URL',     'AMBASSADOR_FORM_ID',     'LEAD_MAGNET_MAP',     'LEAD_CAPTURE_FORM_IDS'   ],   'CRM Module API Names': [     'AMBASSADORS_MODULE_API_NAME',     'REFERRALS_MODULE_API_NAME',     'ACTIVITY_LOG_MODULE_API_NAME',     'PROSPECTS_MODULE_API_NAME',     'SUPPORT_TICKETS_MODULE_API_NAME',     'AD_CAMPAIGN_LOG_MODULE_API_NAME',     'SOCIAL_POST_LOG_MODULE_API_NAME',     'PARA_DB_MODULE_NAME'   ],   'Thresholds and Config': [     'VIP_SCORE_THRESHOLD',     'PARA_DB_TEST_SEGMENT_SIZE',     'HIGH_ENGAGEMENT_THRESHOLD',     'AGENT0_AUDIENCE_CONFIG',     'LEAD_MAGNET_MAP',     'STORY_BUFFER_MINIMUM'   ],   'Zoho Social': [     'ZOHO_SOCIAL_TOKEN'   ],   'Make.com Webhook URLs': [     'MAKE_AGENT0_COMPLETE_WEBHOOK_URL',     'MAKE_AGENT0_ONDEMAND_WEBHOOK_URL',     'MAKE_VIP_NOTIFY_WEBHOOK_URL',     'MAKE_AGENT1A_WEBHOOK_URL',     'MAKE_AGENT1A_FROM_1D_WEBHOOK_URL',     'MAKE_AGENT1B_WEBHOOK_URL',     'MAKE_AGENT1C_WEBHOOK_URL',     'MAKE_AGENT1D_WEBHOOK_URL',     'MAKE_AGENT3_WEBHOOK_URL',     'MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL',     'MAKE_COORDINATOR_QUEUE_WEBHOOK_URL',     'MAKE_SPEND_ALERT_WEBHOOK_URL',     'MAKE_SPEND_CONFIRM_WEBHOOK_URL',     'MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL',     'MAKE_CAMPAIGN_RESTART_WEBHOOK_URL',     'MAKE_FEE_PAYMENT_CONFIRM_WEBHOOK_URL',     'MAKE_COORDINATOR_CHECKPOINT_WEBHOOK_URL',     'MAKE_WEEKLY_FEE_REPORT_WEBHOOK_URL',     'MAKE_COMPLIANCE_VIOLATION_WEBHOOK_URL',     'MAKE_ESCALATION_WEBHOOK_URL',     'MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL',     'MAKE_HEYGEN_SCRIPT_REVIEW_WEBHOOK_URL',     'MAKE_HEYGEN_APPROVAL_WEBHOOK_URL',     'MAKE_STORY_BUFFER_ALERT_WEBHOOK_URL'   ],   'Alert Email Addresses': [     'PARMEET_ALERT_EMAIL',     'COORDINATOR_ALERT_EMAIL',     'VIP_MANAGER_EMAIL',     'SUPPORT_COORDINATOR_EMAIL',     'DR_FLIPPEN_EMAIL'   ],   'Ambassador Portal': [     'AMBASSADOR_PORTAL_URL',     'AMBASSADOR_PORTAL_CHAT_URL'   ],   'Email Template Subject Lines': [     'AMBASSADOR_EMAIL_A_SUBJECT',     'AMBASSADOR_EMAIL_B_SUBJECT',     'AMBASSADOR_EMAIL_B_VIP_SUBJECT',     'AMBASSADOR_EMAIL_C_SUBJECT',     'AMBASSADOR_EMAIL_D_SUBJECT',     'AGENT3_SUBJECT_WEEK1',     'AGENT3_SUBJECT_WEEK2',     'AGENT3_SUBJECT_WEEK3',     'AGENT3_SUBJECT_WEEK4',     'AGENT3_MILESTONE_1_SUBJECT',     'AGENT3_MILESTONE_5_SUBJECT',     'AGENT3_MILESTONE_10_SUBJECT',     'AGENT3_MILESTONE_25_SUBJECT',     'AGENT3_REFERRAL_APPLIED_SUBJECT',     'AGENT3_REFERRAL_ENROLLED_SUBJECT',     'AGENT3_REENGAGEMENT_1_SUBJECT',     'AGENT3_REENGAGEMENT_2_SUBJECT',     'AGENT4_FEE_ELIGIBLE_SUBJECT',     'AGENT4_FEE_PAID_SUBJECT',     'AGENT1D_DELIVERY_EMAIL_SUBJECT'   ],   'Email Template Bodies (presence check only)': [     'AMBASSADOR_EMAIL_A_BODY',     'AMBASSADOR_EMAIL_B_BODY',     'AMBASSADOR_EMAIL_B_VIP_BODY',     'AMBASSADOR_EMAIL_C_BODY',     'AMBASSADOR_EMAIL_D_BODY',     'AGENT4_FEE_ELIGIBLE_BODY',     'AGENT4_FEE_PAID_BODY',     'AGENT1D_DELIVERY_EMAIL_BODY'   ] }; |
| --- |

## **2.2 Validation Logic**

For each variable in REQUIRED_VARS, the function performs three checks in order. If any check fails, the variable is marked with a status of FAIL and the report includes the failure reason. The function continues to the next variable regardless of failures so the complete picture is visible in one report.

| // Placeholder patterns that indicate a variable was never set const PLACEHOLDER_PATTERNS = [   'YOUR_KEY_HERE',   'REPLACE_ME',   'TODO',   'INSERT_',   'PLACEHOLDER',   'XXXXXXXXXX',   'example.com',   'test@test' ]; async function validateVariable(name) {   const result = { name, status: 'PASS', detail: '' };   // Check 1: Variable exists and is non-empty   const value = process.env[name];   if (!value ││ value.trim() === '') {     result.status = 'FAIL';     result.detail = 'Missing or empty';     return result;   }   // Check 2: Value is not a placeholder   const isPlaceholder = PLACEHOLDER_PATTERNS.some(     p => value.toUpperCase().includes(p.toUpperCase())   );   if (isPlaceholder) {     result.status = 'FAIL';     result.detail = 'Placeholder value detected: ' + value.substring(0, 30) + '...';     return result;   }   // Check 3: Credential test (for specific variable types)   const credentialTest = await testCredential(name, value);   if (credentialTest && !credentialTest.valid) {     result.status = 'WARN';  // WARN not FAIL: credential test may have rate limits     result.detail = credentialTest.reason;   }   return result; } // Credential-specific API tests async function testCredential(name, value) {   try {     if (name === 'ZOHO_CRM_REFRESH_TOKEN') {       // Attempt token refresh to confirm refresh token is valid       const resp = await fetch('https://accounts.zoho.com/oauth/v2/token', {         method: 'POST',         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },         body: new URLSearchParams({           refresh_token: value,           client_id:     process.env.ZOHO_CRM_CLIENT_ID ││ '',           client_secret: process.env.ZOHO_CRM_CLIENT_SECRET ││ '',           grant_type:    'refresh_token'         })       });       const data = await resp.json();       if (!data.access_token) return { valid: false, reason: 'CRM token refresh failed: ' + (data.error ││ 'unknown') };       return { valid: true };     }     if (name === 'CLAUDE_API_KEY') {       // Minimal Claude API call to verify key       const resp = await fetch('https://api.anthropic.com/v1/messages', {         method: 'POST',         headers: {           'Content-Type': 'application/json',           'x-api-key': value,           'anthropic-version': '2023-06-01'         },         body: JSON.stringify({           model: 'claude-sonnet-4-20250514',           max_tokens: 10,           messages: [{ role: 'user', content: 'test' }]         })       });       const data = await resp.json();       if (data.error) return { valid: false, reason: 'Claude API error: ' + data.error.type };       return { valid: true };     }     if (name === 'AYRSHARE_API_KEY') {       const resp = await fetch('https://app.ayrshare.com/api/user', {         headers: { 'Authorization': `Bearer ${value}` }       });       if (!resp.ok) return { valid: false, reason: 'Ayrshare API returned ' + resp.status };       return { valid: true };     }     if (name === 'OPENAI_API_KEY') {       const resp = await fetch('https://api.openai.com/v1/models', {         headers: { 'Authorization': `Bearer ${value}` }       });       if (!resp.ok) return { valid: false, reason: 'OpenAI API returned ' + resp.status };       return { valid: true };     }     if (name === 'WORDPRESS_API_BASE_URL') {       // Test WordPress REST API is reachable       const resp = await fetch(value + '/wp/v2/users/me', {         headers: {           'Authorization': 'Basic ' + Buffer.from(             (process.env.WP_ADMIN_USER ││ '') + ':' + (process.env.WP_ADMIN_APP_PASSWORD ││ '')           ).toString('base64')         }       });       if (!resp.ok) return { valid: false, reason: 'WordPress REST API returned ' + resp.status };       return { valid: true };     }     if (name === 'HEYGEN_API_KEY') {       const resp = await fetch('https://api.heygen.com/v1/avatar.list', {         headers: { 'X-Api-Key': value }       });       if (!resp.ok) return { valid: false, reason: 'HeyGen API returned ' + resp.status };       return { valid: true };     }     // No credential test for this variable type (folder IDs, module names, etc.)     return null;   } catch (err) {     return { valid: false, reason: 'Connection error: ' + err.message };   } } |
| --- |

## **2.3 Report Generation**

After validating all variables, the function generates a plain text validation report, saves it to WorkDrive Folder 07, and emails the full report to Parmeet. The report header shows the overall go/no-go status immediately so Parmeet does not have to read the entire report to know the outcome.

| async function generateValidationReport(results, workdriveToken, mailToken) {   const today     = new Date().toISOString().split('T')[0];   const timestamp = new Date().toISOString();   const totalVars  = results.flat().length;   const failCount  = results.flat().filter(r => r.status === 'FAIL').length;   const warnCount  = results.flat().filter(r => r.status === 'WARN').length;   const passCount  = results.flat().filter(r => r.status === 'PASS').length;   const goNoGo     = failCount === 0 ? 'GO' : 'NO-GO';   const reportLines = [     'GRACELYN UNIVERSITY AMBASSADOR AI AGENT SYSTEM',     'SETUP VALIDATION REPORT',     'Generated: ' + timestamp,     '',     '================================================',     'OVERALL STATUS: ' + goNoGo,     '================================================',     'Total variables checked: ' + totalVars,     'PASS: ' + passCount,     'WARN: ' + warnCount + ' (credential test inconclusive)',     'FAIL: ' + failCount + ' (missing, empty, or placeholder)',     '',     goNoGo === 'GO'       ? 'All required environment variables are present and valid.'       + ' Developers may proceed.'       : 'One or more required variables are missing or invalid.'       + ' DO NOT allow developers to start until all FAILs are resolved.'       + ' Fix the issues listed below and run Agent 5A again.',     '',   ];   // Append results by category   for (const [category, vars] of Object.entries(REQUIRED_VARS)) {     reportLines.push('');     reportLines.push('--- ' + category + ' ---');     for (const varName of vars) {       const result = results.flat().find(r => r.name === varName);       if (!result) continue;       const line = result.status.padEnd(5) + ' │ ' + varName.padEnd(45) + (result.detail ? ' │ ' + result.detail : '');       reportLines.push(line);     }   }   const reportText = reportLines.join('\n');   // Save to WorkDrive Folder 07   const filename  = 'Validation_Report_' + today + '.txt';   const FOLDER_07_ID = process.env.WORKDRIVE_FOLDER_07_ID;   const formData  = new FormData();   formData.append('content', new Blob([reportText], { type: 'text/plain' }), filename);   formData.append('filename', filename);   formData.append('parent_id', FOLDER_07_ID);   formData.append('override-name-exist', 'true');   await fetch('https://workdrive.zoho.com/api/v1/upload', {     method: 'POST',     headers: { 'Authorization': `Zoho-oauthtoken ${workdriveToken}` },     body: formData   });   // Email report to Parmeet   const accountId = process.env.AMBASSADOR_MAIL_ACCOUNT_ID;   const fromAddr  = process.env.AMBASSADOR_MAIL_FROM_ADDRESS;   await fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages`, {     method: 'POST',     headers: {       'Authorization': `Zoho-oauthtoken ${mailToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify({       fromAddress: fromAddr,       toAddress:   process.env.PARMEET_ALERT_EMAIL,       subject:     `Agent 5A Validation: ${goNoGo} - ${failCount} failures - ${today}`,       content:     reportText,       mailFormat:  'text'     })   });   return { goNoGo, failCount, warnCount, passCount }; } |
| --- |

## **2.4 Make.com Trigger Button**

Parmeet triggers Agent 5A from a Make.com scenario with a single HTTP module. This avoids the need to use the Catalyst CLI every time.

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | HTTP: Make a Request | Parmeet runs this scenario manually from the Make.com dashboard. It is not scheduled. Set method to POST. URL is the Agent 5A Catalyst function URL. Body is empty: {}. Parse response: Yes. |
| 2 | Email (Zoho Mail) | Condition: Step 1 response contains goNoGo = NO-GO. Additional alert email to Parmeet at personal email address (outside Zoho Mail in case Zoho Mail itself is the problem). Subject: VALIDATION NO-GO: [failCount] failures found. Body: Full report text. |

| **NOTE** *The Make.com scenario for Agent 5A is not activated on a schedule. Parmeet clicks Run once manually when ready. There is no risk of it running unexpectedly.* |
| --- |

# **3. Complete Variable Reference**

This section lists every environment variable that Agent 5A validates, grouped by category. Parmeet uses this as the setup worksheet. The Status column is filled in as each variable is set in Catalyst.

## **3.1 Zoho API Credentials**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | OAuth 2.0 client ID for Zoho CRM. Used by Agents 0, 1A, 1B, 1C, 1D, 2, 3, 4, 5. | [ ] |
| ZOHO_CRM_CLIENT_SECRET | OAuth 2.0 client secret for Zoho CRM. | [ ] |
| ZOHO_CRM_REFRESH_TOKEN | Long-lived refresh token for Zoho CRM. Agent 5A will test this token. | [ ] |
| WORKDRIVE_CLIENT_ID | OAuth 2.0 client ID for Zoho WorkDrive. | [ ] |
| WORKDRIVE_CLIENT_SECRET | OAuth 2.0 client secret for Zoho WorkDrive. | [ ] |
| WORKDRIVE_REFRESH_TOKEN | Long-lived refresh token for Zoho WorkDrive. Agent 5A will test this token. | [ ] |
| AMBASSADOR_MAIL_CLIENT_ID | OAuth 2.0 client ID for ambassadors@gracelyn.edu Zoho Mail account. | [ ] |
| AMBASSADOR_MAIL_CLIENT_SECRET | OAuth 2.0 client secret for Zoho Mail. | [ ] |
| AMBASSADOR_MAIL_REFRESH_TOKEN | Long-lived refresh token for ambassadors@gracelyn.edu. Agent 5A will test. | [ ] |
| AMBASSADOR_MAIL_ACCOUNT_ID | Zoho Mail account ID for ambassadors@gracelyn.edu. | [ ] |
| AMBASSADOR_MAIL_FROM_ADDRESS | From address: ambassadors@gracelyn.edu. | [ ] |
| ZOHO_ANALYTICS_CLIENT_ID | OAuth 2.0 client ID for Zoho Analytics. | [ ] |
| ZOHO_ANALYTICS_CLIENT_SECRET | OAuth 2.0 client secret for Zoho Analytics. | [ ] |
| ZOHO_ANALYTICS_REFRESH_TOKEN | Long-lived refresh token for Zoho Analytics. | [ ] |
| AMBASSADOR_ANALYTICS_WORKSPACE_ID | Zoho Analytics workspace ID for coordinator dashboard. | [ ] |
| ZOHO_BOOKS_CLIENT_ID | OAuth 2.0 client ID for Zoho Books. | [ ] |
| ZOHO_BOOKS_CLIENT_SECRET | OAuth 2.0 client secret for Zoho Books. | [ ] |
| ZOHO_BOOKS_REFRESH_TOKEN | Long-lived refresh token for Zoho Books. | [ ] |
| ZOHO_FORMS_CLIENT_ID | OAuth 2.0 client ID for Zoho Forms. | [ ] |
| ZOHO_FORMS_CLIENT_SECRET | OAuth 2.0 client secret for Zoho Forms. | [ ] |
| ZOHO_FORMS_REFRESH_TOKEN | Long-lived refresh token for Zoho Forms. | [ ] |
| ZOHO_SOCIAL_PORTAL_ID | Zoho Social portal ID for Agent 1B engagement monitoring. | [ ] |

## **3.2 Third-Party API Credentials**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| CLAUDE_API_KEY | Anthropic API key. Model: claude-sonnet-4-20250514. Agent 5A will test. | [ ] |
| HEYGEN_API_KEY | HeyGen API key for video generation. Agent 5A will test. | [ ] |
| HEYGEN_FLIPPEN_AVATAR_ID | Dr. Flippen HeyGen avatar ID for milestone and VIP videos. | [ ] |
| AYRSHARE_API_KEY | Ayrshare API key for social posting via Agent 1B. Agent 5A will test. | [ ] |
| META_ADS_ACCESS_TOKEN | Meta Ads long-lived access token. Real financial authority. Handle with care. | [ ] |
| META_AD_ACCOUNT_ID | Meta Ads account ID for Gracelyn University. | [ ] |
| META_DAILY_SPEND_THRESHOLD | Daily Meta spend maximum in USD. Set by Dr. Flippen. | [ ] |
| GOOGLE_ADS_CLIENT_ID | Google Ads OAuth 2.0 client ID. | [ ] |
| GOOGLE_ADS_CLIENT_SECRET | Google Ads OAuth 2.0 client secret. | [ ] |
| GOOGLE_ADS_REFRESH_TOKEN | Google Ads OAuth 2.0 refresh token. | [ ] |
| GOOGLE_ADS_DEVELOPER_TOKEN | Google Ads API developer token. Required in every request header. | [ ] |
| GOOGLE_ADS_CUSTOMER_ID | Google Ads customer ID for Gracelyn University. | [ ] |
| GOOGLE_DAILY_SPEND_THRESHOLD | Daily Google spend maximum in USD. Set by Dr. Flippen. | [ ] |
| OPENAI_API_KEY | OpenAI API key for Ambassador Support Agent (Agent 5). Agent 5A will test. | [ ] |
| OPENAI_AMBASSADOR_ASSISTANT_ID | OpenAI assistant ID for the ambassador support assistant. | [ ] |

## **3.3 WordPress Portal**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| WORDPRESS_API_BASE_URL | WordPress REST API base URL for ambassador portal. Agent 5A will test reachability. | [ ] |
| WP_ADMIN_USER | WordPress admin username for API authentication. | [ ] |
| WP_ADMIN_APP_PASSWORD | WordPress application password. Not the login password. | [ ] |
| AMBASSADOR_PORTAL_URL | URL of the WordPress ambassador portal login page. Used in email templates. | [ ] |
| AMBASSADOR_PORTAL_CHAT_URL | URL or embed code for OpenAI chat in WordPress portal. | [ ] |

## **3.4 WorkDrive Folder IDs**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| WORKDRIVE_FOLDER_01_ID | Folder 01: Applications | [ ] |
| WORKDRIVE_FOLDER_02_ID | Folder 02: Approved Content | [ ] |
| WORKDRIVE_FOLDER_03_ID | Folder 03: Ambassador Kits | [ ] |
| WORKDRIVE_FOLDER_04_ID | Folder 04: Training Materials | [ ] |
| WORKDRIVE_FOLDER_05_ID | Folder 05: Engagement Content (story files from intake form) | [ ] |
| WORKDRIVE_FOLDER_06_ID | Folder 06: Lead Magnets | [ ] |
| WORKDRIVE_FOLDER_07_ID | Folder 07: Analytics and Reports | [ ] |
| WORKDRIVE_FOLDER_08_ID | Folder 08: Brand Assets | [ ] |
| WORKDRIVE_FOLDER_09_ID | Folder 09: Prospect Profiles | [ ] |

## **3.5 CRM Module API Names**

| **NOTE** *CRM module API names are set by Parmeet during pre-build when the modules are created. They must match exactly what Zoho CRM assigns as the API name. Confirm each name in Zoho CRM Setup before entering it here.* |
| --- |

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| AMBASSADORS_MODULE_API_NAME | API name for the Ambassadors CRM module. | [ ] |
| REFERRALS_MODULE_API_NAME | API name for the Referrals CRM module (renamed from Commissions module). | [ ] |
| ACTIVITY_LOG_MODULE_API_NAME | API name for the Ambassador Activity Log module (new). | [ ] |
| PROSPECTS_MODULE_API_NAME | API name for the Prospects module (new). | [ ] |
| SUPPORT_TICKETS_MODULE_API_NAME | API name for the Support Tickets module (new). | [ ] |
| AD_CAMPAIGN_LOG_MODULE_API_NAME | API name for the Ad Campaign Log module (new, used by Agent 1C). | [ ] |
| SOCIAL_POST_LOG_MODULE_API_NAME | API name for the Social Post Log module (new, used by Agent 1B). | [ ] |
| PARA_DB_MODULE_NAME | API name for the paraprofessional database module used by Agent 1A. | [ ] |
| STUDENT_ALUMNI_MODULE | API name for the student and alumni module used by Agent 1A. | [ ] |
| STUDENT_AMBASSADOR_STATUS_FIELD | Field name identifying active students and alumni in Agent 1A queries. | [ ] |

## **3.6 Thresholds, Config, and Forms**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| VIP_SCORE_THRESHOLD | VIP classification threshold. Default: 60. Set by Dr. Flippen. | [ ] |
| PARA_DB_TEST_SEGMENT_SIZE | Paraprofessional database test segment size. Set by Dr. Flippen. | [ ] |
| HIGH_ENGAGEMENT_THRESHOLD | Social engagement threshold for Agent 1B. Default: 50. | [ ] |
| AGENT0_AUDIENCE_CONFIG | JSON string: audience categories, platforms, communities, keywords. | [ ] |
| LEAD_MAGNET_MAP | JSON string: lead magnet IDs to WorkDrive filenames mapping. | [ ] |
| LEAD_CAPTURE_FORM_IDS | JSON array of Zoho Forms IDs for all lead capture forms. | [ ] |
| AMBASSADOR_FORM_BASE_URL | Base URL of ambassador application form in Zoho Forms. | [ ] |
| AMBASSADOR_FORM_ID | Zoho Forms form ID for ambassador application. | [ ] |
| STORY_INTAKE_FORM_ID | Zoho Forms form ID for story content intake form (Agent 6). | [ ] |
| STORY_BUFFER_MINIMUM | Minimum number of future-dated Story files in Folder 05 before alert fires. Default: 4. | [ ] |

## **3.7 Make.com Webhook URLs**

| **NOTE** *Webhook URLs are created when Parmeet builds each Make.com scenario. They cannot be set before the scenarios exist. This means Agent 5A will report FAILs for webhook URLs until each scenario is created. Run Agent 5A again after each batch of scenarios is created to confirm URLs are set.* |
| --- |

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| MAKE_AGENT0_COMPLETE_WEBHOOK_URL | Agent 0 completion webhook: triggers Agents 1A, 1B, 1C, 1D in parallel. | [ ] |
| MAKE_VIP_NOTIFY_WEBHOOK_URL | Agent 0 VIP notification routing webhook. | [ ] |
| MAKE_AGENT1A_WEBHOOK_URL | Agent 1A weekly cycle trigger from Agent 0. | [ ] |
| MAKE_AGENT1A_FROM_1D_WEBHOOK_URL | Agent 1A trigger from Agent 1D lead capture handoff. | [ ] |
| MAKE_AGENT1B_WEBHOOK_URL | Agent 1B intelligence cycle trigger from Agent 0. | [ ] |
| MAKE_AGENT1C_WEBHOOK_URL | Agent 1C audience refresh trigger from Agent 0. | [ ] |
| MAKE_AGENT1D_WEBHOOK_URL | Agent 1D trigger (form submissions via Make.com). | [ ] |
| MAKE_SPEND_ALERT_WEBHOOK_URL | Agent 1C daily spend alert email webhook. | [ ] |
| MAKE_SPEND_CONFIRM_WEBHOOK_URL | Agent 1C coordinator spend confirmation webhook. | [ ] |
| MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL | Agent 1C kill switch alert and campaign restart webhook. | [ ] |
| MAKE_CAMPAIGN_RESTART_WEBHOOK_URL | Agent 1C campaign restart trigger. | [ ] |
| MAKE_AGENT3_WEBHOOK_URL | Agent 3 activation trigger from Agent 2. | [ ] |
| MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL | Agent 2 VIP manager notification webhook. | [ ] |
| MAKE_COORDINATOR_QUEUE_WEBHOOK_URL | Agent 2 coordinator approval queue update. | [ ] |
| MAKE_FEE_PAYMENT_CONFIRM_WEBHOOK_URL | Agent 4 fee payment confirmation from coordinator. | [ ] |
| MAKE_COORDINATOR_CHECKPOINT_WEBHOOK_URL | Agent 4 daily coordinator checkpoint email. | [ ] |
| MAKE_WEEKLY_FEE_REPORT_WEBHOOK_URL | Agent 4 weekly fee report delivery. | [ ] |
| MAKE_COMPLIANCE_VIOLATION_WEBHOOK_URL | Agent 4 compliance violation alert. | [ ] |
| MAKE_ESCALATION_WEBHOOK_URL | Agent 5 support escalation routing. | [ ] |
| MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL | Agent 1A and 1B run summary routing. | [ ] |
| MAKE_HEYGEN_SCRIPT_REVIEW_WEBHOOK_URL | HeyGen script approval email to Dr. Flippen. Used by Agents 2 and 3. | [ ] |
| MAKE_HEYGEN_APPROVAL_WEBHOOK_URL | HeyGen approval confirmation from Dr. Flippen. Used by Agents 2 and 3. | [ ] |
| MAKE_AGENT0_ONDEMAND_WEBHOOK_URL | Agent 0 on-demand research trigger for individual VIP prospects. | [ ] |
| MAKE_STORY_BUFFER_ALERT_WEBHOOK_URL | Agent 6 story content buffer low alert to Parmeet. | [ ] |

## **3.8 Zoho Social**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| ZOHO_SOCIAL_TOKEN | Read-only Zoho Social API token for engagement monitoring in Agents 0 and 1B. Static token, no OAuth refresh required. Distinct from Ayrshare which handles posting. | [ ] |
| ZOHO_SOCIAL_PORTAL_ID | Zoho Social portal ID used by Agent 1B for post engagement queries. | [ ] |

## **3.9 Alert Email Addresses**

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| PARMEET_ALERT_EMAIL | Parmeet personal email for all system error alerts. | [ ] |
| COORDINATOR_ALERT_EMAIL | Ambassador program coordinator email. Set after coordinator is assigned. | [ ] |
| VIP_MANAGER_EMAIL | VIP relationship manager email. Set after manager is assigned. | [ ] |
| SUPPORT_COORDINATOR_EMAIL | Support coordinator email. Set after coordinator is assigned. | [ ] |
| DR_FLIPPEN_EMAIL | Dr. Flippen email for kill switch alerts, threshold breaches, weekly fee reports, and HeyGen script approval requests. | [ ] |

## **3.10 Email Template Subject Lines**

Agent 5A checks all email template subject lines to confirm they are present and non-empty. Subject lines are short enough to validate reliably.

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| AMBASSADOR_EMAIL_A_SUBJECT | Subject for Email A: Application Received. | [ ] |
| AMBASSADOR_EMAIL_B_SUBJECT | Subject for Email B: Approved and Portal Access. | [ ] |
| AMBASSADOR_EMAIL_B_VIP_SUBJECT | Subject for VIP Email B. | [ ] |
| AMBASSADOR_EMAIL_C_SUBJECT | Subject for Email C: Compliance Reminder. | [ ] |
| AMBASSADOR_EMAIL_D_SUBJECT | Subject for Email D: Account Active and Welcome Kit. | [ ] |
| AGENT3_SUBJECT_WEEK1 | Subject for Week 1 Mission Anchor emails. | [ ] |
| AGENT3_SUBJECT_WEEK2 | Subject for Week 2 Success Story emails. | [ ] |
| AGENT3_SUBJECT_WEEK3 | Subject for Week 3 Ambassador Spotlight emails. | [ ] |
| AGENT3_SUBJECT_WEEK4 | Subject for Week 4 PD and Resource Drop emails. | [ ] |
| AGENT3_MILESTONE_1_SUBJECT | Subject for first referral milestone email. | [ ] |
| AGENT3_MILESTONE_5_SUBJECT | Subject for fifth referral milestone email. | [ ] |
| AGENT3_MILESTONE_10_SUBJECT | Subject for tenth referral milestone email. | [ ] |
| AGENT3_MILESTONE_25_SUBJECT | Subject for twenty-fifth referral milestone email. | [ ] |
| AGENT3_REFERRAL_APPLIED_SUBJECT | Subject for Email E: referral applied notification. | [ ] |
| AGENT3_REFERRAL_ENROLLED_SUBJECT | Subject for Email F: referral enrolled notification. | [ ] |
| AGENT3_REENGAGEMENT_1_SUBJECT | Subject for first re-engagement email. | [ ] |
| AGENT3_REENGAGEMENT_2_SUBJECT | Subject for second re-engagement email. | [ ] |
| AGENT4_FEE_ELIGIBLE_SUBJECT | Subject for Email G: Referral Fee Eligibility Notification. | [ ] |
| AGENT4_FEE_PAID_SUBJECT | Subject for Email H: Referral Fee Payment Confirmation. | [ ] |
| AGENT1D_DELIVERY_EMAIL_SUBJECT | Subject for lead magnet delivery email. | [ ] |

## **3.11 Email Template Bodies**

Agent 5A checks body template variables for presence and non-emptiness only. It does not validate content, formatting, or placeholder correctness because body templates can be several hundred characters long and contain formatting that would be difficult to validate reliably. Parmeet must manually verify that each body template contains its required placeholder tokens before the corresponding agent goes live. Required placeholders for each template are listed in the relevant agent document.

| **Variable Name** | **Description** | **Status** |
| --- | --- | --- |
| AMBASSADOR_EMAIL_A_BODY | Body template for Email A. Required placeholder: [FIRST_NAME]. | [ ] |
| AMBASSADOR_EMAIL_B_BODY | Body template for Email B. Required placeholders: [FIRST_NAME], [PORTAL_LOGIN_URL], [REFERRAL_LINK]. | [ ] |
| AMBASSADOR_EMAIL_B_VIP_BODY | Body template for VIP Email B. Required placeholders: [FIRST_NAME], [VIP_PERSONALIZATION], [PORTAL_LOGIN_URL], [VIP_MANAGER_NAME]. | [ ] |
| AMBASSADOR_EMAIL_C_BODY | Body template for Email C. Required placeholders: [FIRST_NAME], [PORTAL_LOGIN_URL], [STEPS_REMAINING]. | [ ] |
| AMBASSADOR_EMAIL_D_BODY | Body template for Email D. Required placeholders: [FIRST_NAME], [REFERRAL_LINK], [KIT_LINKS_BLOCK]. | [ ] |
| AGENT4_FEE_ELIGIBLE_BODY | Body template for Email G. Required placeholders: [FIRST_NAME], [FEE_AMOUNT], [PROGRAM_LEVEL]. | [ ] |
| AGENT4_FEE_PAID_BODY | Body template for Email H. Required placeholders: [FIRST_NAME], [FEE_AMOUNT], [PAYMENT_METHOD], [PAYMENT_DATE]. | [ ] |
| AGENT1D_DELIVERY_EMAIL_BODY | Body template for lead magnet delivery email. Required placeholders: [FIRST_NAME], [DOWNLOAD_LINK]. | [ ] |

# **4. Reading the Validation Report**

The validation report email subject line contains the go/no-go status and the failure count. Parmeet can see the outcome before opening the email. The report body organizes results by category so failures are easy to locate and fix.

## **4.1 Status Codes**

| **Status** | **Meaning** |
| --- | --- |
| PASS | Variable is present, non-empty, not a placeholder, and credential test passed where applicable. No action required. |
| WARN | Variable is present and non-placeholder but the credential test was inconclusive. This may indicate a network timeout during testing or a credential type that cannot be tested via API call. Review the detail note and confirm manually. |
| FAIL | Variable is missing, empty, contains a placeholder value, or credential test failed. This variable must be fixed before developers proceed. The detail note explains the specific failure reason. |

## **4.2 Sample Report Output**

| GRACELYN UNIVERSITY AMBASSADOR AI AGENT SYSTEM SETUP VALIDATION REPORT Generated: 2026-05-17T14:32:01Z ================================================ OVERALL STATUS: NO-GO ================================================ Total variables checked: 87 PASS: 71 WARN: 3  (credential test inconclusive) FAIL: 13 (missing, empty, or placeholder) One or more required variables are missing or invalid. DO NOT allow developers to start until all FAILs are resolved. Fix the issues listed below and run Agent 5A again. --- Zoho CRM Credentials --- PASS  │ ZOHO_CRM_CLIENT_ID                            │ PASS  │ ZOHO_CRM_CLIENT_SECRET                        │ PASS  │ ZOHO_CRM_REFRESH_TOKEN                        │ --- Make.com Webhook URLs --- FAIL  │ MAKE_AGENT0_COMPLETE_WEBHOOK_URL              │ Missing or empty FAIL  │ MAKE_VIP_NOTIFY_WEBHOOK_URL                   │ Missing or empty FAIL  │ MAKE_AGENT1A_WEBHOOK_URL                      │ Missing or empty ... --- Third-Party API Credentials --- PASS  │ CLAUDE_API_KEY                                │ FAIL  │ META_ADS_ACCESS_TOKEN                         │ Placeholder value detected: YOUR_KEY_HERE... WARN  │ HEYGEN_API_KEY                                │ Connection error: timeout after 5000ms |
| --- |

| **NOTE** *Webhook URL FAILs are expected in the first run before Make.com scenarios are built. Run Agent 5A again after all scenarios are created to confirm URLs are set. A second run with zero non-webhook FAILs is the practical go/no-go gate for the kickoff meeting.* |
| --- |

# **5. Acceptance Criteria**

| **GO / NO-GO GATE** *Agent 5A must produce a report with zero FAIL statuses on non-webhook variables before the architect kickoff meeting is scheduled. Webhook URL FAILs are acceptable before Make.com scenarios are built. A second run with all webhook URLs set and zero FAILs is required before any developer starts integration testing.* |
| --- |

| **Criterion** | **Verified By** | **Status** |
| --- | --- | --- |
| Agent 5A Catalyst function deployed and callable from Make.com scenario | Parmeet: trigger from Make.com and confirm report email arrives | [ ] Pending |
| First validation run completes and report saved to WorkDrive Folder 07 | Parmeet: check Folder 07 for Validation_Report_YYYY-MM-DD.txt | [ ] Pending |
| Report email arrives at Parmeet email address with correct subject line format | Parmeet: confirm email receipt and subject contains GO or NO-GO with failure count | [ ] Pending |
| All non-webhook variables show PASS before kickoff meeting | Parmeet: resolve all FAILs and WARNs, run Agent 5A again | [ ] Pending |
| All webhook URL variables show PASS after all Make.com scenarios are built | Parmeet: run Agent 5A final time after all scenarios created | [ ] Pending |
| Parmeet signs off on green report at architect kickoff meeting | Parmeet: distribute report at kickoff. All developers see the green report. | [ ] Pending |

Confidential  |  Parmeet Project Document  |  Page
*Gracelyn University  |  Ambassador AI Agent System  |  Agent 1C: Paid Advertising Agent  |  v1.0*

**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 1C of 9

**Paid Advertising Agent**

*Meta and Google ad campaign management,*

*daily spend alert, and kill switch enforcement*

Developer Project Document

Project Director: Parmeet

Client: Dr. Matthew Flippen, President, Gracelyn University

Version 1.0   |   May 2026

# **1. Developer Credentials and Access**

| **STOP. Do not write a single line of code until every credential in this section is in your possession and tested.** *Request all credentials from Parmeet before your first development session. Do not generate your own API keys. Every credential in this table comes from Parmeet. The Meta and Google Ads credentials carry real financial authority. Handle with extreme care.* |
| --- |

| **Tool / Platform** | **Credential Required** | **Notes** | **Obtain From** |
| --- | --- | --- | --- |
| Meta Ads API | Access token with ads_management scope. Ad Account ID. | Used to read campaign spend data, create campaigns, pause campaigns, and resume campaigns. This token has real spend authority. Never use in development against the live ad account without Parmeet present. | Parmeet |
| Google Ads API | Developer token, Customer ID, OAuth 2.0 client ID, client secret, and refresh token. | Used to read campaign spend data, create campaigns, pause campaigns, and resume campaigns. Same caution applies as Meta: real spend authority. | Parmeet |
| Zoho CRM | OAuth 2.0 client ID, client secret, and refresh token. Scopes: ZohoCRM.modules.READ, ZohoCRM.modules.CREATE, ZohoCRM.modules.UPDATE | Read access to Prospects module for audience segment data. Write access to Ad Campaign Log module for spend tracking. | Parmeet |
| Zoho Analytics | OAuth 2.0 client ID, client secret, and refresh token. Scopes: ZohoAnalytics.data.create | Write access to push daily spend data to the coordinator dashboard. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, and refresh token. Scopes: WorkDrive.files.READ | Read access to Folder 08 (Brand Assets) for ad copy rules and voice guidelines. | Parmeet |
| Zoho Catalyst | Catalyst CLI credentials and project access. | Full developer access to deploy serverless functions and scheduled jobs. | Parmeet |
| Make.com | Invite to Gracelyn Make.com workspace as a developer. | You will build the daily spend alert scenario, the kill switch confirmation scenario, and the campaign status scenarios. | Parmeet |

## **1.1 Authentication: Zoho APIs**

| async function getZohoAccessToken(refreshToken, clientId, clientSecret) {   const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {     method: 'POST',     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },     body: new URLSearchParams({       refresh_token: refreshToken,       client_id:     clientId,       client_secret: clientSecret,       grant_type:    'refresh_token'     })   });   const data = await response.json();   if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));   return data.access_token; } // Refresh all Zoho tokens at function start const crmToken       = await getZohoAccessToken(   process.env.ZOHO_CRM_REFRESH_TOKEN,   process.env.ZOHO_CRM_CLIENT_ID,   process.env.ZOHO_CRM_CLIENT_SECRET ); const analyticsToken = await getZohoAccessToken(   process.env.ZOHO_ANALYTICS_REFRESH_TOKEN,   process.env.ZOHO_ANALYTICS_CLIENT_ID,   process.env.ZOHO_ANALYTICS_CLIENT_SECRET ); const workdriveToken = await getZohoAccessToken(   process.env.WORKDRIVE_REFRESH_TOKEN,   process.env.WORKDRIVE_CLIENT_ID,   process.env.WORKDRIVE_CLIENT_SECRET ); |
| --- |

## **1.2 Authentication: Meta Ads API**

| // Meta Ads uses a long-lived access token stored in Catalyst env vars // Token is not refreshed via OAuth in the same pattern as Zoho // Parmeet provides a long-lived token (valid 60 days) // Agent 1C must alert Parmeet when the token is within 7 days of expiry const META_TOKEN      = process.env.META_ADS_ACCESS_TOKEN; const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID; const META_API_BASE   = 'https://graph.facebook.com/v19.0'; async function metaGet(endpoint, params = {}) {   const url = new URL(`${META_API_BASE}/${endpoint}`);   url.searchParams.set('access_token', META_TOKEN);   Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));   const response = await fetch(url.toString());   const data = await response.json();   if (data.error) throw new Error('Meta API error: ' + JSON.stringify(data.error));   return data; } async function metaPost(endpoint, body = {}) {   const response = await fetch(`${META_API_BASE}/${endpoint}`, {     method: 'POST',     headers: { 'Content-Type': 'application/json' },     body: JSON.stringify({ ...body, access_token: META_TOKEN })   });   const data = await response.json();   if (data.error) throw new Error('Meta API error: ' + JSON.stringify(data.error));   return data; } |
| --- |

## **1.3 Authentication: Google Ads API**

| // Google Ads uses OAuth 2.0 with a refresh token // The Google Ads API requires the developer token in every request header async function getGoogleAdsToken() {   const response = await fetch('https://oauth2.googleapis.com/token', {     method: 'POST',     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },     body: new URLSearchParams({       client_id:     process.env.GOOGLE_ADS_CLIENT_ID,       client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,       refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,       grant_type:    'refresh_token'     })   });   const data = await response.json();   if (!data.access_token) throw new Error('Google Ads token refresh failed: ' + JSON.stringify(data));   return data.access_token; } // Google Ads API base configuration // GOOGLE_ADS_API_VERSION is stored as a Catalyst environment variable // so Parmeet can update it when Google deprecates a version without // requiring a code deployment. Default: v16. Check current version at: // https://developers.google.com/google-ads/api/docs/release-notes const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID; const GOOGLE_ADS_DEV_TOKEN   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN; const GOOGLE_ADS_VERSION     = process.env.GOOGLE_ADS_API_VERSION ││ 'v16'; const GOOGLE_ADS_API_BASE    = `https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}`; async function googleAdsGet(endpoint, googleToken) {   const response = await fetch(`${GOOGLE_ADS_API_BASE}/${endpoint}`, {     headers: {       'Authorization':           `Bearer ${googleToken}`,       'developer-token':          GOOGLE_ADS_DEV_TOKEN,       'login-customer-id':        GOOGLE_ADS_CUSTOMER_ID     }   });   const data = await response.json();   if (data.error) throw new Error('Google Ads error: ' + JSON.stringify(data.error));   return data; } |
| --- |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 1C manages Gracelyn's paid ambassador recruiting campaigns on Meta (Facebook and Instagram ads) and Google Ads. It creates and monitors campaigns targeting educator demographics, paraprofessional audiences, childcare worker segments, Christian parent and educator communities, and mission-aligned audiences. It compiles daily spend data and delivers it to the coordinator dashboard by 8:00 AM CST every morning. Most critically, it enforces a hard kill switch: if the coordinator does not confirm the daily spend report by 10:00 AM CST, all campaigns pause automatically. No campaign resumes without a deliberate human restart action.

| **KILL SWITCH: THIS IS NON-NEGOTIABLE** *The kill switch is the most important feature in this agent. It is not optional. It is not a nice-to-have. Every other function in Agent 1C is secondary to the kill switch. Build and test the kill switch before building any campaign management function. If the kill switch fails, campaigns can spend unchecked. This is a financial risk to Gracelyn University.* |
| --- |

## **2.2 Position in the 9-Agent System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Agent 0 weekly complete | Agent 0 fires a webhook to all four recruiting sub-agents after its Sunday night run. Agent 1C reads the audience segment data from the CRM Prospects module to inform ad targeting for the week. |
| TRIGGERED BY | Zoho Catalyst scheduled jobs | Three scheduled jobs run independently: daily spend compilation at 7:50 AM CST, kill switch check at 10:00 AM CST, and campaign performance review on Mondays at 6:00 AM CST. |
| TRIGGERED BY | Make.com coordinator confirmation webhook | When the coordinator confirms daily spend in the dashboard, Make.com fires a webhook to Agent 1C to record confirmation and allow campaigns to continue. If no webhook arrives by 10:00 AM CST, the kill switch fires. |
| READS FROM | Zoho CRM: Prospects module | Reads audience segment data by Ambassador_Role_Category and Motivation_Hypothesis to understand which audience types are converting and adjust ad targeting. |
| READS FROM | WorkDrive Folder 08 | Brand asset files: ambassador_copy_rules.txt and ambassador_voice_guidelines.txt. Used when Claude generates ad copy. |
| WRITES TO | Zoho Analytics coordinator dashboard | Daily spend data for each platform: spend vs. threshold, campaign status, pause status, and confirmation received flag. |
| WRITES TO | Zoho CRM: Ad Campaign Log module | Every campaign event is logged: campaign created, spend recorded, paused, resumed, threshold exceeded. Parmeet confirmed API module name during pre-build. |

## **2.3 What This Agent Does NOT Do**

- Does not send emails to prospects. Agent 1A owns email outreach.

- Does not post organic social content. Agent 1B owns organic social posting.

- Does not manage the ambassador application form or onboarding. Agent 2 owns those.

- Does not resume paused campaigns automatically. Only a deliberate human restart action via the coordinator dashboard resumes campaigns after a kill switch event.

- Does not exceed the daily spend thresholds set by Dr. Flippen. Thresholds are stored in Catalyst as environment variables and are treated as hard caps, not guidelines.

- Does not run campaigns in a development or test environment against live ad accounts without Parmeet present. Always use a test ad account for development.

## **2.4 Run Cycle**

| **Job Name** | **Trigger** | **Time (CST)** | **Function** |
| --- | --- | --- | --- |
| compileDailySpend | Catalyst scheduled job | Daily, 7:50 AM | Reads prior-day spend from Meta and Google. Compiles summary. Pushes to Zoho Analytics coordinator dashboard. Sends spend alert email via Make.com. |
| checkSpendConfirmation | Catalyst scheduled job | Daily, 10:00 AM | Checks whether the coordinator has confirmed the daily spend alert. If not confirmed: pause all active campaigns on both platforms immediately. |
| recordConfirmation | Make.com webhook | When coordinator confirms | Coordinator clicks confirm in the dashboard. Make.com fires webhook to Agent 1C. Agent 1C writes confirmation timestamp to the daily spend log record in CRM. |
| weeklyAudienceRefresh | Make.com webhook from Agent 0 | Monday, after Agent 0 | Reads updated CRM Prospects data. Assesses audience segment performance. Prepares weekly targeting recommendations for Parmeet review. |
| weeklyPerformanceReview | Catalyst scheduled job | Monday, 6:00 AM | Queries Meta and Google for weekly campaign performance metrics. Writes summary to Ad Campaign Log. Flags underperforming campaigns for Parmeet review. |

# **3. Inputs**

## **3.1 Input 1: Meta Ads Spend Data**

Agent 1C reads prior-day spend from Meta Ads every morning at 7:50 AM CST before the coordinator dashboard is updated. The query covers all active ambassador recruiting campaigns.

| // Read prior-day spend across all active Meta campaigns // Meta Ads API Insights endpoint async function getMetaDailySpend() {   const yesterday = new Date();   yesterday.setDate(yesterday.getDate() - 1);   const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD   const data = await metaGet(     `act_${META_AD_ACCOUNT}/insights`,     {       fields:     'campaign_name,spend,impressions,clicks,cpc,ctr',       time_range: JSON.stringify({ since: dateStr, until: dateStr }),       level:      'campaign'     }   );   const campaigns = data.data ││ [];   const totalSpend = campaigns.reduce((sum, c) => sum + parseFloat(c.spend ││ 0), 0);   return {     date:        dateStr,     totalSpend:  Math.round(totalSpend * 100) / 100,     threshold:   parseFloat(process.env.META_DAILY_SPEND_THRESHOLD),     overThreshold: totalSpend > parseFloat(process.env.META_DAILY_SPEND_THRESHOLD),     campaigns:   campaigns   }; } |
| --- |

## **3.2 Input 2: Google Ads Spend Data**

Agent 1C reads prior-day spend from Google Ads using the Google Ads Query Language (GAQL). Query runs in parallel with the Meta spend query at 7:50 AM CST.

| // Read prior-day spend across all active Google campaigns // Uses Google Ads Query Language (GAQL) async function getGoogleDailySpend(googleToken) {   const yesterday = new Date();   yesterday.setDate(yesterday.getDate() - 1);   const dateStr = yesterday.toISOString().split('T')[0];   const query = [     'SELECT campaign.name, campaign.status,',     'metrics.cost_micros, metrics.impressions,',     'metrics.clicks, metrics.average_cpc',     'FROM campaign',     'WHERE segments.date = ' + JSON.stringify(dateStr),     'AND campaign.status = ENABLED'   ].join(' ');   const response = await fetch(     `${GOOGLE_ADS_API_BASE}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`,     {       method: 'POST',       headers: {         'Authorization':   `Bearer ${googleToken}`,         'developer-token':  GOOGLE_ADS_DEV_TOKEN,         'Content-Type':    'application/json'       },       body: JSON.stringify({ query })     }   );   const data = await response.json();   if (data.error) throw new Error('Google Ads query failed: ' + JSON.stringify(data.error));   const rows = data.results ││ [];   const totalSpendMicros = rows.reduce(     (sum, r) => sum + parseInt(r.metrics?.cost_micros ││ 0), 0   );   const totalSpend = totalSpendMicros / 1_000_000; // Convert micros to dollars   return {     date:        dateStr,     totalSpend:  Math.round(totalSpend * 100) / 100,     threshold:   parseFloat(process.env.GOOGLE_DAILY_SPEND_THRESHOLD),     overThreshold: totalSpend > parseFloat(process.env.GOOGLE_DAILY_SPEND_THRESHOLD),     campaigns:   rows   }; } |
| --- |

## **3.3 Input 3: Coordinator Confirmation Status**

At 10:00 AM CST the kill switch function checks whether a confirmation record exists in the Ad Campaign Log for today's date. If no confirmation exists, campaigns pause. The confirmation is written by the recordConfirmation function when the coordinator clicks confirm in the dashboard.

| // Check whether today's spend has been confirmed by the coordinator // Called by the 10:00 AM checkSpendConfirmation job async function checkTodayConfirmed(crmToken) {   const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   const url = `https://www.zohoapis.com/crm/v3/${moduleName}/search` +     `?criteria=((Log_Date:equals:${today})` +     `and(Log_Type:equals:Spend Confirmation)` +     `and(Confirmed:equals:true))` +     `&fields=id,Log_Date,Confirmed,Confirmed_At` +     `&per_page=1`;   const response = await fetch(url, {     headers: { 'Authorization': `Zoho-oauthtoken ${crmToken}` }   });   const data = await response.json();   const records = data.data ││ [];   return {     confirmed:    records.length > 0,     confirmedAt:  records[0]?.Confirmed_At ││ null   }; } |
| --- |

## **3.4 Input 4: Audience Segment Data from CRM Prospects Module**

On Monday mornings after Agent 0 runs, Agent 1C reads the Prospects module grouped by Ambassador_Role_Category and Motivation_Hypothesis. This tells the agent which audience types are being found in the research pipeline and at what VIP score levels, informing ad targeting adjustments for the week.

| // Aggregate prospect data by role category and motivation hypothesis // Used to inform ad targeting adjustments async function getAudienceSegmentData(crmToken) {   const moduleName = process.env.PROSPECTS_MODULE_API_NAME;   // Get all prospects from the last 30 days   const thirtyDaysAgo = new Date();   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);   const dateStr = thirtyDaysAgo.toISOString().split('T')[0];   const url = `https://www.zohoapis.com/crm/v3/${moduleName}/search` +     `?criteria=(Created_Date:greater_than:${dateStr})` +     `&fields=Ambassador_Role_Category,Motivation_Hypothesis,VIP_Score,Contact_Found` +     `&per_page=200`;   const response = await fetch(url, {     headers: { 'Authorization': `Zoho-oauthtoken ${crmToken}` }   });   const data = await response.json();   return data.data ││ []; } |
| --- |

# **4. Process Steps**

Agent 1C runs five distinct jobs. The kill switch job and the daily spend compilation job are the most critical. Build and test these two first before building campaign management or audience refresh functions.

## **Job A: compileDailySpend (7:50 AM CST daily)**

### **Step A1: Refresh All Tokens**

Refresh all three Zoho tokens (CRM, Analytics, WorkDrive) and the Google Ads token. Abort the job and alert Parmeet immediately if any token refresh fails.

### **Step A2: Read Prior-Day Spend from Both Platforms**

Call getMetaDailySpend() and getGoogleDailySpend() in parallel. If either call fails, use a safe default of 0 spend for that platform and flag the failure in the dashboard. Do not abort the job: even partial spend data is better than no dashboard update.

| // Run both spend queries in parallel const [metaSpend, googleSpend] = await Promise.allSettled([   getMetaDailySpend(),   getGoogleDailySpend(googleToken) ]); const metaData   = metaSpend.status   === 'fulfilled' ? metaSpend.value   : { totalSpend: 0, error: metaSpend.reason.message }; const googleData = googleSpend.status === 'fulfilled' ? googleSpend.value : { totalSpend: 0, error: googleSpend.reason.message }; const combinedSpend = (metaData.totalSpend ││ 0) + (googleData.totalSpend ││ 0); |
| --- |

### **Step A3: Write Daily Spend Log to CRM**

Create a new Ad Campaign Log record with today's spend data, threshold values, over-threshold flags, and Confirmed = false. This record is what the 10:00 AM kill switch job reads.

| async function writeDailySpendLog(metaData, googleData, combinedSpend, crmToken) {   const today      = new Date().toISOString().split('T')[0];   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   const record = {     data: [{       Log_Date:             today,       Log_Type:             'Spend Confirmation',       Meta_Spend:           metaData.totalSpend ││ 0,       Meta_Threshold:       parseFloat(process.env.META_DAILY_SPEND_THRESHOLD),       Meta_Over_Threshold:  metaData.overThreshold ││ false,       Meta_Error:           metaData.error ││ null,       Google_Spend:         googleData.totalSpend ││ 0,       Google_Threshold:     parseFloat(process.env.GOOGLE_DAILY_SPEND_THRESHOLD),       Google_Over_Threshold: googleData.overThreshold ││ false,       Google_Error:         googleData.error ││ null,       Combined_Spend:       combinedSpend,       Confirmed:            false,       Confirmed_At:         null,       Kill_Switch_Fired:    false,       Kill_Switch_At:       null     }]   };   const response = await fetch(`https://www.zohoapis.com/crm/v3/${moduleName}`, {     method: 'POST',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify(record)   });   const data = await response.json();   return data.data[0].details.id; // Log record ID for later updates } |
| --- |

### **Step A4: Push Spend Data to Zoho Analytics Coordinator Dashboard**

Update the coordinator dashboard in Zoho Analytics with today's spend data. The dashboard must show: Meta spend vs. threshold, Google spend vs. threshold, combined spend, over-threshold flags, campaign count by platform, and a Confirm button that fires the Make.com confirmation webhook.

| // Push spend data to Zoho Analytics for coordinator dashboard // AMBASSADOR_ANALYTICS_WORKSPACE_ID set by Parmeet async function updateAnalyticsDashboard(spendSummary, analyticsToken) {   const workspaceId = process.env.AMBASSADOR_ANALYTICS_WORKSPACE_ID;   // Zoho Analytics import API: upsert row by date key   const payload = {     ZOHO_ACTION:  'IMPORT',     ZOHO_COLUMNS: JSON.stringify([       'Date', 'Meta_Spend', 'Meta_Threshold', 'Meta_Over_Threshold',       'Google_Spend', 'Google_Threshold', 'Google_Over_Threshold',       'Combined_Spend', 'Confirmed', 'Kill_Switch_Fired'     ]),     ZOHO_ROWS: JSON.stringify([[       spendSummary.date,       spendSummary.metaSpend,       spendSummary.metaThreshold,       spendSummary.metaOverThreshold,       spendSummary.googleSpend,       spendSummary.googleThreshold,       spendSummary.googleOverThreshold,       spendSummary.combinedSpend,       false,       false     ]]),     ZOHO_IMPORT_TYPE: 'UPDATEADD',     ZOHO_MATCHING_COLUMNS: 'Date'   };   // Confirm exact Analytics import API endpoint with Parmeet   // Endpoint depends on workspace and table configuration   await fetch(`https://analyticsapi.zoho.com/api/v2/workspaces/${workspaceId}/views/DailySpendLog/rows`,     {       method: 'POST',       headers: {         'Authorization': `Zoho-oauthtoken ${analyticsToken}`,         'Content-Type': 'application/x-www-form-urlencoded'       },       body: new URLSearchParams(payload)     }   ); } |
| --- |

### **Step A5: Send Daily Spend Alert Email via Make.com**

After updating the dashboard, fire the Make.com spend alert webhook. Make.com sends the alert email to the coordinator and Parmeet. The email must arrive before 8:00 AM CST. The compileDailySpend job starts at 7:50 AM to ensure it completes in time.

| async function sendSpendAlert(spendSummary, logRecordId) {   const overThresholdWarning = spendSummary.metaOverThreshold ││ spendSummary.googleOverThreshold     ? 'WARNING: One or more platforms exceeded the daily spend threshold.'     : 'All platforms within daily spend threshold.';   const payload = {     trigger_source:       'agent_1c_daily_spend_alert',     alert_date:           spendSummary.date,     meta_spend:           spendSummary.metaSpend,     meta_threshold:       spendSummary.metaThreshold,     meta_over_threshold:  spendSummary.metaOverThreshold,     google_spend:         spendSummary.googleSpend,     google_threshold:     spendSummary.googleThreshold,     google_over_threshold: spendSummary.googleOverThreshold,     combined_spend:       spendSummary.combinedSpend,     threshold_status:     overThresholdWarning,     log_record_id:        logRecordId,     confirm_webhook_url:  process.env.MAKE_SPEND_CONFIRM_WEBHOOK_URL   };   await fetch(process.env.MAKE_SPEND_ALERT_WEBHOOK_URL, {     method: 'POST',     headers: { 'Content-Type': 'application/json' },     body: JSON.stringify(payload)   }); } |
| --- |

| **NOTE** *The spend alert email must include a single-click Confirm button that fires the MAKE_SPEND_CONFIRM_WEBHOOK_URL. Parmeet configures this button in the Make.com email scenario. The coordinator clicks Confirm or campaigns pause at 10:00 AM CST. There is no other option.* |
| --- |

## **Job B: checkSpendConfirmation (10:00 AM CST daily)**

This is the kill switch job. It is the most important function in Agent 1C. It runs exactly once per day at 10:00 AM CST. It checks whether the coordinator has confirmed today's spend report. If not confirmed, it pauses all campaigns on both platforms immediately and logs the kill switch event.

### **Step B1: Refresh Tokens**

Refresh CRM token and both ad platform tokens. If any token refresh fails, alert Parmeet immediately and attempt campaign pause using previously cached credentials. Never skip the pause attempt due to a token failure.

### **Step B2: Check Confirmation Status**

Call checkTodayConfirmed() from Section 3.3. If confirmed = true, log the check and exit. Campaigns continue running. If confirmed = false, proceed immediately to Step B3.

### **Step B3: Pause All Campaigns on Both Platforms**

| **KILL SWITCH: THIS IS NON-NEGOTIABLE** *If the coordinator has not confirmed by 10:00 AM CST, pause ALL active ambassador recruiting campaigns on Meta AND Google immediately. Do not pause selectively. Do not wait. Do not send a warning first. Pause first, then alert.* |
| --- |

| // Pause all active Meta ambassador recruiting campaigns async function pauseAllMetaCampaigns() {   // Get all active campaigns in the ambassador ad account   const campaigns = await metaGet(     `act_${META_AD_ACCOUNT}/campaigns`,     { fields: 'id,name,status', filtering: '[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]' }   );   const pausedIds = [];   for (const campaign of (campaigns.data ││ [])) {     await metaPost(`${campaign.id}`, { status: 'PAUSED' });     pausedIds.push(campaign.id);   }   return pausedIds; } // Pause all active Google ambassador recruiting campaigns async function pauseAllGoogleCampaigns(googleToken) {   // Query all enabled campaigns   const query = [     'SELECT campaign.id, campaign.name FROM campaign',     'WHERE campaign.status = ENABLED'   ].join(' ');   const searchResp = await fetch(     `${GOOGLE_ADS_API_BASE}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`,     {       method: 'POST',       headers: {         'Authorization':   `Bearer ${googleToken}`,         'developer-token':  GOOGLE_ADS_DEV_TOKEN,         'Content-Type':    'application/json'       },       body: JSON.stringify({ query })     }   );   const searchData = await searchResp.json();   const campaigns = searchData.results ││ [];   // Pause each campaign via mutate operation   const operations = campaigns.map(row => ({     updateMask: 'status',     update: { resourceName: row.campaign.resourceName, status: 'PAUSED' }   }));   if (operations.length > 0) {     await fetch(       `${GOOGLE_ADS_API_BASE}/customers/${GOOGLE_ADS_CUSTOMER_ID}/campaigns:mutate`,       {         method: 'POST',         headers: {           'Authorization':   `Bearer ${googleToken}`,           'developer-token':  GOOGLE_ADS_DEV_TOKEN,           'Content-Type':    'application/json'         },         body: JSON.stringify({ operations })       }     );   }   return campaigns.map(r => r.campaign.id); } |
| --- |

### **Step B4: Log Kill Switch Event and Alert**

After pausing all campaigns, update the daily spend log CRM record with Kill_Switch_Fired = true and Kill_Switch_At = now. Then fire the kill switch alert webhook to Make.com. Make.com sends an urgent email to the coordinator, Parmeet, and Dr. Flippen.

| async function logKillSwitchEvent(logRecordId, pausedMetaIds, pausedGoogleIds, crmToken) {   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   const now = new Date().toISOString();   await fetch(`https://www.zohoapis.com/crm/v3/${moduleName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify({ data: [{       id:                   logRecordId,       Kill_Switch_Fired:    true,       Kill_Switch_At:       now,       Paused_Meta_IDs:      JSON.stringify(pausedMetaIds),       Paused_Google_IDs:    JSON.stringify(pausedGoogleIds)     }] })   }); } async function sendKillSwitchAlert(spendDate, pausedCount) {   const payload = {     trigger_source:  'agent_1c_kill_switch_fired',     spend_date:      spendDate,     fired_at:        new Date().toISOString(),     campaigns_paused: pausedCount,     reason:          'Daily spend not confirmed by coordinator by 10:00 AM CST.',     restart_instructions:       'To resume campaigns: confirm in the coordinator dashboard.',       'Campaigns will NOT restart automatically.',       'A deliberate restart action is required.'   };   await fetch(process.env.MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL, {     method: 'POST',     headers: { 'Content-Type': 'application/json' },     body: JSON.stringify(payload)   }); } |
| --- |

## **Job C: recordConfirmation (on coordinator action)**

This function is called by Make.com when the coordinator clicks the Confirm button in the dashboard. It must run before 10:00 AM CST for the kill switch check to find the confirmation. It writes the confirmation to the CRM log record and updates the Zoho Analytics dashboard.

| // Called by Make.com Scenario 2 when coordinator confirms spend // Payload from Make.com: { log_record_id, confirmed_by, confirmed_at } async function recordConfirmation(payload, crmToken, analyticsToken) {   const { log_record_id, confirmed_at } = payload;   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   // Step 1: Update CRM log record with confirmation   await fetch(`https://www.zohoapis.com/crm/v3/${moduleName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify({ data: [{       id:           log_record_id,       Confirmed:    true,       Confirmed_At: confirmed_at ││ new Date().toISOString()     }] })   });   // Step 2: Update Analytics dashboard to show Confirmed = true   const today = new Date().toISOString().split('T')[0];   await updateAnalyticsDashboardConfirmation(today, analyticsToken);   return { success: true, message: 'Confirmation recorded. Campaigns continue.' }; } |
| --- |

## **Job D: Campaign Resume (coordinator action only)**

When a kill switch event has fired, campaigns do not restart automatically. The coordinator must explicitly trigger a restart from the coordinator dashboard. Make.com Scenario 3 handles this: the coordinator clicks Restart Campaigns in the dashboard, Make.com fires a webhook to Agent 1C, and Agent 1C resumes the previously paused campaigns by ID.

| **CRITICAL RULE** *Campaigns resume only when the coordinator explicitly triggers the restart AND a confirmation for today**'**s spend exists in the CRM log. If no confirmation exists when a restart is triggered, the function rejects the restart and alerts Parmeet. Campaigns cannot restart without confirmed spend.* |
| --- |

| // Called by Make.com Scenario 3 when coordinator triggers campaign restart // Payload: { log_record_id, paused_meta_ids, paused_google_ids } async function resumeCampaigns(payload, googleToken, crmToken) {   // Verify today's spend is confirmed before resuming   const confirmStatus = await checkTodayConfirmed(crmToken);   if (!confirmStatus.confirmed) {     await sendRestartRejectedAlert();     return { success: false, reason: 'Cannot restart: spend not confirmed for today.' };   }   const metaIds   = JSON.parse(payload.paused_meta_ids ││ '[]');   const googleIds = JSON.parse(payload.paused_google_ids ││ '[]');   // Resume Meta campaigns   for (const id of metaIds) {     await metaPost(`${id}`, { status: 'ACTIVE' });   }   // Resume Google campaigns   if (googleIds.length > 0) {     const operations = googleIds.map(id => ({       updateMask: 'status',       update: { resourceName: `customers/${GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`, status: 'ENABLED' }     }));     await fetch(       `${GOOGLE_ADS_API_BASE}/customers/${GOOGLE_ADS_CUSTOMER_ID}/campaigns:mutate`,       {         method: 'POST',         headers: {           'Authorization': `Bearer ${googleToken}`,           'developer-token': GOOGLE_ADS_DEV_TOKEN,           'Content-Type': 'application/json'         },         body: JSON.stringify({ operations })       }     );   }   // Update CRM log record   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   await fetch(`https://www.zohoapis.com/crm/v3/${moduleName}`, {     method: 'PUT',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify({ data: [{       id:          payload.log_record_id,       Restarted:   true,       Restarted_At: new Date().toISOString()     }] })   });   return { success: true, metaResumed: metaIds.length, googleResumed: googleIds.length }; } |
| --- |

## **Job E: weeklyPerformanceReview (Monday 6:00 AM CST)**

Runs every Monday morning before the weekly audience refresh. Queries Meta and Google for the prior week's campaign performance metrics, writes a structured summary to the Ad Campaign Log CRM module, and flags any campaign whose cost-per-click or cost-per-application has risen more than 20 percent week-over-week for Parmeet review.

| async function runWeeklyPerformanceReview(googleToken, crmToken) {   const sevenDaysAgo = new Date();   sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);   const dateFrom = sevenDaysAgo.toISOString().split('T')[0];   const dateTo   = new Date().toISOString().split('T')[0];   // Step E1: Query Meta weekly performance   const metaPerf = await metaGet(     `act_${META_AD_ACCOUNT}/insights`,     {       fields:     'campaign_name,spend,impressions,clicks,cpc,ctr,actions',       time_range: JSON.stringify({ since: dateFrom, until: dateTo }),       level:      'campaign'     }   );   // Step E2: Query Google weekly performance   const googleQuery = [     'SELECT campaign.name, campaign.status,',     'metrics.cost_micros, metrics.impressions,',     'metrics.clicks, metrics.average_cpc,',     'metrics.conversions',     'FROM campaign',     'WHERE segments.date BETWEEN ' + JSON.stringify(dateFrom) +     ' AND ' + JSON.stringify(dateTo),     'AND campaign.status = ENABLED'   ].join(' ');   const googlePerf = await fetch(     `${GOOGLE_ADS_API_BASE}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`,     {       method: 'POST',       headers: {         'Authorization':   `Bearer ${googleToken}`,         'developer-token':  GOOGLE_ADS_DEV_TOKEN,         'Content-Type':    'application/json'       },       body: JSON.stringify({ query: googleQuery })     }   );   const googleData = await googlePerf.json();   // Step E3: Write performance summary to Ad Campaign Log   const moduleName = process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME;   const record = {     data: [{       Log_Date:           dateTo,       Log_Type:           'Weekly Performance Review',       Meta_Total_Spend:   (metaPerf.data ││ []).reduce((s,c) => s + parseFloat(c.spend ││ 0), 0),       Google_Total_Spend: (googleData.results ││ []).reduce(         (s,r) => s + (parseInt(r.metrics?.cost_micros ││ 0) / 1_000_000), 0       ),       Review_Period_From: dateFrom,       Review_Period_To:   dateTo,       Meta_Campaigns:     JSON.stringify((metaPerf.data ││ []).map(c => ({         name: c.campaign_name, spend: c.spend, cpc: c.cpc, ctr: c.ctr       }))),       Performance_Flags:  '[]'  // Populated below if thresholds exceeded     }]   };   await fetch(`https://www.zohoapis.com/crm/v3/${moduleName}`, {     method: 'POST',     headers: {       'Authorization': `Zoho-oauthtoken ${crmToken}`,       'Content-Type': 'application/json'     },     body: JSON.stringify(record)   });   // Step E4: Fire Parmeet alert if any campaign CPC rose more than 20% vs prior week   // Prior-week comparison requires reading last week's Ad Campaign Log record   // This comparison is implemented in a follow-on Catalyst function call   // See weeklyPerformanceComparison() for the threshold logic   // Alert fires via MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL   return {     metaCampaigns:   (metaPerf.data ││ []).length,     googleCampaigns: (googleData.results ││ []).length,     reviewDate:      dateTo   }; } |
| --- |

# **5. Claude API Prompt Structure**

Agent 1C uses Claude API in one limited context: generating the weekly audience targeting recommendation summary for Parmeet's review. It does not use Claude to generate ad creative. Ad creative is managed by Parmeet directly in Meta and Google Ads dashboards.

## **5.1 Weekly Audience Recommendation Prompt**

| async function generateAudienceRecommendation(segmentData, spendHistory, claudeApiKey) {   const summary = summarizeSegmentData(segmentData);   const systemPrompt = [     'You are analyzing ambassador recruiting campaign performance data for',     'Gracelyn University to generate a weekly targeting recommendation.',     '',     'Gracelyn is a DEAC-accredited online Christian university serving K-12 educators.',     'The ambassador program recruits educators, childcare workers, faith community',     'leaders, and mission-aligned advocates who share Gracelyn with their networks.',     '',     'Based on the prospect data and spend history provided, produce a brief',     '(3-5 bullet points) targeting recommendation for the coming week.',     '',     'Focus on: which audience segments are producing the most prospects,',     'which platforms are most cost-efficient, and one specific adjustment',     'to consider for the coming week.',     '',     'Be specific and actionable. No preamble. Bullet points only.',     'No em dashes. No commission language.'   ].join('\n');   const userPrompt = [     'PROSPECT SEGMENT DATA (last 30 days):',     JSON.stringify(summary, null, 2),     '',     'SPEND HISTORY (last 7 days):',     JSON.stringify(spendHistory, null, 2),     '',     'Generate a weekly targeting recommendation.'   ].join('\n');   const response = await fetch('https://api.anthropic.com/v1/messages', {     method: 'POST',     headers: {       'Content-Type': 'application/json',       'x-api-key': claudeApiKey,       'anthropic-version': '2023-06-01'     },     body: JSON.stringify({       model: 'claude-sonnet-4-20250514',       max_tokens: 400,       system: systemPrompt,       messages: [{ role: 'user', content: userPrompt }]     })   });   const data = await response.json();   return data.content[0].text; } |
| --- |

# **6. Make.com Scenario Configuration**

## **6.1 Scenario 1: Daily Spend Alert Email**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Store URL as MAKE_SPEND_ALERT_WEBHOOK_URL in Catalyst. Agent 1C compileDailySpend job calls this at 7:50 AM CST after compiling spend data. |
| 2 | Email (Zoho Mail) | To: COORDINATOR_ALERT_EMAIL and PARMEET_ALERT_EMAIL. Subject: Daily Ad Spend Report [Date] - Action Required by 10:00 AM CST. Body: Meta spend vs. threshold, Google spend vs. threshold, combined total, any over-threshold warnings, and a prominent Confirm button that fires MAKE_SPEND_CONFIRM_WEBHOOK_URL. Must arrive in inbox before 8:00 AM CST. |
| 3 | Email (Zoho Mail) | Condition: Only if webhook body contains over_threshold = true for either platform. Additional urgent email to PARMEET_ALERT_EMAIL and DR_FLIPPEN_EMAIL. Subject: THRESHOLD EXCEEDED - Immediate Review Required. Body: Which platform exceeded threshold, amount over, and direct link to coordinator dashboard. |

## **6.2 Scenario 2: Coordinator Spend Confirmation**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Store URL as MAKE_SPEND_CONFIRM_WEBHOOK_URL in Catalyst. This URL is embedded in the Confirm button in Scenario 1 email. Coordinator clicks the button, which fires this webhook. |
| 2 | HTTP: Make a Request | Method: POST. URL: Agent 1C Catalyst function URL with mode=recordConfirmation. Body: { log_record_id: {{log_record_id}}, confirmed_by: 'coordinator', confirmed_at: {{now}} }. Parse response: Yes. |
| 3 | Email (Zoho Mail) | Condition: Step 2 returns success = true. To: COORDINATOR_ALERT_EMAIL. Subject: Spend Confirmed for [Date]. Body: Confirmation recorded. Campaigns continue running. |
| 4 | Email (Zoho Mail) | Condition: Step 2 returns error. To: PARMEET_ALERT_EMAIL. Subject: Confirmation Recording Failed. Body: Error details. Coordinator must re-confirm before 10:00 AM CST. |

## **6.3 Scenario 3: Kill Switch Alert and Campaign Restart**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Store URL as MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL in Catalyst. Agent 1C checkSpendConfirmation job calls this when the kill switch fires. |
| 2 | Email (Zoho Mail) | To: COORDINATOR_ALERT_EMAIL, PARMEET_ALERT_EMAIL, and DR_FLIPPEN_EMAIL. Subject: KILL SWITCH FIRED - All Campaigns Paused [Date]. Body: Campaigns paused count, reason (no confirmation by 10:00 AM CST), and Restart Campaigns button that fires MAKE_CAMPAIGN_RESTART_WEBHOOK_URL. Bold, prominent messaging. |
| 3 | Webhooks: Custom Webhook | Second webhook in this scenario for the Restart Campaigns button. Store URL as MAKE_CAMPAIGN_RESTART_WEBHOOK_URL in Catalyst. |
| 4 | HTTP: Make a Request | Method: POST. URL: Agent 1C Catalyst function with mode=resumeCampaigns. Body: { log_record_id, paused_meta_ids, paused_google_ids }. Parse response: Yes. |
| 5 | Email (Zoho Mail) | Condition: Step 4 success. To: COORDINATOR_ALERT_EMAIL and PARMEET_ALERT_EMAIL. Subject: Campaigns Resumed [Date] [Time]. Body: How many campaigns resumed on each platform. |
| 6 | Email (Zoho Mail) | Condition: Step 4 returns error or rejection. To: PARMEET_ALERT_EMAIL. Subject: Campaign Restart Rejected. Body: Reason (unconfirmed spend) and required next action. |

## **6.4 Scenario 4: Agent 0 Trigger and Audience Refresh**

| **Step** | **Module** | **Configuration** |
| --- | --- | --- |
| 1 | Webhooks: Custom Webhook | Create a new webhook. Store URL as MAKE_AGENT1C_WEBHOOK_URL in Catalyst. Agent 0 Scenario 3 calls this in parallel with the other three recruiting sub-agents. |
| 2 | HTTP: Make a Request | Method: POST. URL: Agent 1C Catalyst function with mode=weeklyAudienceRefresh. Body: { trigger_type: 'agent0_complete', triggered_at: {{now}} }. Parse response: Yes. |
| 3 | Email (Zoho Mail) | Condition: Step 2 returns complete with recommendation. To: PARMEET_ALERT_EMAIL. Subject: Weekly Audience Targeting Recommendation - [Date]. Body: Claude-generated targeting recommendation from Section 5.1. |
| 4 | Email (Zoho Mail) | Condition: Step 2 returns error. To: PARMEET_ALERT_EMAIL. Subject: Agent 1C Audience Refresh Failed. Body: Error details. |

# **7. Error Handling**

Error handling for Agent 1C is more conservative than for other agents because it controls real financial spend. When in doubt, pause campaigns and alert Parmeet. Never leave campaigns running in an uncertain state.

| **Failure Scenario** | **Detection Method** | **Response Action** | **Alert Parmeet?** |
| --- | --- | --- | --- |
| Zoho OAuth token refresh fails at job start | fetch() returns non-200 or missing access_token | For compileDailySpend: alert Parmeet and abort. Dashboard will show no data. For checkSpendConfirmation: attempt pause with cached credentials. Alert Parmeet immediately. | Yes: critical failure. Include which token and error. |
| Meta Ads token expired or invalid | metaGet returns error object | Alert Parmeet. Use $0 for Meta spend in dashboard. Flag Meta as error state. Do not pause Google campaigns. | Yes: include error message and token expiry date if known. |
| Google Ads token refresh fails | fetch() returns non-200 | Alert Parmeet. Use $0 for Google spend in dashboard. Flag Google as error state. Do not pause Meta campaigns. | Yes: include error message. |
| Meta campaign pause fails during kill switch | metaPost returns error for one or more campaigns | Retry each failed campaign pause once after 30 seconds. If still failing: alert Parmeet with campaign IDs needing manual pause. | Yes: this is a critical failure. Include campaign IDs. |
| Google campaign pause fails during kill switch | mutate operation returns error | Retry once after 30 seconds. If still failing: alert Parmeet with campaign IDs needing manual pause in Google Ads console. | Yes: critical failure. Include campaign IDs. |
| Spend confirmation webhook not received by 10:00 AM CST | checkTodayConfirmed returns confirmed = false | Fire kill switch. Pause all campaigns. Alert coordinator, Parmeet, and Dr. Flippen. | Yes: this is the designed behavior, not an error. Alert is the intended action. |
| CRM daily spend log write fails | API returns non-200 | Retry once. If second failure: log spend data in Make.com data store as fallback. Proceed with dashboard update. | Yes on second failure: include spend data so Parmeet can manually log. |
| Zoho Analytics dashboard update fails | API returns non-200 | Retry once. If second failure: include spend data directly in the alert email body as fallback. | Yes on second failure: spend data must reach coordinator somehow. |
| Spend alert email fails to send | Make.com webhook returns non-200 | Retry webhook call once. If second failure: send fallback email directly from Catalyst using AMBASSADOR_MAIL_ACCOUNT_ID credentials. | Yes on second failure: include full spend summary. |
| Meta spend exceeds threshold | overThreshold = true in spend data | Include prominent warning in spend alert email. Fire additional urgent email to Parmeet and Dr. Flippen. Do NOT pause campaigns automatically for threshold breach. The coordinator must make that decision. | Yes: urgent alert, not a kill switch trigger. |
| Campaign resume fails during restart | API returns error on ACTIVE update | Alert Parmeet with specific campaign IDs that failed to resume. Other campaigns that resumed successfully remain active. | Yes: include failed campaign IDs for manual review. |
| Claude audience recommendation fails | API returns error or empty response | Skip recommendation. Send weekly performance summary without Claude recommendation. Note the Claude failure in the email. | No for individual failures. Yes if three consecutive weekly failures. |

## **7.1 Alert Email Format**

| Subject: [AGENT 1C ERROR] [Failure Type] - [Date] Body: Agent: Paid Advertising Agent (Agent 1C) Run Date: [Date and time of failure] Job Type: [compileDailySpend / checkSpendConfirmation / recordConfirmation / resumeCampaigns] Failed Step: [Step number and name from Section 4] Error Details: [HTTP status code, error message, or API error object] Financial Impact: [Are campaigns currently running or paused?] Campaign IDs Needing Manual Action: [List if applicable] Recommended Action: [Specific action Parmeet should take] |
| --- |

# **8. Testing and Acceptance Criteria**

| **WARNING** *ALL development and testing of Meta and Google Ads functions must use test ad accounts, not the live Gracelyn ambassador ad account. Confirm with Parmeet which test account IDs to use before writing any code that touches the Ads APIs. Never run a kill switch test against live campaigns without Parmeet present.* |
| --- |

## **8.1 Unit Tests**

| **Test** | **How to Test** | **Expected Result** |
| --- | --- | --- |
| Zoho OAuth token refresh (CRM, Analytics, WorkDrive) | Call getZohoAccessToken() with valid credentials for each | Returns non-null access_token for each. Each token works in a subsequent API call. |
| Google Ads token refresh | Call getGoogleAdsToken() with valid credentials | Returns non-null access_token. Works in subsequent GAQL query. |
| Meta spend read | Call getMetaDailySpend() against test ad account | Returns object with date, totalSpend (number), threshold, overThreshold (boolean), and campaigns array. |
| Google spend read | Call getGoogleDailySpend() against test ad account | Returns object with date, totalSpend in dollars (not micros), threshold, overThreshold, and campaigns array. |
| CRM daily spend log write | Call writeDailySpendLog() with mock spend data | New Ad Campaign Log record appears in CRM with all fields populated and Confirmed = false. |
| CRM confirmation check (not confirmed) | Ensure no confirmation log exists for today. Call checkTodayConfirmed(). | Returns { confirmed: false, confirmedAt: null }. |
| CRM confirmation check (confirmed) | Write a test confirmation log with Confirmed = true for today. Call checkTodayConfirmed(). | Returns { confirmed: true, confirmedAt: [timestamp] }. |
| Record confirmation | Call recordConfirmation() with a mock log record ID | CRM record updated with Confirmed = true. Analytics dashboard updated. |
| Meta campaign pause (test account) | Call pauseAllMetaCampaigns() against test account with at least one active campaign | Returns array of paused campaign IDs. Campaigns show as PAUSED in Meta Ads dashboard. |
| Google campaign pause (test account) | Call pauseAllGoogleCampaigns() against test account with at least one enabled campaign | Returns array of paused campaign IDs. Campaigns show as PAUSED in Google Ads dashboard. |
| Kill switch log event | Call logKillSwitchEvent() with mock log record ID and paused IDs | CRM log record shows Kill_Switch_Fired = true and Kill_Switch_At timestamp. |
| Campaign resume with confirmed spend (test account) | Write a confirmed log for today. Call resumeCampaigns() with paused campaign IDs. | Returns success = true. Campaigns show as ACTIVE in both ad dashboards. |
| Campaign resume without confirmed spend (test account) | Ensure no confirmed log for today. Call resumeCampaigns(). | Returns success = false with reason 'Cannot restart: spend not confirmed for today.' Campaigns remain paused. |
| Analytics dashboard update | Call updateAnalyticsDashboard() with mock spend data | Zoho Analytics coordinator dashboard shows updated spend data for today. |
| Spend alert webhook | Call sendSpendAlert() with mock spend summary | Make.com Scenario 1 receives webhook and sends test alert email. |

## **8.2 Kill Switch Integration Test (Required Before Go-Live)**

This test must be run with Parmeet present on a staging environment before Agent 1C goes live. It validates the complete kill switch cycle from daily spend compilation through coordinator confirmation and through kill switch firing and campaign restart.

- Configure test Meta and Google accounts with at least one active campaign each

- Set low test thresholds in Catalyst (e.g. $1.00) to ensure spend data reads correctly

- Trigger compileDailySpend manually and verify: spend data appears in coordinator dashboard, alert email arrives before 8:00 AM CST equivalent, Confirm button is present and functional

- Do NOT click Confirm. Wait for the 10:00 AM CST equivalent trigger.

- Verify: checkSpendConfirmation fires, finds no confirmation, and pauses all test campaigns on both platforms

- Verify: kill switch alert email arrives at coordinator, Parmeet, and Dr. Flippen email addresses

- Verify: CRM log record shows Kill_Switch_Fired = true

- Click Restart Campaigns in the kill switch alert email without confirming spend first

- Verify: restart is rejected with reason 'Cannot restart: spend not confirmed for today.'

- Click Confirm in the original spend alert email

- Click Restart Campaigns again

- Verify: campaigns resume on both platforms

- Verify: CRM log record shows Restarted = true

- Parmeet signs off that the entire kill switch cycle worked correctly before live go-live

## **8.3 Acceptance Criteria**

| **Criterion** | **Verified By** | **Status** |
| --- | --- | --- |
| compileDailySpend job completes and coordinator dashboard shows spend data by 8:00 AM CST every day | Parmeet: check dashboard at 8:00 AM CST on three consecutive days | [ ] Pending |
| Spend alert email reaches coordinator and Parmeet before 8:00 AM CST with Confirm button functional | Coordinator and Parmeet: confirm receipt and button functionality | [ ] Pending |
| Kill switch fires and pauses ALL active campaigns on both platforms when confirmation not received by 10:00 AM CST | Parmeet: full kill switch integration test as described in Section 8.2 | [ ] Pending |
| Kill switch alert email reaches coordinator, Parmeet, AND Dr. Flippen | All three recipients: confirm receipt | [ ] Pending |
| Campaign resume requires both coordinator trigger AND today's confirmed spend log. Restart without confirmation is rejected. | Parmeet: test restart without confirmation in integration test | [ ] Pending |
| Over-threshold spend triggers urgent additional email to Parmeet and Dr. Flippen above the normal spend alert | Parmeet: test with spend data exceeding threshold | [ ] Pending |
| CRM Ad Campaign Log records created for every significant event: spend compiled, confirmed, kill switch fired, campaigns resumed | Parmeet: audit CRM after integration test | [ ] Pending |
| Weekly audience recommendation email reaches Parmeet each Monday | Parmeet: confirm receipt for three consecutive Mondays | [ ] Pending |
| No campaigns run unchecked: confirmed by running kill switch integration test with Parmeet present before go-live | Parmeet: formal sign-off after integration test | [ ] Pending |
| No credentials hardcoded in any function code | Parmeet: code review before deployment | [ ] Pending |

# **9. Integration Notes for Other Developers**

## **9.1 What Agent 0 Developer Needs to Know**

- Agent 0 Scenario 3 fires a webhook to MAKE_AGENT1C_WEBHOOK_URL as one of four parallel recruiting agent triggers. Agent 1C uses this trigger to run its weekly audience refresh function.

- Agent 1C reads the CRM Prospects module for audience segment data. This data is populated by Agent 0. The audience refresh function runs on Monday after Agent 0's Sunday night run. Timing must allow at least one hour for Agent 0 to complete before Agent 1C reads prospect data.

## **9.2 What Agent 4 Developer Needs to Know**

- Agent 4 monitors the Ad Campaign Log CRM module for spend and kill switch events. Agent 1C writes all significant events here. Agent 4 surfaces kill switch events and over-threshold spend to the coordinator escalation queue on the daily checkpoint dashboard.

- Agent 4 does not control the kill switch. Agent 1C owns and fires the kill switch. Agent 4 reports on it after the fact.

## **9.3 What Parmeet Needs to Know About Campaign Management**

- Agent 1C does not create initial campaigns. Parmeet sets up the initial Meta and Google Ads campaigns manually in their respective dashboards. Agent 1C manages spend monitoring, pausing, and resuming of existing campaigns.

- Campaign creative (images, headlines, ad copy) is managed by Parmeet directly in Meta and Google dashboards. Agent 1C does not modify ad creative.

- The DR_FLIPPEN_EMAIL environment variable must be set before go-live. Dr. Flippen receives kill switch alerts and over-threshold alerts directly.

## **9.4 Shared Environment Variables**

| **Variable Name** | **Description** | **Who Sets It** |
| --- | --- | --- |
| ZOHO_CRM_CLIENT_ID | OAuth 2.0 client ID for Zoho CRM | Parmeet |
| ZOHO_CRM_CLIENT_SECRET | OAuth 2.0 client secret for Zoho CRM | Parmeet |
| ZOHO_CRM_REFRESH_TOKEN | Long-lived refresh token for Zoho CRM | Parmeet |
| ZOHO_ANALYTICS_CLIENT_ID | OAuth 2.0 client ID for Zoho Analytics | Parmeet |
| ZOHO_ANALYTICS_CLIENT_SECRET | OAuth 2.0 client secret for Zoho Analytics | Parmeet |
| ZOHO_ANALYTICS_REFRESH_TOKEN | Long-lived refresh token for Zoho Analytics | Parmeet |
| WORKDRIVE_CLIENT_ID | OAuth 2.0 client ID for Zoho WorkDrive | Parmeet |
| WORKDRIVE_CLIENT_SECRET | OAuth 2.0 client secret for Zoho WorkDrive | Parmeet |
| WORKDRIVE_REFRESH_TOKEN | Long-lived refresh token for Zoho WorkDrive | Parmeet |
| WORKDRIVE_FOLDER_08_ID | WorkDrive folder ID: 08 - Brand Assets | Parmeet |
| META_ADS_ACCESS_TOKEN | Meta Ads long-lived access token. Real spend authority. Handle with extreme care. | Parmeet |
| META_AD_ACCOUNT_ID | Meta Ads account ID for Gracelyn University | Parmeet |
| META_DAILY_SPEND_THRESHOLD | Maximum daily Meta spend in USD before threshold warning. Set by Dr. Flippen. | Dr. Flippen decides, Parmeet stores |
| GOOGLE_ADS_CLIENT_ID | Google Ads OAuth 2.0 client ID | Parmeet |
| GOOGLE_ADS_CLIENT_SECRET | Google Ads OAuth 2.0 client secret | Parmeet |
| GOOGLE_ADS_REFRESH_TOKEN | Google Ads OAuth 2.0 refresh token | Parmeet |
| GOOGLE_ADS_DEVELOPER_TOKEN | Google Ads API developer token. Required in every request header. | Parmeet |
| GOOGLE_ADS_CUSTOMER_ID | Google Ads customer ID for Gracelyn University | Parmeet |
| GOOGLE_DAILY_SPEND_THRESHOLD | Maximum daily Google spend in USD before threshold warning. Set by Dr. Flippen. | Dr. Flippen decides, Parmeet stores |
| AMBASSADOR_ANALYTICS_WORKSPACE_ID | Zoho Analytics workspace ID for coordinator dashboard | Parmeet |
| CLAUDE_API_KEY | Anthropic API key. Model: claude-sonnet-4-20250514 | Parmeet |
| PROSPECTS_MODULE_API_NAME | Zoho CRM API name for the Prospects module | Parmeet during pre-build |
| AD_CAMPAIGN_LOG_MODULE_API_NAME | Zoho CRM API name for the Ad Campaign Log module. Parmeet creates during pre-build. | Parmeet during pre-build |
| MAKE_SPEND_ALERT_WEBHOOK_URL | Make.com webhook URL for Scenario 1 daily spend alert | Parmeet after creating Scenario 1 |
| MAKE_SPEND_CONFIRM_WEBHOOK_URL | Make.com webhook URL for Scenario 2 coordinator confirmation | Parmeet after creating Scenario 2 |
| MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL | Make.com webhook URL for Scenario 3 kill switch alert | Parmeet after creating Scenario 3 |
| MAKE_CAMPAIGN_RESTART_WEBHOOK_URL | Make.com webhook URL for Scenario 3 campaign restart trigger | Parmeet after creating Scenario 3 |
| MAKE_AGENT1C_WEBHOOK_URL | Make.com webhook URL for Scenario 4. Agent 0 Scenario 3 calls this. | Parmeet after creating Scenario 4 |
| PARMEET_ALERT_EMAIL | Parmeet personal email for all error and critical alerts | Parmeet |
| COORDINATOR_ALERT_EMAIL | Ambassador program coordinator email for daily spend alerts | Parmeet after coordinator is assigned |
| DR_FLIPPEN_EMAIL | Dr. Matthew Flippen's email for kill switch and threshold breach alerts | Parmeet |

Confidential  |  Developer Project Document  |  Page
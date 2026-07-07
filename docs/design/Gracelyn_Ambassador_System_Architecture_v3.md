**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program**

**AI Agent System Architecture**

*Version 3.0 — May 2026*

Master reference document for Parmeet and all developers.

Supersedes Architecture v1.0 and v2.0.

# **1. Executive Summary**

The Gracelyn University Ambassador Program is an AI-powered referral and community-building system designed to scale to 100,000 active ambassadors. Ambassadors are mission-driven educators, childcare workers, faith community leaders, youth-serving professionals, and influencers who introduce prospective students to Gracelyn University. They receive referral fees when the students they refer succeed.

The system consists of eleven agents across nine workstreams. Agent 0 provides intelligence for all other agents. Agents 1A through 1D recruit ambassadors across email, social, paid advertising, and lead capture channels. Agent 2 onboards approved ambassadors through a combined compliance form with Phase 2 auto-approve capability. Agent 3 maintains weekly engagement with every active ambassador through personalized content, three engagement tracks, and a dynamic VIP tier system. Agent 4 monitors all agents, tracks support SLA performance, and audits VIP tier calculations. Agent 5 provides portal chat support with escalation routing. Agent 5A validates all credentials before build begins. Agent 6 processes story content submissions for Agent 3's engagement emails.

The program supports international ambassadors from launch, with payment through PayPal, Wise, Tremendous, or ACH depending on the ambassador's country of residence. All content generation enforces Gracelyn's voice: mission before fee, no em dashes, never commission, always referral fee.

| **NOTE** Version 3.0 reflects all design decisions from the Scaling Ambassadors 2 session: VIP Prospect Pipeline, non-educator lead magnet tracks, combined compliance form with win-back sequence, Phase 2 auto-approve, story selection by role category, three engagement tracks, dynamic VIP tier system, support SLA tracking, and international payment support. |
| --- |

# **2. Agent and Sub-Agent Overview**

| **Agent** | **Name** | **Purpose** |
| --- | --- | --- |
| 0 | Research and Intelligence | Profiles prospects from public data and social listening. Scores every prospect for VIP Prospect threshold across three dimensions: audience reach, organizational influence, and mission alignment. Generates briefing documents for high-value influencer and advocate prospects and routes them to the VIP Prospect Pipeline for human cultivation. Routes standard prospects to recruiting agents with motivation and role category tags. Builds motivation hypotheses for non-email audiences. Reports enrichment gaps weekly. |
| 1A | Database and Email Agent | Manages outbound email sequences to the 300,000-person paraprofessional database, the 83,000-person educator database, current students, and alumni. Segments by role category and sends motivation-matched sequences. Tracks opens, clicks, and applications. Triggers follow-up if no application within 7 days. |
| 1B | Social Outreach Agent | Posts prescribed organic content to LinkedIn, Facebook, and Instagram via Ayrshare. Monitors educator and mission-aligned communities for prospecting signals. Supports the VIP Prospect Pipeline by surfacing warm engagement signals to the human relationship manager as CRM tasks. Never automates outreach to VIP-flagged accounts. |
| 1C | Paid Advertising Agent | Manages Meta and Google ad campaigns targeting educator demographics, paraprofessional audiences, faith-based educator communities, and mission-aligned segments. Daily spend report to coordinator by 8:00 AM CST. Hard kill switch: campaigns auto-pause at 10:00 AM CST if coordinator has not confirmed. |
| 1D | Lead Capture Agent | Processes form submissions from four audience-track lead capture landing pages (K12 Educator, Early Childhood, Faith Community, Youth Serving Professional). Delivers audience-appropriate lead magnet resource. Creates Prospect CRM record tagged with Audience_Track. Hands off to Agent 1A for email sequence initiation. |
| 2 | Onboarding Agent | Routes approved ambassadors to Standard or VIP track. Delivers combined three-part compliance form with three signature blocks. Manages compliance reminder sequence (Day 2, 7, 14) and win-back sequence (Day 15 survey with four routing paths). Activates ambassadors on compliance completion. Manages Phase 2 auto-approve with five-criteria check and 1,000-ambassador threshold. |
| 3 | Engagement Agent | Maintains weekly contact with every active ambassador through a four-week rotating content calendar. Selects Week 2 success stories by ambassador role category before falling back to any available story. Routes ambassadors to Standard, Alternative, or Dormant engagement tracks based on referral activity. Detects referral milestones and celebrates them. Manages dynamic VIP tier system with quarterly recalculation and population-based percentage thresholds. |
| 4 | Compliance Oversight Layer | Monitors all agents. Reads blueprint fraud prevention and eligibility outputs. Tracks support ticket SLA performance with breach detection and alerting. Audits quarterly VIP tier recalculation results. Generates daily coordinator checkpoint and weekly report covering referral fees, SLA performance, ambassador health, and VIP program status. |
| 5 | Ambassador Support Agent | Provides portal chat support via OpenAI knowledge base. Verifies ambassador identity before responding. Classifies tier (1-3 or VIP Priority). Creates Support Ticket CRM record with all nine SLA timestamp fields. Fires ten-field escalation webhook for Tier 2+ tickets enabling future team routing without code changes. |
| 5A | Setup Validation Agent | Pre-build go/no-go gate. Audits all environment variables and credentials before any developer writes production code. Run by Parmeet. Blocks build start if any required variable is missing or invalid. |
| 6 | Story Content Intake Agent | Processes batch story submissions from Zoho Forms intake form. Writes ROLE_CATEGORY metadata header to each story file. Generates correctly formatted filename. Saves to WorkDrive Folder 05. Monitors story buffer by role category. Alerts Parmeet when buffer falls below minimum. |

*Agent handoff flow: Agent 5A validates credentials as the first build gate. Agent 6 feeds WorkDrive Folder 05 with role-category-tagged story content. Agent 0 profiles prospects, scores VIP Prospects, generates briefings for human cultivation, and routes standard prospects to recruiting agents. Agents 1A through 1D generate applications across four channels. Agent 2 routes each application to Standard or VIP onboarding. Agent 3 runs the weekly engagement cycle across three tracks with VIP supplemental touchpoints. Agent 4 monitors all agents, tracks SLA, and audits VIP tier calculations. Agent 5 handles ambassador support and fires structured escalation webhooks to Agent 4.*

## **2.1 Agent Handoff Table**

| **From** | **To** | **Trigger and Payload** |
| --- | --- | --- |
| Agent 0 | VIP Prospect Pipeline (human) | VIP Prospect score >= 60. Briefing document saved to Folder 09. CRM task created for VIP Relationship Manager. Automated recruiting suppressed for this prospect. |
| Agent 0 | Agents 1A, 1B, 1C, 1D | Weekly run complete. Prospect records with Role_Category, Motivation_Tag, and Channel_Source written to CRM. Recruiting trigger webhook fires. |
| Agent 1D | Agent 1A | New Prospect record created with Audience_Track field. Handoff webhook includes: email, first_name, role_category, audience_track, lead_magnet_id. |
| Agents 1A-1D | Agent 2 | Application submitted. Ambassador CRM record created. Make.com triggers Agent 2 Function A. |
| Agent 2 | Agent 3 | Ambassador activated. Webhook payload: ambassador_id, email, first_name, role_category, audience_track, motivation_tag, vip_flag, vip_prospect_origin. |
| Agent 3 | Agent 4 | VIP recalculation complete webhook fires. Agent 4 runs tier count audit. |
| Agent 3 | VIP Relationship Manager | Monthly High VIP personal outreach list delivered as CRM tasks. Standard VIP ambassadors receive automated check-in only. |
| Agent 5 | Agent 4 | Support Ticket created in CRM with nine SLA fields. Escalation webhook fires with ten-field payload for Tier 2+ tickets. |
| Agent 6 | Agent 3 | Story file saved to Folder 05 with ROLE_CATEGORY header. Agent 3 reads at next Monday 9:00 AM CST cycle. |

# **3. Technology Stack**

| **Layer** | **Tool** | **Role in System** |
| --- | --- | --- |
| CRM and Automation | Zoho CRM | System of record. Ambassadors, Prospects, Referrals, Support Tickets, Activity Log modules. |
| CRM and Automation | Zoho Flow | Native Zoho automation for form submission processing, status triggers, and Agent 6 story intake. |
| CRM and Automation | Zoho Mail | All ambassador-facing email from ambassadors@gracelyn.edu. |
| CRM and Automation | Zoho Forms | Ambassador application, combined compliance form, win-back survey, story intake form, four lead capture forms. |
| CRM and Automation | Zoho Analytics | Coordinator dashboard. Daily checkpoint. SLA metrics. Weekly reports. |
| CRM and Automation | Zoho Books | Referral fee and recruiting referral fee payment processing. Dual-payee expense records. |
| Serverless Compute | Zoho Catalyst | All agent Catalyst functions. Scheduled jobs. Environment variable storage. |
| Orchestration | Make.com | Inter-agent webhooks. Escalation routing. Payment routing. Alert delivery. HeyGen polling. |
| AI | Claude API (Anthropic) | Email generation, prospect assessment, motivation classification, VIP briefings, story selection, caption generation. |
| AI | OpenAI Assistants API | Ambassador support chat knowledge base. Portal chat integration. |
| Social Posting | Ayrshare | Agent 1B organic social posting to LinkedIn, Facebook, Instagram. |
| Social Monitoring | Zoho Social | Agent 1B read-only community monitoring and engagement tracking. |
| Video | HeyGen | VIP welcome videos (Agent 2). Milestone recognition videos (Agent 3). |
| Content Storage | Zoho WorkDrive | Nine folders. Story files, lead magnets, brand assets, welcome kits, VIP briefings. |
| Ambassador Portal | WordPress | Ambassador portal with referral dashboard, portal chat widget, compliance form access. |
| Payment — US | ACH via Zoho Books | US ambassadors with bank accounts. 1-3 business day settlement. |
| Payment — Global | PayPal | Available worldwide where PayPal operates. Fastest setup. |
| Payment — International | Wise Business | International ambassadors in 80+ Wise-supported countries. Local currency delivery. |
| Payment — Universal Fallback | Tremendous | Virtual prepaid card. Available to all ambassadors worldwide. Instant delivery by email. |
| Ads | Meta Ads Manager | Agent 1C paid campaigns targeting educator and mission-aligned audiences. |
| Ads | Google Ads | Agent 1C paid campaigns. Search and display. |

# **4. Data Architecture**

## **4.1 CRM Modules**

Zoho CRM is the system of record. Six modules are required. All are documented in detail in the Parmeet Pre-Build Checklist v2.0.

| **Module** | **Key Fields** | **Primary Agents** |
| --- | --- | --- |
| Ambassadors | Status, Compliance_Complete, VIP_Flag, VIP_Tier, VIP_Prospect_Origin, Motivation_Tag, Ambassador_Role_Category, Audience_Track, Engagement_Track, Content_Week_Position, Days_Since_Last_Referral, Country_of_Residence, Payment_Method_Preference, payment detail fields, auto-approve audit fields, win-back fields | Agents 2, 3, 4, 5 |
| Prospects | Email, Social_Profile_URL, Role_Category, Audience_Track, VIP_Prospect, VIP_Prospect_Score, VIP_Prospect_Pipeline_Stage, Motivation_Tag, Lead_Magnets_Downloaded, Outreach_Status, Gap_Type | Agents 0, 1A, 1B, 1C, 1D |
| Referrals | Referral_Stage, Referral_Fee_Status, Recruiting_Fee_Status, Program_Level, Ineligible flags (self-referral, household, duplicate) | Agents 3, 4 |
| Support Tickets | Ticket_Tier, Issue_Category, Ambassador_VIP_Status, Resolution_Complexity, Escalation_Timestamp, First_Response_Timestamp, Resolution_Timestamp, SLA_Breached, Resolution_SLA_Breached | Agents 4, 5 |
| Ambassador Activity Log | Action_Type, Email_Theme, Sent_At, Opened_At, Re_Engagement_Attempt, Escalated_To_Human | Agent 3, Agent 4 reads |
| Ad Campaign Log | Platform, Daily_Spend, Kill_Switch_Fired, Coordinator_Confirmed | Agent 1C writes, Agent 4 reads |

## **4.2 WorkDrive Folder Structure**

| **Folder** | **Name** | **Contents and Agent Access** |
| --- | --- | --- |
| 01 | Applications | Application archive. Agent 2 reads. |
| 02 | Approved Social Content | Prescribed posts for Agent 1B. _POSTED suffix after use. |
| 03 | Ambassador Welcome Kits | Standard and VIP welcome kits. Agent 2 reads, generates 30-day share links. |
| 05 | Story Files | Student success stories with ROLE_CATEGORY header. Agent 6 writes. Agent 3 reads by role category then date. |
| 06 | Lead Magnets | Four subfolders: k12-educator, early-childhood, faith-community, youth-serving. Agent 1D reads, generates share links. |
| 07 | Analytics and Reports | Agent 0 gap reports. Agent 4 checkpoint files. |
| 08 | Brand Assets | Voice guidelines, copy rules, program descriptions, update_brief.txt. All agents read. |
| 09 | VIP Prospect Briefings | Agent 0 writes one briefing per VIP Prospect. Agent 1B reads (read only). VIP Relationship Manager receives link. |

# **5. Recruiting System**

## **5.1 Channel Architecture**

| **Agent** | **Channel** | **Primary Reach** | **Key Tools** |
| --- | --- | --- | --- |
| 1A: Email | Zoho Mail sequences | 300k paraprofessional database, 83k educator database, current students, alumni, all Agent 1D lead captures | Zoho CRM, Zoho Mail, Zoho Flow, Claude API |
| 1B: Social | LinkedIn, Facebook, Instagram, educator communities | K12 educators, faith-based educators, homeschool leaders — plus VIP Prospect Pipeline warm-follow intelligence for influencers | Ayrshare, Zoho Social, Claude API |
| 1C: Paid Ads | Meta Ads, Google Ads | Teacher demographics, paraprofessional audiences, faith-based educator communities, mission-aligned segments | Meta Business, Google Ads, Make.com, kill switch |
| 1D: Lead Capture | Landing pages, gated resources by audience track | K12 educators (PD guides), Early Childhood (childcare tools), Faith Community (ministry resources), Youth Serving Professionals (program tools) | Zoho Forms (4 audience-track forms), Zoho CRM, Claude API |

## **5.2 Target Populations**

| **Category** | **Included Populations** | **Primary Motivation Frame** |
| --- | --- | --- |
| K-12 Education Professionals | Classroom teachers, instructional coaches, curriculum specialists, literacy coaches, school counselors, school psychologists, special education staff, paraprofessionals, school librarians, school nurses, speech-language pathologists | Professional identity and growth. Credentials and PD with career value. |
| Early Childhood and Childcare | Childcare workers, daycare directors, Head Start staff, early childhood educators, pre-K teachers | Recognition and belonging. Mission frame: your work matters for vulnerable children. |
| Faith and Community | Youth pastors, children's ministry directors, Sunday school teachers, Christian school teachers, homeschool co-op leaders, church education directors, mission organization volunteers | Kingdom impact and calling. What God is doing through teachers who love children. |
| Youth-Serving Professionals | Boys and Girls Club staff, YMCA youth coordinators, after-school program staff, tutors, foster care advocates, child welfare workers, family service coordinators | The problem being solved. Mission frame only. |
| Mission-Aligned Influencers | Education content creators, homeschool influencers, Christian parenting bloggers, foster care advocates, literacy advocates — VIP Prospect Pipeline only, never automated outreach | Audience trust and alignment. They promote only what their audience would thank them for. |
| Gracelyn Community | Current students, alumni, program completers | Pride and gratitude. Paying it forward. |
| Excluded | Principals, assistant principals, superintendents, district administrators, department heads | Conflict of interest risk. |

## **5.3 VIP Prospect Pipeline**

High-value influencers and advocates who meet the VIP Prospect threshold are removed from automated recruiting and enter a human-managed cultivation pipeline. This is the mechanism that converts influencers with large mission-aligned audiences into ambassadors without the relationship damage of automated outreach.

| **Pipeline Stage** | **Description** |
| --- | --- |
| Agent 0 Identification | Agent 0 scores every prospect on three dimensions: audience reach (0-40), organizational influence (0-30), mission alignment (0-30). Prospects scoring 60 or above are flagged VIP_Prospect = true. Automated recruiting outreach is suppressed. Agent 0 generates a one-page briefing document and delivers it to the VIP Relationship Manager. |
| Stage 1: Warm Follow | 2-3 weeks. Human coordinator follows prospect on all active platforms. Engages genuinely with their content. Agent 1B monitors for mission-keyword content from Stage 1 accounts and surfaces warm engagement signals as CRM tasks — one alert per prospect per week maximum. |
| Stage 2: Personal Outreach | 1 week. Human coordinator sends a personal message referencing specific recent content. Mission alignment framing. No ambassador ask in this message. |
| Stage 3: Ambassador Invitation | 1 week. If Stage 2 receives positive response, invitation extended. Framed as mission partnership, not referral program. Personal call offered. |
| Stage 4: VIP Onboarding | Prospect accepts. Ambassador record created by Agent 2 with VIP_Prospect_Origin = true. Personal call instead of automated compliance reminders. White-glove welcome kit. |
| Stage 5: No Response or Decline | No automated follow-up. Declined records suppressed for 12 months. Coordinator logs decline reason if shared. |

## **5.4 Recruiting Message Architecture**

Every recruiting touchpoint across all four sub-agents follows the same three-layer message structure:

- **Layer 1: Mission hook. **Every vulnerable child deserves an incredible teacher. Gracelyn exists to make that possible. This is why you are being invited.

- **Layer 2: Social proof. **Here is what it looks like for an educator who is already doing this. A story of impact, transformation, or purpose matched to the motivation frame validated for this audience.

- **Layer 3: Simple ask. **Become an ambassador. Share your referral link. Earn a referral fee when someone you refer succeeds.

# **6. Onboarding System**

| **Onboarding Element** | **Standard Track** |
| --- | --- |
| Approval | Phase 1: Manual coordinator review. Phase 2: Five-criteria auto-approve activates when active ambassador count reaches 1,000 (APPROVAL_MODE flipped by Parmeet). VIP_Prospect_Origin ambassadors always route to human review regardless of approval mode. |
| Compliance form | Single combined Zoho Form: Part 1 Ambassador Agreement + Part 2 Code of Ethics + Part 3 Training Guide Acknowledgment. Three separate e-signature capture areas. Motivation discovery questions embedded before Part 3 signature. One submission. |
| Compliance reminders | Automated: Day 2, Day 7, Day 14. If no completion by Day 15: win-back email with one-tap survey (four options: Too Busy, Confused, Not Sure, Technical Problem). Each response routes to a different support path. Day 75 dormant compliance with monthly contact only. |
| Welcome kit | Standard welcome kit from WorkDrive Folder 03: approved social content, mission story assets, program descriptions, referral link confirmation. |
| Activation | Email D with referral link and recruiting link. WordPress role upgraded to ambassador_active. Agent 3 notified with full activation payload. |

| **APPROVAL_MODE** APPROVAL_MODE starts as MANUAL. Parmeet flips it to AUTO when active ambassadors reach 1,000. Agent 2 never flips this variable automatically. The developer must brief Parmeet on exactly what the flip does before handoff. VIP_Prospect_Origin ambassadors always route to human review regardless of APPROVAL_MODE. |
| --- |

# **7. Engagement System**

## **7.1 Engagement Tracks**

| **Track** | **Entry Criteria** | **Cadence and Content** |
| --- | --- | --- |
| Standard | All ambassadors at activation. Ambassadors who submit a referral while in Alternative track return to Standard. | Weekly email following four-week content calendar (Mission Moment, Success Story, Ambassador Spotlight, Program Update). Full personalization by motivation tag. Referral asks included. |
| Alternative | Active more than 90 days with zero referrals. Detected by monthly non-referral check. | Bi-weekly email. Three content types rotating monthly: (1) Story submission invitation, (2) Experience sharing invitation, (3) One-tap referral ask — one person, one message, no pressure. No standard referral ask content. |
| Dormant | No email open or click activity for 30+ consecutive days and no referral activity. | Day 30: re-engagement attempt 1. Day 45: re-engagement attempt 2 (different framing). Day 60: escalated to coordinator for human outreach decision. No automated contact after Day 60 until coordinator re-activates. |

## **7.2 Four-Week Content Calendar**

| **Week** | **Theme** | **Content Description** |
| --- | --- | --- |
| Week 1 | Mission Moment | Brief reflection on the Gracelyn mission. Personalized to motivation tag. Mission Impact ambassadors receive student-centered framing. Professional Growth ambassadors receive educator development framing. Kingdom Calling ambassadors receive faith and calling framing. |
| Week 2 | Success Story | Student success story from WorkDrive Folder 05 buffer. Selected by ambassador Role_Category first, then most recent date. K12 ambassadors receive K12-tagged stories. Faith Community ambassadors receive faith-tagged stories. Falls back to Any-tagged stories if no category match available. |
| Week 3 | Ambassador Spotlight | Recognition of an active ambassador with highest referral activity in past 30 days. Celebrates the community. Soft referral encouragement. |
| Week 4 | Program Update | Program news and forward-looking message from Parmeet's update_brief.txt in Folder 08. Claude generates mission message if brief not found. |

## **7.3 Story Selection by Role Category**

Week 2 success stories are selected by matching the ambassador's Role_Category field to the ROLE_CATEGORY header line in story files stored in WorkDrive Folder 05. Agent 6 writes this header at story submission. Agent 3 filters by role category before selecting by date. This prevents large numbers of ambassadors from receiving emails referencing the same story on the same day.

- Step 1: Filter Folder 05 story files by ambassador Role_Category header match.

- Step 2: Select most recent file matching the category.

- Step 3: If no category match, fall back to Any-tagged files.

- Step 4: If no Any-tagged files, fall back to most recent file regardless of category.

- Step 5: If Folder 05 is empty, use Claude-generated placeholder and alert Parmeet.

## **7.4 Dynamic VIP Tier System**

VIP tiers are recalculated quarterly on the first Monday of the month. Tier percentages shift automatically based on active ambassador population size.

| **Tier** | **Population Threshold** | **Treatment** |
| --- | --- | --- |
| High VIP | Top 2.5% when active ambassadors under 10,000. Top 0.5% when 10,000 or above. | Automated monthly check-in email AND appears on personal outreach list delivered to VIP Relationship Manager as CRM tasks. Tier upgrade triggers personal welcome message from relationship manager. |
| Standard VIP | Top 5% (under 10k) or top 2.5% (10k+) not already in High VIP. | Automated monthly check-in email only. Does not appear on personal outreach list. Protects relationship manager capacity at scale. |
| Not VIP | All other active ambassadors. | Standard weekly engagement cycle only. |

| **NOTE** The shift from large-population to small-population bands happens at the next quarterly recalculation after the active count crosses 10,000. This prevents a jarring mid-quarter tier change for hundreds of ambassadors simultaneously. |
| --- |

# **8. Referral Fee Structure and Payment**

## **8.1 Fee Structure**

| **Fee Type** | **Amount** | **Eligibility** |
| --- | --- | --- |
| Student referral fee — Undergraduate | $100 | Referred student completes 4 consecutive months of active enrollment. |
| Student referral fee — Graduate | $200 | Referred student completes 4 consecutive months of active enrollment. |
| Recruiting referral fee — Undergraduate | $50 | Ambassador directly recruited by this ambassador refers a student who completes 4 months. |
| Recruiting referral fee — Graduate | $100 | Ambassador directly recruited by this ambassador refers a student who completes 4 months. |

Both student referral fees and recruiting referral fees are triggered by the same event: the referred student completing 4 consecutive months of active enrollment. There is no separate eligibility clock for recruiting fees. Both are processed in the same Zoho Books payment cycle with separate expense records.

## **8.2 Payment Methods**

| **Method** | **Availability** | **Notes** |
| --- | --- | --- |
| PayPal | All ambassadors worldwide | Fastest setup. Most widely available. Varying functionality by region. |
| ACH | United States only | Requires US bank account. 1-3 business day settlement via Zoho Books. |
| Wise | 80+ Wise-supported countries | Local currency delivery to local bank account. Recommended for international ambassadors in supported countries. |
| Tremendous | Universal fallback — all countries | Virtual prepaid card delivered by email. Works anywhere Visa or Mastercard accepted. Instant delivery. No bank account required. |

Payment method availability is determined by the ambassador's Country_of_Residence field collected at application. The onboarding form shows only methods available for the ambassador's country. ACH is US-only. Wise covers 80+ countries. Tremendous is the universal fallback for any country not covered by PayPal or Wise.

# **9. Compliance and Oversight**

## **9.1 Content and Conduct Rules**

| **Rule** | **Implementation** |
| --- | --- |
| No commission language | Every Claude API prompt includes the instruction: never say commission, always say referral fee. Agent 4 performs a secondary compliance audit on sampled email content weekly. |
| Mission before fee | Three-layer message structure enforced across all recruiting channels: mission hook first, social proof second, referral ask third. |
| No admissions advice | Ambassadors directed to Gracelyn representatives for any admissions question. Agent 5 knowledge base explicitly deflects admissions questions. |
| Fraud prevention | Self-referral detection, household match detection, duplicate referral detection, and duplicate application flag — all built into existing blueprint CRM workflows. Agent 4 reads outputs and escalates. |
| Self-recruiting prohibited | Agent 2 checks Recruited_By_Ambassador_ID against applicant email at auto-approve. VIP_Prospect_Origin ambassadors always bypass auto-approve for human review. |
| VIP suppression rule | Agents 1B and 1C must never send automated outreach to any prospect with VIP_Prospect = true in CRM. VIP Prospect Pipeline is human-managed from identification forward. |
| HeyGen script approval | All HeyGen video scripts (VIP welcome and milestone recognition) require Dr. Flippen approval before submission. Two-webhook pattern: script review, then approval, then submission. |

## **9.2 Daily Human Checkpoint**

The coordinator reviews a daily checkpoint delivered by Agent 4 at 7:00 AM CST covering: ad spend alerts, fraud flag escalations, application approvals, referral fee queue, dormant ambassador escalations, support SLA breach alerts, and system health summary. The coordinator has a kill switch on all ad spend and can pause any agent from the Zoho Analytics dashboard.

## **9.3 Support SLA**

Agent 4 tracks SLA performance for all support ticket escalations. Tier 2 first response: 24 hours. Tier 3 and VIP first response: 4 hours. Breach alerts fire immediately to the coordinator. Tier 3 and VIP breaches also alert Parmeet directly.

# **10. Human Roles**

| **Role** | **Time Commitment** | **Responsibilities** |
| --- | --- | --- |
| Parmeet (Coordinator) | Full-time | Daily checkpoint review. Phase 1 application approvals. Payment queue confirmation. Escalation queue resolution. Content submission via story intake form. |
| Ambassador Support Coordinator | Dedicated, not shared | All Agent 5 Tier 2+ escalation resolution. 24-hour SLA. Tier 3 and VIP 4-hour SLA. |
| VIP Relationship Manager | Dedicated, senior | VIP Prospect Pipeline cultivation. Monthly High VIP personal outreach. VIP ambassador onboarding calls. |
| Dr. Flippen | 2-3 hours per week | HeyGen video script approval. Content review at launch. Personal contact with highest-performing ambassadors. |
| International Payment Handler | As needed, Parmeet initially | Review and resolve Wise and Tremendous payment failures. Contact ambassadors with failed international payments. |

# **11. Build Cost Estimate**

| **Role** | **Estimated Hours** | **Notes** |
| --- | --- | --- |
| Parmeet (Architect and Project Lead) | 50-70 hrs | Pre-build setup, integration sprint, knowledge base, story content, content calendar |
| Developer 0: Research and Intelligence | 40-60 hrs | Web research, social listening, VIP Prospect scoring, briefing generation, gap reporting |
| Developer 1A: Database and Email | 30-50 hrs | Email sequences, CRM segmentation, audience track routing, follow-up cadence |
| Developer 1B: Social Outreach | 30-50 hrs | Ayrshare posting, Zoho Social monitoring, VIP warm-follow alert, Folder 09 integration |
| Developer 1C: Paid Advertising | 30-50 hrs | Meta and Google API, daily spend alert, kill switch, coordinator dashboard feed |
| Developer 1D: Lead Capture | 25-40 hrs | Four audience-track forms, lead magnet delivery, Audience_Track routing, CRM write |
| Developer 2: Onboarding | 40-60 hrs | Combined compliance form, win-back sequence, Phase 2 auto-approve, VIP track, HeyGen trigger |
| Developer 3: Engagement | 40-60 hrs | Weekly cycle with batch concurrency, story selection by role category, three engagement tracks, dynamic VIP tier system |
| Developer 4: Compliance Oversight | 30-50 hrs | SLA tracking, VIP recalculation audit, eligibility queue, daily checkpoint, weekly report |
| Developer 5: Ambassador Support | 30-50 hrs | OpenAI knowledge base, portal chat, ten-field escalation webhook, nine SLA CRM fields |
| Developer 5A: Setup Validation | 8-12 hrs | Environment variable audit, credential check, go/no-go gate |
| Developer 6: Story Content Intake | 15-25 hrs | Zoho Forms intake form, Zoho Flow processing, ROLE_CATEGORY header, Folder 05 buffer monitoring |

*At $30/hr average rate: approximately $11,000-19,000 USD. At $50/hr: approximately $18,000-32,000 USD. Platform costs above existing Zoho One subscription: approximately $90-120/month plus ad spend, plus Wise and Tremendous transaction fees (pay per payment, no monthly fee). Wise and Tremendous accounts are free to open.*

# **12. Document Reference**

| **Document** | **Version** | **Status** | **Purpose** |
| --- | --- | --- | --- |
| Ambassador Program AI Agent System Architecture (this document) | v3.0 | Current | Master system design reference |
| Parmeet Pre-Build Checklist | v2.0 | Current | All setup tasks before build starts. Includes all new fields, forms, tools, and policy decisions. |
| Ambassador Agreement (combined compliance form) | v2.0 | Current | Three-part combined document with three signature blocks. International tax addendum included. |
| Payment Policy | v2.0 | Current | Four payment methods, international routing logic, Zoho Books dual-payment workflow. |
| Agent 0: Research and Intelligence | v2.0 | Current | VIP Prospect Pipeline scoring, briefing generation, warm-follow alert. |
| Agent 1A: Database and Email | v1.0 | Unchanged | No modifications required. |
| Agent 1B: Social Outreach | v2.0 | Current | VIP Prospect Pipeline support, warm-follow CRM task alerts, Folder 09 integration. |
| Agent 1C: Paid Advertising | v1.0 | Unchanged | No modifications required. |
| Agent 1D: Lead Capture | v2.0 | Current | Four audience-track lead magnet forms, Audience_Track field routing. |
| Agent 2: Onboarding | v2.0 | Current | Combined compliance form, win-back sequence, Phase 2 auto-approve at 1,000 ambassadors. |
| Agent 3: Engagement | v2.0 | Current | Story selection by role category, three engagement tracks, dynamic VIP tier system. |
| Agent 4: Compliance Oversight | v2.0 | Current | SLA tracking, VIP recalculation audit, extended weekly report. |
| Agent 5: Ambassador Support | v2.0 | Current | Ten-field escalation webhook payload, nine SLA CRM fields, international payment knowledge base. |
| Agent 5A: Setup Validation | v1.0 | Unchanged | No modifications required. |
| Agent 6: Story Content Intake | v2.0 | Current | ROLE_CATEGORY field on intake form and file header for Agent 3 story selection by role category. |

| **NOTE** All documents are current as of Version 3.0. Agents 1A, 1C, and 5A are unchanged from their original versions. All other documents have been updated to v2.0 to reflect the changes documented in this architecture revision. |
| --- |
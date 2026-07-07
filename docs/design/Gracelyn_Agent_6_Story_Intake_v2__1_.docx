**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program AI Agent System**

Agent 6 of 9

**Story Content Intake Agent**

*Batch story submission, role-category tagging, automatic file naming,*

*WorkDrive Folder 05 delivery, and buffer monitoring*

Version 2.0

Gracelyn University — Confidential

# **1. Credentials and Tool Access**

Parmeet provides all credentials before development begins. Store Catalyst environment variables for the buffer monitoring function. Zoho Flow uses native Zoho One connections — no external OAuth required within the Flow.

| **HARD STOP** Do not begin development until: (1) Parmeet has built the story intake form in Zoho Forms with all fields including the Role Category dropdown; (2) WorkDrive Folder 05 exists and is accessible; (3) the Agent 3 developer has confirmed the exact file header format and ROLE_CATEGORY field name they expect. Agent 6 and Agent 3 are tightly coupled. A mismatch in file format breaks Agent 3 story selection. |
| --- |

| **Tool** | **Credential Required** | **Notes** | **From** |
| --- | --- | --- | --- |
| Zoho Forms | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoForms.form.CREATE, ZohoForms.form.READ, ZohoForms.submissions.READ | Parmeet builds the intake form. Developer confirms field names match this spec and verifies the form ID before building the Flow. | Parmeet |
| Zoho Flow | Zoho One account access. No separate OAuth credential. | The core of Agent 6 is a Zoho Flow. Zoho Flow connects to WorkDrive natively within Zoho One. No external OAuth required for the Flow itself. | Parmeet |
| Zoho WorkDrive | OAuth 2.0 client ID, client secret, refresh token. Scopes: WorkDrive.files.CREATE, WorkDrive.files.READ | Write access to Folder 05 to save story files. Read access to Folder 05 for buffer count in the Catalyst monitoring job. | Parmeet |
| Zoho Mail | OAuth 2.0 client ID, client secret, refresh token. Scopes: ZohoMail.messages.CREATE | Buffer alert emails only. Send from ambassadors@gracelyn.edu when Folder 05 story count falls below minimum. | Parmeet |
| Zoho Catalyst | CLI credentials and project access | One Catalyst function: the daily buffer monitoring job. The Flow handles story processing natively without Catalyst. | Parmeet |
| Make.com | Developer invite to Gracelyn workspace | One Make.com scenario: buffer alert routing. | Parmeet |

# **2. Agent Overview**

## **2.1 Purpose**

Agent 6 removes all manual file management burden from Parmeet when providing story content for Agent 3's weekly engagement emails. Parmeet or any authorized content contributor submits stories through a Zoho Forms intake form. A Zoho Flow processes each story in the batch, calculates the correct target publish date, tags the file with the submitter's selected role category, generates the correctly formatted filename, and saves the story as a plain text file to WorkDrive Folder 05. Agent 3 reads these files on Monday mornings, filtering by role category before selecting by date.

Version 2.0 introduces the role category field to the intake form and the ROLE_CATEGORY header line to the file format. This is the critical addition that enables Agent 3's story selection by role category — the mechanism that prevents tens of thousands of ambassadors from receiving emails referencing the same story on the same day at scale. Parmeet does nothing differently except select a role category when submitting each story.

| **RULE** Agent 6 exists entirely to serve Agent 3. The file header format and the ROLE_CATEGORY field name must match exactly what Agent 3's getMostRecentStoryByCategory() function expects. Confirm with the Agent 3 developer before building the Flow. A format mismatch produces silent failures — Agent 3 falls back to Any-tagged stories without alerting anyone that role-specific selection failed. |
| --- |

## **2.2 Position in the System**

| **Relationship** | **Agent / Source** | **Detail** |
| --- | --- | --- |
| TRIGGERED BY | Zoho Forms story intake submission | Parmeet or authorized content contributor submits the intake form. Zoho Flow fires on each new submission. Form accepts up to five stories per batch. |
| WRITES TO | WorkDrive Folder 05 | Each story in the submission becomes one plain text file with the correct Story_YYYY-MM-DD_[title].txt filename. Date calculated from the target week field. Role_Category written to file header. |
| FEEDS INTO | Agent 3 (Engagement) | Agent 3's getMostRecentStoryByCategory() reads files from Folder 05 on each Monday morning. It filters by Role_Category in the file header before selecting by date. Agent 6 files feed directly into Week 2 email content. |
| MONITORS | WorkDrive Folder 05 buffer | Daily Catalyst job checks the count of unused story files by role category. When any category or the overall count falls below the minimum buffer, Agent 6 alerts Parmeet. |

## **2.3 What Agent 6 Does NOT Do**

- Edit or curate submitted story content. The story text is saved exactly as submitted.

- Post stories publicly. Files are saved to WorkDrive Folder 05 for Agent 3 internal consumption only.

- Send emails to ambassadors. Agent 3 owns all ambassador-facing content.

- Interact with Zoho CRM. Agent 6 is a content pipeline utility.

- Modify files already saved to Folder 05. Once saved, only Parmeet can edit or delete files manually.

- Make content decisions. The Role Category field is selected by the submitter. Agent 6 writes what it receives.

## **2.4 Run Cycle**

| **Trigger** | **Source** | **Timing** | **Function** |
| --- | --- | --- | --- |
| Story form submission | Zoho Flow: Zoho Forms trigger | Real-time on submission | Flow processes each story in the batch (up to 5 per submission). For each story with content: calculates target date, writes Role_Category to header, generates filename, saves to Folder 05. Sends confirmation email to submitter. |
| Daily buffer check | Catalyst scheduled job | Daily 5:30 AM CST | Counts unused story files in Folder 05 by role category. Alerts Parmeet if total or any category falls below minimum threshold. |

# **3. Story Intake Form**

Parmeet builds the intake form in Zoho Forms. The developer confirms field names match this specification before building the Zoho Flow. The form accepts up to five stories per submission in batch mode.

| **Field** | **Type** | **Notes** |
| --- | --- | --- |
| Submitter name | Short text | Name of the person submitting. Used in confirmation email. |
| Submitter email | Email | Address where confirmation email is sent. |
| Story 1: Title | Short text | Required for Story 1. 80-character maximum. Used in filename and file header. |
| Story 1: Role Category | Dropdown | Required for Story 1. Values: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any. This is the key new field in Version 2.0. Used to tag the file header for Agent 3 story selection by role category. Any means suitable for all audiences. |
| Story 1: Target Week | Date picker | Required for Story 1. The Monday of the week this story should appear in Agent 3's Week 2 rotation. The Flow uses this date in the filename. |
| Story 1: Content | Long text | Required for Story 1. The full story text. No length limit enforced by form, but submitters are advised to keep stories under 500 words for email readability. |
| Story 2: Title | Short text | Optional. Same structure as Story 1 fields. |
| Story 2: Role Category | Dropdown | Optional. Same values as Story 1 Role Category. Required if Story 2 content is provided. |
| Story 2: Target Week | Date picker | Optional. Required if Story 2 content is provided. |
| Story 2: Content | Long text | Optional. If content is empty, Flow skips this story slot. |
| Stories 3, 4, 5 | Same structure | Same field structure repeated for Stories 3, 4, and 5. All optional. Flow skips any slot where content is empty. |

## **3.1 Role Category Field — Detail**

The Role Category dropdown is the key new field in Version 2.0. It must match exactly the role category values used by Agent 3 in CRM and in the getMostRecentStoryByCategory() function. The dropdown values must be configured in Zoho Forms exactly as shown below — not as display labels with different underlying values.

| **Role Category Value** | **When to Use** |
| --- | --- |
| K12 Educator | Story features a classroom teacher, instructional coach, school counselor, paraprofessional, or other K-12 school staff member. Most common category. |
| Early Childhood | Story features a childcare worker, daycare director, Head Start staff member, pre-K teacher, or early childhood educator. |
| Faith Community | Story features a youth pastor, children's ministry director, Sunday school teacher, Christian school teacher, or homeschool educator. |
| Youth Serving Professional | Story features a Boys and Girls Club staff member, YMCA youth coordinator, after-school program staff, foster care advocate, or child welfare worker. |
| Any | Story is broadly relatable and does not feature a specific professional role, or the story involves a student outcome that resonates across all ambassador types. Use Any when in doubt — Agent 3 will use Any-tagged stories as fallback content for any ambassador whose role category has no matching story available. |

| **NOTE** When in doubt about role category, submitters should choose Any. An Any-tagged story is always available to Agent 3 as a fallback for any ambassador type. It is better to have a well-written Any story than a poorly-targeted K12 story. Quality of the story content matters more than precision of the category tag. |
| --- |

# **4. File Format Specification**

Every file saved to WorkDrive Folder 05 by Agent 6 must follow this exact format. Agent 3 parses the ROLE_CATEGORY header line using a regex match. If the header is missing or malformatted, Agent 3 falls back to Any category for that file. The story body must begin after the separator and blank line.

| **File Section** | **Content and Format** |
| --- | --- |
| Filename | Story_YYYY-MM-DD_[sanitized-title].txt where YYYY-MM-DD is the Monday of the target week and [sanitized-title] is the story title with spaces replaced by hyphens and special characters removed. Maximum filename length: 100 characters including the Story_ prefix and .txt extension. Example: Story_2026-06-02_maria-transforms-her-classroom.txt |
| Header line 1 | STORY TITLE: [full story title as submitted] |
| Header line 2 | ROLE_CATEGORY: [dropdown value selected by submitter — exactly one of: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any] |
| Header line 3 | TARGET WEEK: [YYYY-MM-DD of the target Monday] |
| Header line 4 | SUBMITTED BY: [submitter name] |
| Header line 5 | SUBMITTED AT: [ISO 8601 timestamp of form submission] |
| Separator | --- (three hyphens on their own line) |
| Blank line | One blank line between the separator and the story body |
| Story body | The full story content exactly as submitted. No edits, no reformatting. |
| Closing separator | --- (three hyphens on their own line at the end of the file) |

## **4.1 Example File**

| STORY TITLE: Maria Transforms Her Classroom in South Texas ROLE_CATEGORY: K12 Educator TARGET WEEK: 2026-06-02 SUBMITTED BY: Parmeet Kaur SUBMITTED AT: 2026-05-13T14:23:00Z --- Maria had been teaching fourth grade in the Rio Grande Valley for eleven years when she enrolled in Gracelyn's master's program. She had always believed her students deserved better, but she had never had the tools to prove it. Eighteen months later, her classroom data told a different story. Reading scores in her class rose 34 percent over the school year. Three of her students who had been flagged for retention are now performing at grade level. Maria says: the program did not just give me a credential. It gave me language for what I already knew, and evidence I could bring to my principal. --- |
| --- |

| **NOTE** The ROLE_CATEGORY line must appear as the second line in the header, immediately after STORY TITLE. Agent 3's parseRoleCategory() function uses a regex that matches the pattern ROLE_CATEGORY: followed by the value. The label is case-sensitive. Confirm with the Agent 3 developer that this exact label is what their regex expects. |
| --- |

# **5. Zoho Flow: Story Processing Steps**

The Zoho Flow triggers on each new Zoho Forms submission and processes all story slots in the batch. The Flow is built in Zoho One and uses native WorkDrive and Mail connections. Deluge scripting handles filename generation and file content assembly.

| **Step** | **Function** | **Detail** |
| --- | --- | --- |
| 1 | Receive form submission | Zoho Flow trigger fires when a new Zoho Forms submission is received. Read all submitted fields from the submission payload. |
| 2 | Validate submitter fields | Confirm submitter name and submitter email are present. If either is missing, send error notification to PARMEET_ALERT_EMAIL. Do not process any stories. |
| 3 | Process Story 1 | Read Story 1 title, Role Category, target week, and content. If content is empty, skip to Step 4 (Story 2). If content is present but title or Role Category is missing, flag this story as invalid and log for confirmation email. If all fields present, proceed to story processing steps. |
| 3a | Sanitize title for filename | Replace spaces with hyphens. Remove any character that is not alphanumeric, a hyphen, or an underscore. Truncate to 80 characters. Convert to lowercase. This produces the [sanitized-title] component of the filename. |
| 3b | Calculate target date | Parse the target week date field. Find the Monday of that week (or use the date directly if it is already a Monday). Format as YYYY-MM-DD. This is the date component of the filename. |
| 3c | Check for duplicate filename | Query WorkDrive Folder 05 for any existing file with the same filename. If a duplicate exists, append _v2 to the sanitized title and check again. If _v2 also exists, append _v3. Log any duplicate detection in the confirmation email. |
| 3d | Build file content | Assemble the file content using the header format defined in Section 4. Header lines in exact order: STORY TITLE, ROLE_CATEGORY, TARGET WEEK, SUBMITTED BY, SUBMITTED AT. Separator, blank line, story body, closing separator. |
| 3e | Save file to WorkDrive Folder 05 | Write the assembled content as a plain text file to WorkDrive Folder 05. File encoding: UTF-8. If the write fails, log the failure and include in confirmation email. Retry once after 30 seconds. |
| 4 | Repeat for Stories 2 through 5 | Run Steps 3 through 3e for each story slot that contains non-empty content. Skip any slot where content is empty. |
| 5 | Send confirmation email | Send a confirmation email to the submitter's email address. Include: count of stories successfully saved, list of filenames saved, list of any skipped slots and reason, list of any errors. This gives Parmeet a clear record of what the Flow processed. |

## **5.1 Deluge Code: Filename Generation**

| // Zoho Flow Deluge function: sanitize title and build filename string sanitizeTitle(string rawTitle) {   string lower = rawTitle.toLowerCase();   string noSpecial = lower.replaceAll('[^a-z0-9\\s-]', '');   string hyphenated = noSpecial.replaceAll('\\s+', '-');   if (hyphenated.length() > 80) {     hyphenated = hyphenated.substring(0, 80);   }   return hyphenated; } string buildFilename(string title, string targetDate) {   string sanitized = sanitizeTitle(title);   return 'Story_' + targetDate + '_' + sanitized + '.txt'; } |
| --- |

## **5.2 Deluge Code: File Content Assembly**

| // Zoho Flow Deluge function: build file content with header string buildFileContent(map storyData, string submitterName, string submittedAt) {   string header = 'STORY TITLE: '   + storyData.get('title')        + '\n' +                   'ROLE_CATEGORY: ' + storyData.get('roleCategory')  + '\n' +                   'TARGET WEEK: '   + storyData.get('targetDate')    + '\n' +                   'SUBMITTED BY: '  + submitterName                  + '\n' +                   'SUBMITTED AT: '  + submittedAt                    + '\n' +                   '---\n\n';   string body = storyData.get('content');   string footer = '\n---';   return header + body + footer; } |
| --- |

# **6. Buffer Monitoring**

The daily buffer monitoring job runs at 5:30 AM CST, before Agent 3's weekly cycle fires at 9:00 AM CST on Mondays. This gives Parmeet maximum lead time to submit new stories if the buffer is low before the weekly emails go out.

| **Buffer Check** | **Logic and Alert Condition** |
| --- | --- |
| Total story count | Count all files in Folder 05 with filename starting with Story_ and ending with .txt. If total count is below STORY_BUFFER_MINIMUM (default 4), send Parmeet buffer alert. |
| Per-role-category count | For each of the five role category values (K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any), count files in Folder 05 tagged with that category in the ROLE_CATEGORY header line. If any individual category count is zero, include in buffer alert as a category gap warning. Agent 3 will fall back to Any-tagged stories for ambassadors in that category, but the buffer alert helps Parmeet plan content submission. |
| Used file exclusion | A story file is considered consumed once it has been selected by Agent 3 for a weekly email. Agent 3 logs the filename it used in the Last_Story_File_Used CRM field. The buffer monitoring job reads this field across all ambassador records and excludes filenames that have been used this week from the available count. This prevents counting recently used stories as available buffer. |
| Alert content | Buffer alert email sent to Parmeet includes: total available story count, count by role category, count of stories used this week, and a direct link to the story intake form for quick submission. Alert fires once per day maximum. |

| **NOTE** The buffer minimum of 4 stories (default) is calibrated to give Parmeet one month of lead time if she submits stories in batches of four once per month. Parmeet can adjust STORY_BUFFER_MINIMUM without developer assistance. A higher minimum gives more buffer warning; a lower minimum reduces alert frequency. |
| --- |

# **7. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| Form submission missing submitter email | Validation check in Flow Step 2 | Do not process any stories. Send error to PARMEET_ALERT_EMAIL with submission ID. |
| Story slot has content but missing title | Validation check in Flow Step 3 | Skip that story slot. Log as invalid in confirmation email. Process remaining valid slots. |
| Story slot has content but missing Role Category | Validation check in Flow Step 3 | Skip that story slot. Log as invalid in confirmation email. Role Category is required for Agent 3 story selection to work correctly. |
| Target week date is in the past | Date check in Flow Step 3b | Save the file with the past date in the filename. Include a warning in the confirmation email that the target week has passed and Agent 3 may have already cycled past this date. |
| Duplicate filename detected | Folder 05 query in Flow Step 3c | Append _v2 or _v3 to title. Save with modified filename. Note in confirmation email. |
| WorkDrive file save fails | WorkDrive API error on write | Retry once after 30 seconds. If retry fails, log failure in confirmation email with full story content so Parmeet can resubmit. Do not lose the story content. |
| Confirmation email fails to send | Zoho Mail API error | Log locally. Alert PARMEET_ALERT_EMAIL directly. Do not fail silently on confirmation email. |
| Buffer monitoring Catalyst function fails | Catalyst function error | Alert PARMEET_ALERT_EMAIL. Buffer alert for that day is not sent. Agent 3 will still function but Parmeet loses visibility into queue depth. |
| Agent 3 selects a story that cannot be read | WorkDrive download error in Agent 3 | Agent 3 falls back to the next available file. This is Agent 3's failure mode to handle, not Agent 6's. But if many read failures occur, Agent 6 developer should confirm file encoding is UTF-8. |

# **8. Testing Protocol**

## **8.1 Unit Tests**

| **Test** | **How to Execute** | **Expected Result** |
| --- | --- | --- |
| Filename generation — standard title | Submit story with title: Maria Transforms Her Classroom in South Texas. Target week: 2026-06-02. | Filename: Story_2026-06-02_maria-transforms-her-classroom-in-south-texas.txt |
| Filename generation — special characters | Submit story with title: It's a New Day: Hope for Teachers & Kids. | Special characters removed, spaces hyphenated: Story_2026-06-02_its-a-new-day-hope-for-teachers-kids.txt |
| Role Category written to file header | Submit story with Role Category = Early Childhood. | File header contains line: ROLE_CATEGORY: Early Childhood |
| Role Category: Any written to header | Submit story with Role Category = Any. | File header contains line: ROLE_CATEGORY: Any |
| All five header lines present | Submit any story and inspect saved file. | Header contains in order: STORY TITLE, ROLE_CATEGORY, TARGET WEEK, SUBMITTED BY, SUBMITTED AT. Separator line follows. |
| Story body preserved exactly | Submit story with specific formatting (line breaks, etc). Inspect saved file. | Story body appears exactly as submitted between the separator lines. No reformatting. |
| Empty story slot skipped | Submit form with Stories 1 and 3 filled, Story 2 empty. | Two files saved (Story 1 and Story 3). Story 2 skipped. Confirmation email notes the skipped slot. |
| Duplicate filename handled | Submit the same story title for the same target week twice. | Second file saved with _v2 appended to title. No files overwritten. Confirmation email notes the duplicate. |
| Past target date warning | Submit story with target week date two weeks in the past. | File saved with past date in filename. Confirmation email includes past-date warning. |
| Batch of five stories — all valid | Submit form with all five story slots filled with valid content and role categories. | Five files saved to Folder 05. Confirmation email lists all five filenames. |
| Confirmation email received | Submit any valid story. | Confirmation email arrives at submitter email address within 5 minutes. Lists all saved filenames. |
| Buffer alert fires below minimum | Manually reduce Folder 05 below STORY_BUFFER_MINIMUM. Run buffer monitoring job. | Buffer alert email sent to Parmeet with total count, per-category counts, and intake form link. |
| Per-category zero count alert | Remove all Faith Community-tagged files from Folder 05. Run buffer monitoring job. | Buffer alert includes category gap warning for Faith Community even if total count is above minimum. |
| Agent 3 reads role category from header | Coordinate with Agent 3 developer. Save a K12 Educator-tagged test file. Run Agent 3 getMostRecentStoryByCategory with roleCategory = K12 Educator. | Agent 3 selects the K12-tagged file. ROLE_CATEGORY header parsed correctly by Agent 3. |
| No credentials hardcoded | Code review of Flow configuration and Catalyst function. | All credentials stored as environment variables. No API keys or tokens in code. |

## **8.2 Critical Integration Test with Agent 3**

| **This integration test must be completed with the Agent 3 developer present before Agent 6 is considered production-ready. Agent 3****'****s story selection depends entirely on the file format Agent 6 produces. A format mismatch is a silent failure.** |
| --- |

- Save a test story file using the Flow for each of the five role category values

- Confirm each file is saved to WorkDrive Folder 05 with correct filename and header format

- Ask the Agent 3 developer to run getMostRecentStoryByCategory() for each of the five role category values

- Confirm Agent 3 selects the correct file for each category

- Confirm Agent 3's parseRoleCategory() function reads the ROLE_CATEGORY header line correctly from Agent 6-produced files

- Confirm Agent 3 falls back to Any-tagged files when no category-specific file is available

- Confirm Agent 3 falls back to the most recent file regardless of category when no Any-tagged files are available

## **8.3 Acceptance Criteria**

| **Criterion** | **Verified By** | **Status** |
| --- | --- | --- |
| Story files saved to Folder 05 with correct filename format and within 5 minutes of form submission | Parmeet: submit test story and check Folder 05 | [ ] Pending |
| ROLE_CATEGORY header line present and correct in every saved file | Developer: inspect saved files for all five role category values | [ ] Pending |
| Agent 3 getMostRecentStoryByCategory() reads Role_Category from file header correctly | Agent 3 developer: integration test with tagged files | [ ] Pending |
| Empty story slots skipped without error. Confirmation email accurately lists saved and skipped stories | Parmeet: submit form with intentional empty slots | [ ] Pending |
| Special characters in story titles do not cause filename errors | Developer: test with apostrophes, ampersands, colons in title | [ ] Pending |
| Duplicate filenames handled without overwriting existing files | Developer: submit same title for same target week twice | [ ] Pending |
| Buffer alert fires when total count falls below STORY_BUFFER_MINIMUM | Parmeet: manually reduce Folder 05 and run buffer job | [ ] Pending |
| Per-category gap warning included in buffer alert when any category has zero files | Developer: remove all files of one category and run buffer job | [ ] Pending |
| Parmeet never needs to manually name or rename a file in Folder 05 | Parmeet: confirm after first month of operation | [ ] Pending |
| No credentials hardcoded in any Flow function or Catalyst code | Parmeet: code review before deployment | [ ] Pending |

# **9. Integration Notes for Other Developers**

## **9.1 What Agent 3 Developer Needs to Know**

- Agent 6 writes a ROLE_CATEGORY header line as the second line of every story file. The exact label is ROLE_CATEGORY: followed by a space and the value. Agent 3's parseRoleCategory() regex must match this exact pattern. Confirm the regex with the Agent 6 developer before either agent is tested.

- Valid ROLE_CATEGORY values written by Agent 6 are: K12 Educator, Early Childhood, Faith Community, Youth Serving Professional, Any. These values must match exactly the roleCategory values used in Agent 3's CRM Ambassador records and the getMostRecentStoryByCategory() filter logic. A value mismatch produces silent fallback behavior — Agent 3 will always fall back to Any or the most recent file without alerting anyone.

- The WORKDRIVE_FOLDER_05_ID environment variable must be the same value in both Agent 3 and Agent 6. If they reference different folder IDs, they are operating on different folders. Confirm this value with Parmeet before either developer writes a WorkDrive call.

## **9.2 What Parmeet Needs to Know About Content Management**

- Stories are submitted through the intake form. No manual file naming or uploading is ever required. The Flow handles all file creation and naming automatically.

- Maintain a minimum buffer of four stories ahead at all times. Batch submissions of three to five stories are recommended. One submission can cover a full month of content.

- The Role Category field is the most important field in the form. Choose carefully. If unsure, choose Any — it is better to have a well-written Any story than a poorly-targeted category story.

- A confirmation email arrives within five minutes of every submission listing what was saved and what was skipped. Check this email after each submission to confirm the Flow processed correctly.

- A buffer alert email arrives if the story queue drops below the minimum. The email includes a direct link to the intake form for quick submission.

# **10. Shared Environment Variables**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| ZOHO_WORKDRIVE_CLIENT_ID | Parmeet | OAuth client ID for WorkDrive. Used in Catalyst buffer monitoring function only. |
| ZOHO_WORKDRIVE_CLIENT_SECRET | Parmeet | OAuth client secret for WorkDrive. |
| ZOHO_WORKDRIVE_REFRESH_TOKEN | Parmeet | OAuth refresh token for WorkDrive. |
| ZOHO_MAIL_CLIENT_ID | Parmeet | OAuth client ID for Zoho Mail. Used for buffer alert emails. |
| ZOHO_MAIL_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Mail. |
| ZOHO_MAIL_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Mail. |
| WORKDRIVE_FOLDER_05_ID | Parmeet | WorkDrive Folder 05 ID. Must match the value used by Agent 3. Confirm with Agent 3 developer. |
| STORY_BUFFER_MINIMUM | Parmeet | Minimum total story file count before buffer alert fires. Default: 4. Parmeet can adjust without developer assistance. |
| STORY_INTAKE_FORM_URL | Parmeet | URL of the Zoho Forms story intake form. Included in buffer alert emails so Parmeet can submit new stories in one click. |
| PARMEET_ALERT_EMAIL | Parmeet | Email for buffer alerts and Flow error notifications. |
| MAKE_BUFFER_ALERT_WEBHOOK | Developer | Make.com webhook URL for buffer alert routing scenario. |
| ZOHO_FLOW_ID | Developer | ID of the Zoho Flow that processes story intake submissions. Used if the Flow needs to be triggered manually for testing. |

| **NOTE** WORKDRIVE_FOLDER_05_ID must be confirmed with both the Agent 3 developer and Parmeet before being set. It is the single most critical environment variable in Agent 6 — if it points to the wrong folder, all story files are saved to the wrong location and Agent 3 finds an empty buffer. |
| --- |
**GRACELYN UNIVERSITY**

*gracelyn.edu*

**Ambassador Program**

**Payment Policy**

*Referral fee structure, payment methods, international routing,*

*onboarding payment selection, and Zoho Books workflow*

Version 2.0 — May 2026

Gracelyn University — Confidential

# **1. Referral Fee Structure**

Referral fees are the financial recognition Gracelyn offers ambassadors when a referred student or recruited ambassador succeeds. The fee is an acknowledgment of the ambassador's role in expanding Gracelyn's mission — not a recruitment incentive. All ambassador communications reflect this framing. The word commission is never used.

| **Fee Type** | **Amount** | **Eligibility Condition** |
| --- | --- | --- |
| Student referral fee — Undergraduate | $100 | Referred student completes 4 consecutive months of active enrollment in an undergraduate program. |
| Student referral fee — Graduate | $200 | Referred student completes 4 consecutive months of active enrollment in a graduate program. |
| Recruiting referral fee — Undergraduate | $50 | An ambassador directly recruited by this ambassador refers a student who completes 4 consecutive months of active enrollment in an undergraduate program. |
| Recruiting referral fee — Graduate | $100 | An ambassador directly recruited by this ambassador refers a student who completes 4 consecutive months of active enrollment in a graduate program. |

| **NOTE** Both the student referral fee and the recruiting referral fee are triggered by the same event: the referred student completing 4 consecutive months of active enrollment. There is no separate eligibility clock for recruiting fees. Both fees are processed in the same payment cycle when the student reaches eligibility. |
| --- |

# **2. Payment Methods**

Version 2.0 introduces international payment support. The program now supports four payment methods to cover all ambassador populations worldwide. The available methods shown to each ambassador during onboarding are determined by their country of residence.

| **Method** | **Availability** | **Notes** |
| --- | --- | --- |
| PayPal | All ambassadors worldwide where PayPal operates | Requires ambassador to have or create a PayPal account. Fastest setup. Most widely available. Parmeet sets up Gracelyn PayPal business account for outgoing payments. |
| ACH bank transfer | United States ambassadors only | Requires US bank account and routing number. Ambassador provides bank details through secure portal. Processed via Zoho Books ACH integration. |
| Wise | International ambassadors in Wise-supported countries | Transfers to local bank account in local currency. Low fees. Requires ambassador to provide local bank details. Gracelyn opens a Wise Business account. Wise supports 80+ countries. |
| Tremendous | All ambassadors worldwide as universal fallback | Virtual prepaid card delivered by email. Works anywhere Visa or Mastercard is accepted. No bank account required. Ideal for ambassadors in countries where PayPal and Wise are unavailable or have limited support. Delivered within minutes of processing. |

| **Account Setup Required Before Launch** Three new accounts must be opened before any international ambassador can be paid: Wise Business, Tremendous, and (if not already active) PayPal Business. See Section 6 for setup requirements. Payment routing cannot be built until these accounts exist and API credentials are available. |
| --- |

# **3. Payment Method Routing by Country**

Payment method availability is determined by the ambassador's Country_of_Residence field in Zoho CRM. This field is collected on the ambassador application form. The onboarding form shows only the payment methods available for the ambassador's country. Ambassadors cannot select a method that is unavailable for their location.

| **Routing Condition** | **Payment Method Assigned** |
| --- | --- |
| Country_of_Residence = United States | Ambassador sees: PayPal or ACH bank transfer. ACH is available. Both methods offered. |
| Country_of_Residence = Wise-supported country (non-US) | Ambassador sees: PayPal or Wise. ACH is not available and is not displayed. Wise is offered as the recommended local transfer option. |
| Country_of_Residence = country not supported by Wise or PayPal | Ambassador sees: Tremendous virtual prepaid card only. This is the universal fallback. Displayed with explanation that it works anywhere Visa or Mastercard is accepted. |
| Country_of_Residence = not provided or Unknown | Default to PayPal and Tremendous. Flag the record for Parmeet review. Do not block onboarding — the ambassador can update their country later. |

## **3.1 Wise Country Coverage**

Wise supports bank transfers in 80+ countries. The complete list of Wise-supported countries is maintained at wise.com and may change over time. For implementation, the developer builds a country list lookup against the Wise-supported countries list. If a country is in the Wise-supported list, Wise is shown as an option. If not, Wise is excluded and Tremendous is the fallback.

| **NOTE** Parmeet should not attempt to maintain a manual list of Wise-supported countries. The developer should either call the Wise API to get the current supported country list at routing time, or use a regularly updated environment variable. Wise's country support expands over time and a static list will become outdated. |
| --- |

## **3.2 PayPal Availability**

PayPal is available in most countries where Gracelyn will have ambassadors. However, PayPal has varying levels of functionality in different regions — some countries allow receiving payments but not withdrawing to a bank account, or have transaction limits that affect the usability of small payouts. PayPal is always offered as an option but ambassadors should understand that PayPal functionality varies by country. If a PayPal payment fails due to regional restrictions, the coordinator offers Wise or Tremendous as an alternative.

# **4. Ambassador Onboarding: Payment Information Collection**

Payment information is collected during the ambassador onboarding flow managed by Agent 2. The country of residence field on the application form drives which payment options are shown. Payment information must be complete before the ambassador's referral link is activated.

## **4.1 CRM Fields for Payment**

| **CRM Field** | **Type** | **Notes** |
| --- | --- | --- |
| Country_of_Residence | Picklist (country list) | Collected on the ambassador application form. Used to determine payment method options shown during onboarding. Written to CRM on application submission. |
| Payment_Method_Preference | Picklist | Values: PayPal, ACH, Wise, Tremendous. Set by ambassador during onboarding. Used by Make.com payment routing when a fee becomes eligible. Updated by ambassador through portal Account Settings. |
| PayPal_Email | Email | Collected if Payment_Method_Preference = PayPal. Validated format only — Gracelyn does not verify PayPal account existence at onboarding. |
| Bank_Account_Routing | Encrypted text | Collected if Payment_Method_Preference = ACH. Stored encrypted. Only accessible to payment processing workflow, not displayed in coordinator CRM views. |
| Bank_Account_Number | Encrypted text | Collected if Payment_Method_Preference = ACH. Stored encrypted. |
| Wise_Email_or_Account | Text | Collected if Payment_Method_Preference = Wise. The email address or account identifier used to receive Wise transfers. |
| Tremendous_Email | Email | Collected if Payment_Method_Preference = Tremendous. The email address where virtual prepaid card delivery notifications are sent. |
| Payment_Info_Complete | Checkbox | Set to true when all required fields for the selected payment method are provided. Agent 2 checks this field before completing ambassador activation. Referral link is withheld until Payment_Info_Complete = true. |

## **4.2 Onboarding Form Conditional Logic**

The application form and onboarding portal use conditional logic to show only the relevant payment fields based on Country_of_Residence. This is implemented in Zoho Forms and the WordPress ambassador portal.

| // Pseudocode: payment method display logic in onboarding form function getAvailablePaymentMethods(countryCode) {   const methods = [];   // PayPal: available in most countries   if (isPayPalAvailable(countryCode)) {     methods.push('PayPal');   }   // ACH: US only   if (countryCode === 'US') {     methods.push('ACH');   }   // Wise: supported countries only   if (isWiseSupportedCountry(countryCode)) {     methods.push('Wise');   }   // Tremendous: always available as universal fallback   methods.push('Tremendous');   return methods; } // Show payment fields based on selection function showPaymentFields(selectedMethod) {   hideAll(['paypal-fields', 'ach-fields', 'wise-fields', 'tremendous-fields']);   show(selectedMethod.toLowerCase() + '-fields'); } |
| --- |

## **4.3 Payment Information Update**

Ambassadors can update their payment information at any time through the Ambassador Portal under Account Settings. Changes take effect on the next payment cycle. If an ambassador changes their payment method, the new method is used for all future payments. Payments already in progress (where the fee has been approved but not yet sent) use the method on file at the time of approval.

# **5. Zoho Books Payment Workflow**

All referral fee payments and recruiting referral fee payments are processed through Zoho Books. The workflow handles both the primary fee to the referring ambassador and, where applicable, the secondary recruiting fee to the upstream ambassador who recruited them.

| **Step** | **Action** | **Detail** |
| --- | --- | --- |
| 1 | Agent 4 surfaces eligible referral | Agent 4 daily eligibility check detects Referral_Stage = Eligible for a referral record. Referral is added to the coordinator payment queue in Zoho Analytics. |
| 2 | Coordinator reviews and confirms | Coordinator reviews the eligible referral in the payment queue. Confirms the referred student is still actively enrolled. Clicks Approve Payment in the coordinator dashboard. |
| 3 | Zoho Books: create expense for primary fee | Zoho Books creates an expense record for the student referral fee: amount ($100 or $200 based on program level), payee = referring ambassador, description = Student Referral Fee — [referred student ID masked], reference = Referral Record ID. |
| 4 | Identify recruiting ambassador | Query CRM: does this referral record have a Recruited_By_Ambassador_ID? If yes, the referring ambassador was recruited by another ambassador who is eligible for a recruiting referral fee. Proceed to Step 5. If no, skip to Step 6. |
| 5 | Zoho Books: create expense for recruiting fee | Zoho Books creates a second expense record for the recruiting referral fee: amount ($50 or $100 based on program level), payee = recruiting ambassador (identified by Recruited_By_Ambassador_ID), description = Recruiting Referral Fee — [referring ambassador ID masked], reference = same Referral Record ID. |
| 6 | Route to payment method | For each expense record, read the payee ambassador's Payment_Method_Preference from CRM. Route to the correct payment pathway: PayPal API, ACH via Zoho Books bank integration, Wise Business API, or Tremendous API. |
| 7 | Confirm payment and update CRM | When payment is confirmed by the payment provider, write to CRM: Referral_Fee_Status = Paid, Fee_Payment_Date, Fee_Payment_Method, Fee_Payment_Amount. For recruiting fees: write Recruiting_Fee_Status = Paid, Recruiting_Fee_Payment_Date to the recruiting ambassador's record. |
| 8 | Send email notifications | Agent 3 sends Email G (student referral fee eligibility confirmed) to the referring ambassador and Email G-2 (recruiting referral fee) to the recruiting ambassador if applicable. Email H (payment confirmed) fires after payment confirmation. |

## **5.1 Payment Route by Method**

| **Payment Method** | **Make.com Routing and API Integration** |
| --- | --- |
| PayPal | Make.com calls PayPal Payouts API with the ambassador's PayPal email, amount, and currency (USD). PayPal sends payment to the ambassador's account. Make.com receives payment confirmation. Confirmation webhook fires to CRM update step. |
| ACH | Make.com triggers Zoho Books ACH payment using the ambassador's encrypted bank account details. Zoho Books processes via connected bank integration. ACH settlement takes 1-3 business days. Confirmation is received from Zoho Books on settlement. |
| Wise | Make.com calls Wise Business API with the ambassador's Wise email or account ID, amount in USD, and destination currency (Wise converts). Wise transfers to the ambassador's local bank account. Confirmation received from Wise API. Typical delivery 1-2 business days. |
| Tremendous | Make.com calls Tremendous API with the ambassador's email address and fee amount. Tremendous issues a virtual prepaid card and emails it to the ambassador. Confirmation received from Tremendous immediately. Ambassador can use the card online anywhere Visa or Mastercard is accepted. |

## **5.2 Dual Payment Logic**

When a referral reaches eligibility, the system checks whether the referring ambassador was recruited by another ambassador. If yes, two payments are processed: one to the referring ambassador (student referral fee) and one to the recruiting ambassador (recruiting referral fee). Both are processed in the same cycle. Both are recorded in Zoho Books with separate expense records. Both generate separate CRM updates and email notifications.

| // Make.com: dual payment routing logic async function processFeePayment(referralRecord) {   const referringAmbassador = await getCRMRecord(referralRecord.Ambassador_ID);   const feeAmount = referralRecord.Program_Level === 'Graduate' ? 200 : 100;   // Primary payment: student referral fee   await routePayment({     ambassador: referringAmbassador,     amount: feeAmount,     type: 'Student Referral Fee',     referralId: referralRecord.id   });   // Secondary payment: recruiting referral fee (if applicable)   if (referringAmbassador.Recruited_By_Ambassador_ID) {     const recruitingAmbassador = await getCRMRecord(       referringAmbassador.Recruited_By_Ambassador_ID     );     const recruitingFee = referralRecord.Program_Level === 'Graduate' ? 100 : 50;     await routePayment({       ambassador: recruitingAmbassador,       amount: recruitingFee,       type: 'Recruiting Referral Fee',       referralId: referralRecord.id     });   } } async function routePayment({ ambassador, amount, type, referralId }) {   const method = ambassador.Payment_Method_Preference;   switch (method) {     case 'PayPal':     return await payViaPayPal(ambassador, amount, type, referralId);     case 'ACH':        return await payViaACH(ambassador, amount, type, referralId);     case 'Wise':       return await payViaWise(ambassador, amount, type, referralId);     case 'Tremendous': return await payViaTremendous(ambassador, amount, type, referralId);     default: throw new Error('Unknown payment method: ' + method);   } } |
| --- |

# **6. Required Account Setup Before Launch**

Three payment platform accounts must be set up by Parmeet before any international payment can be processed. Development of the payment routing cannot begin until API credentials from all three are available.

| **Account** | **Setup Requirement** |
| --- | --- |
| PayPal Business | Parmeet opens a Gracelyn University PayPal Business account if not already active. Enables PayPal Payouts API. Parmeet provides API client ID and secret to developer for Make.com integration. No per-transaction setup — works for all PayPal-eligible ambassadors globally. |
| Wise Business | Parmeet opens a Wise Business account at wise.com/business. Funds the account with initial balance for outgoing transfers. Enables Wise API access. Parmeet provides API token to developer for Make.com integration. Wise supports 80+ countries and handles currency conversion automatically. |
| Tremendous | Parmeet opens a Tremendous account at tremendous.com. Free to open, pay-as-you-go pricing. Enables Tremendous API access. Parmeet provides API key to developer for Make.com integration. Tremendous delivers virtual prepaid cards by email within minutes of API call. No advance funding required — Gracelyn is billed per card. |
| ACH via Zoho Books | ACH processing uses Zoho Books' existing bank integration. Parmeet confirms the Gracelyn University bank account is connected and ACH outgoing payments are enabled in Zoho Books. No separate account required. US ambassadors only. |

| **Blocking Pre-Launch Task** Parmeet must open Wise Business and Tremendous accounts and provide API credentials to the developer before payment routing development begins. These are not optional accounts — they are required for the program to pay international ambassadors. Opening these accounts takes 1-3 business days for verification. Plan accordingly relative to the launch date. |
| --- |

# **7. Failure Scenarios and Error Handling**

| **Failure** | **Detection** | **Response** |
| --- | --- | --- |
| PayPal payment fails | PayPal API returns error | Log failure. Alert coordinator with ambassador name, fee amount, and PayPal error code. Do not retry automatically. Coordinator contacts ambassador to update PayPal email or switch payment method. |
| ACH payment fails | Zoho Books returns error or bank rejects | Log failure. Alert coordinator. ACH failures are typically caused by incorrect bank details. Coordinator contacts ambassador to update bank information or switch payment method. |
| Wise payment fails | Wise API returns error | Log failure. Alert coordinator. Common causes: Wise account not active in ambassador's country, incorrect account details. Coordinator contacts ambassador. Offer Tremendous as fallback. |
| Tremendous card issuance fails | Tremendous API returns error | Log failure. Alert coordinator immediately. Tremendous failures are rare. Coordinator contacts Tremendous support and manually issues card if needed. |
| Payment_Method_Preference missing or invalid | CRM field empty or unrecognized value | Flag referral payment as On Hold. Alert coordinator. Coordinator contacts ambassador to select a payment method before payment can proceed. |
| Payment_Info_Complete = false at payment time | CRM check at routing step | Flag as On Hold. Alert coordinator. Ambassador must complete payment information before payment can be issued. |
| Dual payment required but recruiting ambassador record not found | Recruited_By_Ambassador_ID resolves to inactive or missing record | Process primary fee normally. Log recruiting fee as unresolvable. Alert coordinator for manual review. |

# **8. Payment Policy Rules**

The following rules govern all referral fee payments. These rules are reflected in the Ambassador Agreement and apply without exception.

- Referral fees are paid only after 4 consecutive months of active enrollment are confirmed. No exceptions.

- No referral fee is paid at the time of application or enrollment, or at any point during the eligibility period.

- Student withdrawal, dismissal, or enrollment pause before the 4-month mark renders the referral ineligible. No partial fees are paid.

- There is no cap on the number of referral fees or recruiting referral fees an ambassador may earn.

- The recruiting referral fee system has a maximum depth of two layers. No fees are paid for referrals made beyond this depth.

- Self-referrals and household referrals are disqualified and do not generate referral fees.

- Self-recruiting and household recruiting are disqualified and do not generate recruiting referral fees.

- Gracelyn University reserves the right to withhold or deny payment if program rules have been violated.

- The word commission is never used in any ambassador-facing communication. Always say referral fee.

# **9. Environment Variables for Payment Routing**

| **Variable** | **Owner** | **Notes** |
| --- | --- | --- |
| PAYPAL_CLIENT_ID | Parmeet | PayPal Business API client ID for Payouts API. |
| PAYPAL_CLIENT_SECRET | Parmeet | PayPal Business API client secret. |
| PAYPAL_MODE | Developer | Values: sandbox (testing) or live (production). Set to sandbox during development. |
| WISE_API_TOKEN | Parmeet | Wise Business API token. Generated in the Wise Business dashboard. |
| WISE_PROFILE_ID | Parmeet | Wise Business profile ID. Required for outgoing transfer API calls. |
| TREMENDOUS_API_KEY | Parmeet | Tremendous API key from Tremendous dashboard. |
| TREMENDOUS_FUNDING_SOURCE_ID | Parmeet | Tremendous funding source ID. Gracelyn is billed per card issued. Confirm funding source is active before launch. |
| ZOHO_BOOKS_ORGANIZATION_ID | Parmeet | Zoho Books organization ID for expense record creation. |
| ZOHO_BOOKS_CLIENT_ID | Parmeet | OAuth client ID for Zoho Books API. |
| ZOHO_BOOKS_CLIENT_SECRET | Parmeet | OAuth client secret for Zoho Books API. |
| ZOHO_BOOKS_REFRESH_TOKEN | Parmeet | OAuth refresh token for Zoho Books API. |
| WISE_SUPPORTED_COUNTRIES_API_URL | Developer | Wise API endpoint for fetching current supported country list. Use to dynamically determine Wise eligibility rather than maintaining a static list. |
| PAYMENT_FAILURE_ALERT_EMAIL | Parmeet | Email address for all payment failure alerts to coordinator. |

| **NOTE** All environment variables are stored as Zoho Catalyst environment variables or Make.com secure variables depending on where the payment routing code lives. No API key or secret is hardcoded in any scenario, function, or workflow. |
| --- |
'use strict';

/**
 * Pure date/timing helpers for Function C (design §6.3, §3.1). No CRM or
 * network access — everything here is unit-testable in isolation.
 */

const { COMPLIANCE_SCHEDULE } = require('./manifest');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in America/Chicago (matches the 8:30 AM CST daily job). */
function dateStr(now) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Whole days between a YYYY-MM-DD date string and `now`. Null/invalid → null. */
function daysSince(dateOnlyStr, now) {
  if (!dateOnlyStr) return null;
  const then = new Date(`${String(dateOnlyStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  const today = new Date(`${dateStr(now)}T00:00:00Z`);
  return Math.floor((today.getTime() - then.getTime()) / MS_PER_DAY);
}

/** True when the 5-day minimum reminder gap (design §6.3 C2) has elapsed. */
function reminderGapElapsed(lastReminderSentDate, now) {
  if (!lastReminderSentDate) return true;
  const since = daysSince(lastReminderSentDate, now);
  return since == null ? true : since > COMPLIANCE_SCHEDULE.minReminderGapDays;
}

/**
 * Function C2 — which compliance reminder tier (if any) is due today.
 * Returns 'day2' | 'day7' | 'day14' | null. Win-back-eligible ambassadors
 * (day >= 15) are handled separately by isWinBackDue, never here.
 */
function reminderTier(daysSinceApproval, lastReminderSentDate, now) {
  if (daysSinceApproval == null) return null;
  if (!reminderGapElapsed(lastReminderSentDate, now)) return null;
  if (daysSinceApproval >= 2 && daysSinceApproval <= 6) return 'day2';
  if (daysSinceApproval >= 7 && daysSinceApproval <= 13) return 'day7';
  if (daysSinceApproval >= COMPLIANCE_SCHEDULE.day14 && daysSinceApproval < COMPLIANCE_SCHEDULE.winBackDay) return 'day14';
  return null;
}

/** Function C4 — win-back trigger: day 15+, not yet sent. */
function isWinBackDue(daysSinceApproval, winBackSent) {
  return daysSinceApproval != null && daysSinceApproval >= COMPLIANCE_SCHEDULE.winBackDay && !winBackSent;
}

/** Function C6 — dormant compliance: day 75+, win-back already sent, not yet dormant. */
function isDormantDue(daysSinceApproval, winBackSent, dormantCompliance) {
  return daysSinceApproval != null && daysSinceApproval >= COMPLIANCE_SCHEDULE.dormantDay && winBackSent && !dormantCompliance;
}

module.exports = { dateStr, daysSince, reminderGapElapsed, reminderTier, isWinBackDue, isDormantDue };

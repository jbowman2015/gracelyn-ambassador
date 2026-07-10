'use strict';

/** Small date helpers (CST), shared across Agent 3's pipeline modules. */

function dateStr(now) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now); // en-CA yields YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function timeCst(now) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now) + ' CST';
  } catch {
    return now.toISOString().slice(11, 16) + ' UTC';
  }
}

/** Whole days between two YYYY-MM-DD (or Date) values, `to` minus `from`. */
function daysBetween(from, to) {
  const a = typeof from === 'string' ? new Date(`${from}T00:00:00Z`) : from;
  const b = typeof to === 'string' ? new Date(`${to}T00:00:00Z`) : to;
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Whole months between two YYYY-MM-DD values (calendar-aware, floor). */
function monthsBetween(from, to) {
  const a = typeof from === 'string' ? new Date(`${from}T00:00:00Z`) : from;
  const b = typeof to === 'string' ? new Date(`${to}T00:00:00Z`) : to;
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** Add N days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
function addDaysStr(dateString, n) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** True if `date` (CST) is the first Monday of its month. */
function isFirstMondayOfMonth(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', day: '2-digit',
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return parts.weekday === 'Mon' && Number(parts.day) <= 7;
}

/** ISO-8601 week number for a Date, used to gate the Alternative track's bi-weekly cadence. */
function isoWeekNumber(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = d - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Next Friday (YYYY-MM-DD, CST) on or after `todayStr`. */
function nextFridayStr(todayStr) {
  const d = new Date(`${todayStr}T00:00:00Z`);
  const day = d.getUTCDay(); // Sun=0..Sat=6
  const daysUntilFriday = (5 - day + 7) % 7;
  d.setUTCDate(d.getUTCDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  return d.toISOString().slice(0, 10);
}

module.exports = {
  dateStr, timeCst, daysBetween, monthsBetween, addDaysStr, isFirstMondayOfMonth, isoWeekNumber, nextFridayStr,
};

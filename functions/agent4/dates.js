'use strict';

/** Small date helpers (CST), shared across Agent 4's job modules. */

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

/**
 * Fractional hours between two ISO-8601 datetimes (or Date objects), `to`
 * minus `from`. Used for SLA elapsed-time math, where whole-day precision
 * (daysBetween) is too coarse for a 4-hour VIP threshold.
 */
function hoursBetween(from, to) {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
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

module.exports = {
  dateStr, timeCst, daysBetween, hoursBetween, addDaysStr, isFirstMondayOfMonth,
};

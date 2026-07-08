'use strict';

/**
 * Cliq daily-summary builder — pure logic, no network / no express / no secrets.
 *
 * The Ambassador Scaling project tracks work through a full delivery lifecycle,
 * not a binary done/not-done. This module derives each task's stage from its
 * LIVE Zoho Projects status name, so the daily summary reflects where every task
 * actually sits — In Review, To Be Tested, Tested & Deployed (Monitoring),
 * Waiting on a response, Delayed, etc. — and new statuses added in Projects
 * surface automatically instead of being lumped into "not started".
 */

const CT = 'America/Chicago';

// "YYYY-MM-DD" for a given epoch (ms) in Central time.
function ctDateStr(epochMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Ordered lifecycle stages for OPEN-type statuses. First matching test wins.
// Closed-type ("Complete"/"Closed"), "Cancelled" and the deployed/monitoring
// state are handled explicitly in stageOf() before this list is consulted.
const STAGES = [
  { key: 'inprogress', emoji: '🟡', label: 'In Progress',       test: (n) => n.includes('progress') },
  { key: 'inreview',   emoji: '🔎', label: 'In Review',         test: (n) => n.includes('review') },
  { key: 'tobetested', emoji: '🧪', label: 'To Be Tested',      test: (n) => n.includes('to be test') || (n.includes('test') && !n.includes('deploy')) },
  { key: 'waitingext', emoji: '⏳', label: 'Waiting — External', test: (n) => n.includes('external') },
  { key: 'waitingint', emoji: '⏳', label: 'Waiting — Internal', test: (n) => n.includes('internal') },
  { key: 'onhold',     emoji: '⏸️', label: 'On Hold',           test: (n) => n.includes('hold') },
  { key: 'delayed',    emoji: '🐢', label: 'Delayed',           test: (n) => n.includes('delay') },
  { key: 'open',       emoji: '⚪', label: 'Not Started',       test: (n) => n.includes('open') },
];

// Map a task to a stage key. Recognises shipped work ("Tested and Deployed –
// Monitoring") and closed states explicitly so delivered work is never counted
// as "not started".
function stageOf(t) {
  const n = (t.status && t.status.name ? t.status.name : '').toLowerCase().trim();
  const closed = (t.status && t.status.type === 'closed') || t.completed === true;
  if (n.includes('cancel')) return 'cancelled';
  if (closed || n.includes('complete') || n === 'closed') return 'completed';
  if (n.includes('deploy') || n.includes('monitoring')) return 'monitoring';
  for (const s of STAGES) if (s.test(n)) return s.key;
  return 'other';
}

// Stages considered "settled" — no longer active/actionable work.
const SETTLED = new Set(['completed', 'monitoring', 'cancelled']);

// Footer / breakdown metadata for every stage key.
const STAGE_META = {
  completed:  { emoji: '✅', label: 'Complete',                       foot: 'complete' },
  monitoring: { emoji: '🚀', label: 'Tested & Deployed — Monitoring', foot: 'deployed' },
  inprogress: { emoji: '🟡', label: 'In Progress',                    foot: 'in progress' },
  inreview:   { emoji: '🔎', label: 'In Review',                      foot: 'in review' },
  tobetested: { emoji: '🧪', label: 'To Be Tested',                   foot: 'to test' },
  waitingext: { emoji: '⏳', label: 'Waiting — External',             foot: 'waiting-ext' },
  waitingint: { emoji: '⏳', label: 'Waiting — Internal',             foot: 'waiting-int' },
  onhold:     { emoji: '⏸️', label: 'On Hold',                        foot: 'on hold' },
  delayed:    { emoji: '🐢', label: 'Delayed',                        foot: 'delayed' },
  open:       { emoji: '⚪', label: 'Not Started',                    foot: 'not started' },
  cancelled:  { emoji: '🚫', label: 'Cancelled',                      foot: 'cancelled' },
  other:      { emoji: '❔', label: 'Other',                          foot: 'other' },
};

// Order stages appear in the "Where Everything Stands" view and the footer.
const STAGE_ORDER = [
  'completed', 'monitoring', 'inprogress', 'inreview', 'tobetested',
  'waitingext', 'waitingint', 'onhold', 'delayed', 'open', 'cancelled', 'other',
];

// Build the full Cliq message. `now` is injectable for deterministic tests.
function buildSummary(tasks, now = Date.now()) {
  const todayStr = ctDateStr(now);
  const tmrwStr  = ctDateStr(now + 24 * 60 * 60 * 1000);
  const today    = new Date(now).toLocaleDateString('en-US', {
    timeZone: CT, weekday: 'long', month: 'long', day: 'numeric',
  });

  // Bucket every task by its live lifecycle stage.
  const buckets = {};
  for (const t of tasks) {
    const k = stageOf(t);
    (buckets[k] = buckets[k] || []).push(t);
  }
  const g = (k) => buckets[k] || [];

  // Overdue = actionable (not settled) task whose due date has passed.
  const isOverdue = (t) => !SETTLED.has(stageOf(t)) && t.end_date_long && t.end_date_long < now;
  const overdue = tasks.filter(isOverdue);

  // Delivered = shipped work: fully complete + deployed/monitoring.
  const delivered = g('completed').length + g('monitoring').length;
  const pct = tasks.length ? Math.round((delivered / tasks.length) * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  // Completed today — closed on today's Central date.
  const completedToday = g('completed').filter(
    (t) => t.last_updated_time_long && ctDateStr(t.last_updated_time_long) === todayStr
  );

  // Next steps tomorrow — unfinished work starting/due tomorrow, else soonest due.
  const active = tasks.filter((t) => !SETTLED.has(stageOf(t)));
  const dueOrStartCT = (t) => {
    const days = [];
    if (t.end_date_long)   days.push(ctDateStr(t.end_date_long));
    if (t.start_date_long) days.push(ctDateStr(t.start_date_long));
    return days;
  };
  let tomorrow = active.filter((t) => dueOrStartCT(t).includes(tmrwStr));
  if (!tomorrow.length) {
    tomorrow = active
      .filter((t) => t.end_date_long)
      .sort((a, b) => a.end_date_long - b.end_date_long)
      .slice(0, 5);
  }

  const line = (t) => {
    const due = t.end_date ? ` _(due ${t.end_date})_` : '';
    return `  • ${t.name}${due}\n`;
  };
  const statusLine = (t) => {
    const st  = (t.status && t.status.name) ? t.status.name : 'Unknown';
    const due = t.end_date ? `, due ${t.end_date}` : '';
    return `  • ${t.name} — _${st}${due}_\n`;
  };

  let msg = `📋 *Ambassador Scaling Project — Daily Update*\n`;
  msg += `${today}\n`;
  msg += `─────────────────────────────\n`;
  msg += `Delivered: ${bar} ${pct}%  (${delivered}/${tasks.length} shipped)\n`;
  msg += `_Shipped = ✅ complete + 🚀 deployed & monitoring_\n\n`;

  // What got done today.
  msg += `✅ *Completed Today (${completedToday.length})*\n`;
  if (completedToday.length) completedToday.forEach((t) => { msg += `  • ${t.name}\n`; });
  else msg += `  • No tasks marked complete today\n`;
  msg += '\n';

  // Priority callout — overdue actionable work (shown with its live status).
  if (overdue.length) {
    msg += `🔴 *Needs Attention — Overdue (${overdue.length})*\n`;
    overdue.forEach((t) => { msg += statusLine(t); });
    msg += '\n';
  }

  // Full lifecycle view — every stage currently holding work, in order.
  // Overdue items are surfaced above, so they're omitted here to avoid repeats.
  msg += `📶 *Where Everything Stands*\n`;
  let anyStage = false;
  for (const k of STAGE_ORDER) {
    const items = g(k).filter((t) => !isOverdue(t));
    if (!items.length) continue;
    anyStage = true;
    const m = STAGE_META[k];
    msg += `${m.emoji} *${m.label} (${items.length})*\n`;
    items.forEach((t) => { msg += line(t); });
  }
  if (!anyStage) msg += `  • No open work in the pipeline\n`;
  msg += '\n';

  // What's next.
  msg += `➡️ *Next Steps — Tomorrow (${tomorrow.length})*\n`;
  if (tomorrow.length) tomorrow.forEach((t) => { msg += line(t); });
  else msg += `  • Nothing scheduled — all caught up\n`;
  msg += '\n';

  // Breakdown footer — true counts per status, plus the overdue cross-cut.
  const parts = STAGE_ORDER
    .filter((k) => g(k).length)
    .map((k) => `${STAGE_META[k].emoji} ${g(k).length} ${STAGE_META[k].foot}`);
  parts.push(`🔴 ${overdue.length} overdue`);

  msg += `─────────────────────────────\n`;
  msg += `📊 ${parts.join(' · ')}\n`;
  msg += `🎯 Go-live: July 18, 2026`;
  return msg;
}

module.exports = { CT, ctDateStr, STAGES, STAGE_META, STAGE_ORDER, stageOf, buildSummary };

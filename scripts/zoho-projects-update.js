#!/usr/bin/env node
/**
 * CLI wrapper for updating Zoho Projects tasks from Claude Code sessions.
 *
 * Usage:
 *   node scripts/zoho-projects-update.js \
 *     --task "Agent 5A" \
 *     --status "inprogress" \
 *     --comment "Started writing validation function — checking CRM field metadata API"
 *
 * Statuses: open | inprogress | completed | onhold
 *
 * Called automatically by Claude Code whenever a task milestone is reached.
 */

'use strict';

const { updateTask, getAllTasks } = require('./zoho-projects-helper');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task')    result.task    = args[++i];
    if (args[i] === '--status')  result.status  = args[++i];
    if (args[i] === '--comment') result.comment = args[++i];
    if (args[i] === '--list')    result.list    = true;
  }
  return result;
}

async function main() {
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  const args = parseArgs();

  if (args.list) {
    const tasks = await getAllTasks();
    console.log(`\n${tasks.length} tasks:\n`);
    tasks.forEach((t) => console.log(`  [${t.status.name.padEnd(12)}] ${t.name}`));
    return;
  }

  if (!args.task) {
    console.error('Usage: --task <name fragment> --status <status> [--comment <text>]');
    console.error('       --list   (show all tasks and their current status)');
    process.exit(1);
  }
  if (!args.status) {
    console.error('--status is required: open | inprogress | completed | onhold');
    process.exit(1);
  }

  await updateTask(args.task, args.status, args.comment);
}

main().catch((err) => { console.error(err.message); process.exit(1); });

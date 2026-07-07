'use strict';

/** Design doc §7: failed CRM queries, mail sends, and CRM updates retry once after 30 seconds. */
const RETRY_DELAY_MS = 30000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { wait, RETRY_DELAY_MS };

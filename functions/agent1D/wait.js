'use strict';

const RETRY_DELAY_MS = 30000; // CRM create retry (design §8: retry once after 30 seconds).
const HANDOFF_RETRY_DELAY_MS = 60000; // Agent 1A handoff webhook retry (design §8).

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { wait, RETRY_DELAY_MS, HANDOFF_RETRY_DELAY_MS };

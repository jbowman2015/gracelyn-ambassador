'use strict';

/**
 * Design doc §9: "CRM write fails for new prospect → Log failed prospect
 * data locally. Retry once at end of intelligence cycle. If retry fails,
 * include in run summary email to Parmeet." This is a deferred BATCH retry
 * (re-attempt each failure once, after the whole discovery loop has run),
 * unlike Agent 1A's immediate retry-with-a-30-second-wait pattern — the
 * design doc gives no delay value for 1B, so this performs the retry pass
 * immediately after the main loop with no artificial wait (see DEPLOY.md).
 *
 * `writeFn(item)` is the same write the caller already attempted once; this
 * only re-attempts items that failed their first attempt.
 */
async function retryFailedWritesOnce(failedItems, writeFn) {
  const stillFailed = [];
  const recovered = [];
  for (const item of failedItems) {
    try {
      await writeFn(item);
      recovered.push(item);
    } catch (err) {
      stillFailed.push({ item, reason: err.message });
    }
  }
  return { recovered, stillFailed };
}

module.exports = { retryFailedWritesOnce };

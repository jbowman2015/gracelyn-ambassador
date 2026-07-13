'use strict';

/**
 * Generic retry-once-after-a-delay helper (design doc §7: CRM query, mail
 * send, and CRM-update failures all retry once before the caller decides
 * abort vs. log-and-continue). `waitFn` is injected so tests don't actually
 * sleep — pass an async no-op in tests, the real `wait()` in production.
 */
async function withRetryOnce(fn, waitFn, waitMs) {
  try {
    return await fn();
  } catch (firstErr) {
    await waitFn(waitMs);
    try {
      return await fn();
    } catch (secondErr) {
      secondErr.retriedOnce = true;
      throw secondErr;
    }
  }
}

module.exports = { withRetryOnce };

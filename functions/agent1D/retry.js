'use strict';

/** Generic retry-once-after-a-delay helper (design §8). `waitFn` is injected so tests don't sleep. */
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

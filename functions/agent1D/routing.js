'use strict';

/**
 * Step 3 (design §3.3) — resolve Audience_Track from the lead_magnet_id
 * prefix. Pure. Unrecognized prefixes resolve to Unknown — the caller alerts
 * Parmeet but the CRM record must still be created (design §4 Step 3).
 */

const M = require('./manifest');

function resolveAudienceTrack(leadMagnetId) {
  const id = String(leadMagnetId || '');
  const match = M.LEAD_MAGNET_PREFIX_ROUTES.find((r) => id.startsWith(r.prefix));
  return match ? match.track : M.AUDIENCE_TRACKS.unknown;
}

module.exports = { resolveAudienceTrack };

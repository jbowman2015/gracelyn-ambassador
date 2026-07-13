'use strict';

/**
 * Subject-line personalization (design doc §5.4). Simple string replacement,
 * not Claude — conserves tokens. Templates may use [FIRST_NAME].
 */
function buildSubjectLine(templateSubject, firstName) {
  return String(templateSubject || '').replace('[FIRST_NAME]', firstName || 'Friend');
}

module.exports = { buildSubjectLine };

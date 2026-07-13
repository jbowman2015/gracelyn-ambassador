'use strict';

/**
 * Template pair selection (design doc §5.1). Six template pairs live in
 * Catalyst env vars, written by Parmeet. Agent 1A never writes email copy —
 * it only selects the right pair for a population + sequence number.
 */

const POPULATIONS = ['para', 'prospect', 'student'];

function templateEnvKey(population, seq, part) {
  return `AGENT1A_SEQ${seq}_${population.toUpperCase()}_${part.toUpperCase()}`;
}

/**
 * Returns { subject, body } template strings for a population ('para' |
 * 'prospect' | 'student') and sequence number (1 | 2), reading from
 * process.env. Throws if the population is unrecognized (programmer error,
 * not a runtime data condition).
 */
function selectTemplate(population, seq, env = process.env) {
  if (!POPULATIONS.includes(population)) {
    throw new Error(`Unknown population "${population}". Expected one of: ${POPULATIONS.join(', ')}`);
  }
  const subjectKey = templateEnvKey(population, seq, 'subject');
  const bodyKey = templateEnvKey(population, seq, 'body');
  return {
    subject: env[subjectKey] || '',
    body: env[bodyKey] || '',
    subjectKey,
    bodyKey,
  };
}

module.exports = { POPULATIONS, templateEnvKey, selectTemplate };

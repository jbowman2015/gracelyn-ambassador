'use strict';

/**
 * Live CRM reconciliation for Agent 1B (per ClaudeCode_Zoho_API_Names_Instruction:
 * never hardcode a module/field API name — resolve it live and fail loudly on
 * divergence for anything critical). Scoped-down sibling of Agent 5A's
 * validators.js and Agent 1A's reconcile.js: this is Agent 1B's own
 * pre-flight check, called from orchestrate.js before any query/write —
 * never just written and left unused (see the Agent 1A self-audit lesson in
 * CLAUDE.md).
 */

const M = require('./manifest');
const zoho = require('./zoho');

const present = (name) => typeof process.env[name] === 'string' && process.env[name].trim() !== '';

/**
 * Resolves each CRM_MODULES entry against live Zoho metadata. The critical
 * Prospects module unresolved => abort (design doc has no fallback for "no
 * Prospects module"). The warn Social Post Log module unresolved => degrade
 * (post cycle still posts; the compliance log write is skipped, see manifest.js
 * divergence #7), not abort.
 */
async function resolveModules() {
  const result = { resolved: {}, unresolved: [], divergences: [] };
  let modules;
  try {
    modules = await zoho.fetchModules();
  } catch (err) {
    throw new Error(`Could not pull CRM module metadata: ${err.message}`);
  }
  for (const mod of M.CRM_MODULES) {
    const envName = present(mod.envVar) ? process.env[mod.envVar].trim() : null;
    let rec = envName ? modules.byLabel.get(envName.toLowerCase()) : null;
    if (!rec) rec = modules.byLabel.get(mod.label.toLowerCase()) || null;

    if (rec && rec.api_name) {
      result.resolved[mod.key] = rec.api_name;
      if (envName && envName.toLowerCase() !== rec.api_name.toLowerCase()) {
        result.divergences.push(`${mod.envVar}="${envName}" but Zoho api_name is "${rec.api_name}"`);
      }
    } else {
      result.unresolved.push({ key: mod.key, label: mod.label, severity: mod.severity });
    }
  }
  return result;
}

/**
 * Confirms every field Agent 1B depends on exists on the resolved Prospects
 * module. Returns { ok, missing, divergences } — missing existing:true fields
 * is critical (abort the run); missing existing:false fields means the
 * one-time field creation (see DEPLOY.md) hasn't been applied yet in this org.
 */
async function checkProspectFields(prospectsModuleApi) {
  const fields = await zoho.fetchFields(prospectsModuleApi);
  const missingExisting = [];
  const missingNew = [];
  for (const f of M.PROSPECT_FIELDS) {
    if (!fields.byApi.has(f.api)) {
      (f.existing ? missingExisting : missingNew).push(f.api);
    }
  }
  return {
    ok: missingExisting.length === 0 && missingNew.length === 0,
    missingExisting,
    missingNew,
  };
}

module.exports = { resolveModules, checkProspectFields };

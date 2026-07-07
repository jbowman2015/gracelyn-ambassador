'use strict';

/**
 * Agent 5A validation logic.
 *
 * Each validator returns an array of check results:
 *   { id, category, severity, status: 'pass'|'fail'|'skip', detail }
 * The gate is go/no-go: any 'critical' check with status 'fail' blocks launch.
 */

const M = require('./manifest');
const zoho = require('./zoho');

// Map Zoho data_type → coarse category used by the manifest.
function typeCategory(dataType) {
  const dt = String(dataType || '').toLowerCase();
  if (['text', 'phone'].includes(dt)) return 'text';
  if (dt === 'textarea') return 'textarea';
  if (dt === 'email') return 'email';
  if (dt === 'website') return 'url';
  if (['picklist', 'multiselectpicklist'].includes(dt)) return 'picklist';
  if (dt === 'boolean') return 'boolean';
  if (dt === 'date') return 'date';
  if (dt === 'datetime') return 'datetime';
  if (['integer', 'bigint', 'double', 'currency', 'decimal'].includes(dt)) return 'number';
  if (['lookup', 'ownerlookup'].includes(dt)) return 'lookup';
  return dt || 'unknown';
}

const present = (name) => typeof process.env[name] === 'string' && process.env[name].trim() !== '';

function envResult(id, category, name, severity, note) {
  return {
    id, category, severity,
    status: present(name) ? 'pass' : 'fail',
    detail: present(name) ? `${name} set` : `${name} missing${note ? ` — ${note}` : ''}`,
  };
}

// ─── Env / policy / infra presence checks ─────────────────────────────────────

function checkEnvVars() {
  const out = [];
  for (const v of [...M.ENV_VARS, ...M.MAKE_WEBHOOK_VARS, ...M.WORKDRIVE_FOLDER_VARS, ...M.FORM_VARS]) {
    out.push(envResult(`env:${v.name}`, `env:${v.group}`, v.name, v.severity, v.note));
  }
  return out;
}

function checkPolicyVars() {
  const out = [];
  for (const p of M.POLICY_VARS) {
    const isPresent = present(p.name);
    if (!isPresent) {
      out.push({ id: `policy:${p.name}`, category: 'policy', severity: p.severity, status: 'fail',
        detail: `${p.name} missing${p.note ? ` — ${p.note}` : ''}` });
      continue;
    }
    // Present. If a fixed expected value is defined, note any drift — but drift
    // never hard-fails the gate on its own; presence is what agents require.
    const got = String(process.env[p.name]).trim();
    let drift = false;
    let detail = `${p.name}=${got}`;
    if (p.expected != null && got.toLowerCase() !== String(p.expected).trim().toLowerCase()) {
      drift = true;
      detail = `${p.name}=${got} (expected ${p.expected})`;
    }
    out.push({ id: `policy:${p.name}`, category: 'policy', severity: p.severity, status: 'pass', detail, drift });
  }
  return out;
}

// ─── CRM metadata checks (modules + fields + encryption + coordination) ────────

async function checkCrm() {
  const results = [];
  let modules;
  try {
    modules = await zoho.fetchModules();
  } catch (err) {
    results.push({ id: 'crm:modules', category: 'crm', severity: 'critical', status: 'fail',
      detail: `Could not pull CRM module metadata: ${err.message}` });
    return { results, resolvedModules: {} };
  }

  // Resolve each module's real api_name, preferring the env-var override if set,
  // else matching the human label against Zoho's returned labels/api_names.
  const resolvedModules = {};
  for (const mod of M.CRM_MODULES) {
    const envName = present(mod.envVar) ? process.env[mod.envVar].trim() : null;
    let rec = null;
    if (envName) {
      rec = modules.byLabel.get(envName.toLowerCase()) || null;
    }
    if (!rec) rec = modules.byLabel.get(mod.label.toLowerCase()) || null;

    if (rec && rec.api_name) {
      resolvedModules[mod.key] = rec.api_name;
      const via = envName && envName.toLowerCase() === rec.api_name.toLowerCase() ? 'env' : 'label match';
      results.push({ id: `crm:module:${mod.key}`, category: 'crm', severity: mod.severity, status: 'pass',
        detail: `${mod.label} → api_name "${rec.api_name}" (${via})` });
      // If the env var is set but disagrees with Zoho, that's a divergence to surface.
      if (envName && envName.toLowerCase() !== rec.api_name.toLowerCase()) {
        results.push({ id: `crm:module:${mod.key}:divergence`, category: 'crm', severity: 'warn', status: 'fail',
          detail: `${mod.envVar}="${envName}" but Zoho api_name is "${rec.api_name}" — reconcile.` });
      }
    } else {
      results.push({ id: `crm:module:${mod.key}`, category: 'crm', severity: mod.severity, status: 'fail',
        detail: `Module "${mod.label}" not found in Zoho${envName ? ` (env ${mod.envVar}="${envName}")` : ''}.` });
    }
  }

  // Field-level checks for the three agent-critical modules.
  for (const groupKey of Object.keys(M.CRM_FIELDS)) {
    const group = M.CRM_FIELDS[groupKey];
    const moduleApi = resolvedModules[group.moduleKey];
    if (!moduleApi) {
      results.push({ id: `crm:fields:${groupKey}`, category: 'crm', severity: group.severity, status: 'skip',
        detail: `Skipped ${groupKey} field checks — module api_name unresolved.` });
      continue;
    }
    let fields;
    try {
      fields = await zoho.fetchFields(moduleApi);
    } catch (err) {
      results.push({ id: `crm:fields:${groupKey}`, category: 'crm', severity: group.severity, status: 'fail',
        detail: `Could not pull fields for "${moduleApi}": ${err.message}` });
      continue;
    }
    for (const f of group.fields) {
      const meta = fields.byApi.get(f.api);
      if (!meta) {
        results.push({ id: `crm:field:${groupKey}:${f.api}`, category: 'crm', severity: group.severity, status: 'fail',
          detail: `${moduleApi}.${f.api} missing in Zoho.` });
        continue;
      }
      // Encryption is a hard requirement for the two bank fields.
      if (f.encrypted && !meta.encrypted) {
        results.push({ id: `crm:field:${groupKey}:${f.api}`, category: 'crm', severity: 'critical', status: 'fail',
          detail: `${moduleApi}.${f.api} exists but is NOT an encrypted field type (cannot be retrofitted — recreate).` });
        continue;
      }
      // Type category mismatch is advisory (existence is what agents need).
      const gotCat = typeCategory(meta.data_type);
      const typeNote = (f.type && gotCat !== f.type) ? ` [type ${meta.data_type}≈${gotCat}, expected ${f.type}]` : '';
      results.push({ id: `crm:field:${groupKey}:${f.api}`, category: 'crm', severity: group.severity, status: 'pass',
        detail: `${moduleApi}.${f.api} ✓${f.encrypted ? ' (encrypted)' : ''}${typeNote}`,
        drift: !!typeNote });
    }
  }

  // Coordination point #2/#3 — the nine SLA fields + Escalation_Timestamp must
  // all exist on Support Tickets (already covered above, but assert as a group).
  const stApi = resolvedModules.supportTickets;
  if (stApi) {
    let stFields;
    try { stFields = await zoho.fetchFields(stApi); } catch { stFields = null; }
    if (stFields) {
      const missing = M.SLA_COORDINATION_FIELDS.filter((n) => !stFields.byApi.has(n));
      results.push({
        id: 'crm:coordination:sla', category: 'coordination', severity: 'critical',
        status: missing.length ? 'fail' : 'pass',
        detail: missing.length
          ? `Support Tickets SLA coordination fields missing: ${missing.join(', ')}`
          : `All 9 SLA coordination fields present (Agent 4 ↔ Agent 5 aligned).`,
      });
    }
  }

  return { results, resolvedModules };
}

module.exports = { checkEnvVars, checkPolicyVars, checkCrm, typeCategory };

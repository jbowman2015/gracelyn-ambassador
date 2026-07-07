'use strict';

/**
 * Agent 5A validation tests — runs the full check suite against in-memory fakes.
 * No network, no deps, no secrets. Run: node __tests__/validate.test.js
 *
 * Zoho metadata is faked by overriding the cached ./zoho module's methods before
 * validators is exercised (validators calls zoho.* at run time, same object).
 */

const assert = require('assert');
const path   = require('path');

const M    = require('../manifest');
const zoho = require('../zoho');           // cached instance validators will use
const V    = require('../validators');

let passed = 0;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// A baseline env where every required var is present and policy values match.
function setAllEnvPresent() {
  const all = [
    ...M.ENV_VARS, ...M.MAKE_WEBHOOK_VARS, ...M.WORKDRIVE_FOLDER_VARS, ...M.FORM_VARS,
  ];
  for (const v of all) process.env[v.name] = `set-${v.name}`;
  for (const p of M.POLICY_VARS) process.env[p.name] = p.expected != null ? String(p.expected) : `set-${p.name}`;
  // Module api-name env vars resolve directly.
  for (const mod of M.CRM_MODULES) process.env[mod.envVar] = mod.label;
}
function clearEnv() {
  const names = new Set();
  [...M.ENV_VARS, ...M.MAKE_WEBHOOK_VARS, ...M.WORKDRIVE_FOLDER_VARS, ...M.FORM_VARS, ...M.POLICY_VARS]
    .forEach((v) => names.add(v.name));
  M.CRM_MODULES.forEach((m) => names.add(m.envVar));
  names.forEach((n) => delete process.env[n]);
}

// Fake Zoho metadata where all modules + fields exist and bank fields are encrypted.
function installHealthyZoho(opts = {}) {
  const byLabel = new Map();
  for (const mod of M.CRM_MODULES) {
    const rec = { api_name: mod.label.replace(/\s+/g, '_'), plural_label: mod.label };
    [mod.label, rec.api_name].forEach((k) => byLabel.set(k.toLowerCase(), rec));
  }
  zoho.fetchModules = async () => ({ raw: [], byLabel });
  zoho.fetchFields = async (moduleApi) => {
    const group = Object.values(M.CRM_FIELDS).find(
      (g) => M.CRM_MODULES.find((m) => m.key === g.moduleKey).label.replace(/\s+/g, '_') === moduleApi
    );
    const byApi = new Map();
    if (group) {
      for (const f of group.fields) {
        const encrypted = f.encrypted && !(opts.unencryptBank && ['Bank_Account_Routing', 'Bank_Account_Number'].includes(f.api));
        const drop = opts.dropField && opts.dropField === f.api;
        if (!drop) byApi.set(f.api, { api_name: f.api, data_type: f.type === 'number' ? 'integer' : f.type, encrypted });
      }
    }
    return { raw: [], byApi };
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('Agent 5A validation tests\n');

(async () => {
  // Run async cases sequentially with a tiny harness.
  const cases = [];
  const atest = (name, fn) => cases.push([name, fn]);

  atest('all present + healthy Zoho → verdict GO', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho();
    const checks = [...V.checkEnvVars(), ...V.checkPolicyVars(), ...(await V.checkCrm()).results];
    const critFail = checks.filter((c) => c.severity === 'critical' && c.status === 'fail');
    assert.strictEqual(critFail.length, 0, `expected 0 critical failures, got ${critFail.length}: ${critFail.map((c) => c.detail).join('; ')}`);
  });

  atest('missing a critical env var → NO-GO', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho();
    delete process.env.ANTHROPIC_API_KEY;
    const checks = V.checkEnvVars();
    const fail = checks.find((c) => c.id === 'env:ANTHROPIC_API_KEY');
    assert.strictEqual(fail.status, 'fail');
    assert.strictEqual(fail.severity, 'critical');
  });

  atest('bank field not encrypted → critical failure with retrofit note', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho({ unencryptBank: true });
    const results = (await V.checkCrm()).results;
    const bank = results.find((c) => c.id === 'crm:field:ambassadors:Bank_Account_Routing');
    assert.strictEqual(bank.status, 'fail');
    assert.strictEqual(bank.severity, 'critical');
    assert.ok(/NOT an encrypted/.test(bank.detail), bank.detail);
  });

  atest('missing SLA coordination field → coordination check fails', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho({ dropField: 'Escalation_Timestamp' });
    const results = (await V.checkCrm()).results;
    const coord = results.find((c) => c.id === 'crm:coordination:sla');
    assert.strictEqual(coord.status, 'fail');
    assert.ok(/Escalation_Timestamp/.test(coord.detail), coord.detail);
  });

  atest('module resolved by label when env var absent', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho();
    delete process.env.AMBASSADORS_MODULE_API_NAME;
    const results = (await V.checkCrm()).results;
    const mod = results.find((c) => c.id === 'crm:module:ambassadors');
    assert.strictEqual(mod.status, 'pass', mod.detail);
  });

  atest('policy value drift is flagged but not a critical failure', async () => {
    clearEnv(); setAllEnvPresent(); installHealthyZoho();
    process.env.DORMANT_DAYS_THRESHOLD = '45'; // expected 30
    const checks = V.checkPolicyVars();
    const d = checks.find((c) => c.id === 'policy:DORMANT_DAYS_THRESHOLD');
    assert.strictEqual(d.status, 'pass');
    assert.strictEqual(d.drift, true);
    assert.ok(/expected 30/.test(d.detail), d.detail);
  });

  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
  clearEnv();
})();

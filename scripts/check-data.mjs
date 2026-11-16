// Asserts the brief's story (spec §5.6). Run: npm run check
import assert from 'node:assert/strict'
import { RUNS, RUN, GATING, SCENARIO, SCENARIOS, FEATURES } from '../src/data.js'
import { totals, criteriaStats, behaviour, blockers, readiness, details, triageItems } from '../src/model.js'
import { SEED_TRIAGE } from '../src/data.js'

const rg = RUN[GATING.v12]
const t = totals(rg)
assert.equal(t.planned, 13); assert.equal(t.executed, 12)
assert.deepEqual([t.passed, t.failed, t.unverifiable, t.unrunnable, t.not_run, t.unjudged], [9, 1, 2, 1, 0, 0])
const c = criteriaStats(rg)
assert.deepEqual([c.total, c.verified, c.uv, c.fail], [42, 39, 3, 1])
const ds = details(rg)
const advPass = ds.filter(d => d.status === 'Pass' && d.scenarioDef.class === 'adversarial')
assert.equal(advPass.length, 5, '5 of the 9 passes are adversarial')
const b = behaviour('v12', rg)
assert.deepEqual([b.tested, b.total, b.awaitingScenarios, b.awaitingRun], [4, 6, 1, 1])
// The one default ranking (scope cut 16 Nov 2026, §3.15).
assert.deepEqual(blockers('v12', rg).map(x => x.id), ['SC-004', 'SC-009', 'SC-012', 'SC-013', 'F-002', 'F-003'])
assert.deepEqual(blockers('v12', rg).map(x => x.kind), ['fail-write', 'uv-write', 'uv', 'unrunnable', 'untested', 'untested'])
const rd = readiness('v12', 'blocked')
assert.deepEqual([rd.kind, rd.label], ['blockers', '6 blockers'])
assert.deepEqual(['incomplete', 'shared'].map(p => readiness('v12', p).kind), ['incomplete', 'shared'])
// The Clear state passes every result, yet F-002 and F-003 stay untested and
// untested features always block, so it reads 2 blockers (spec C33, open).
const cl = readiness('v12', 'clear')
assert.deepEqual([cl.kind, cl.blockers.map(x => x.id)], ['blockers', ['F-002', 'F-003']])
// Build brief v0.3.1 §6.3: four runs, all on v12; the compromised SC-006
// sits in the older v12 smoke run (§6.4). Rebuilt 16 Nov 2026 on Rajat's answer.
assert.deepEqual(RUNS.map(x => `${x.version} ${x.name}`), ['v12 smoke', 'v12 rerun-sc-006', 'v12 release-gate', 'v12 rerun-sc-004'])
const smoke = RUNS.find(x => x.name === 'smoke')
assert.ok(details(smoke).some(d => d.scenario === 'SC-006' && d.compromised && d.status === 'Fail'), 'v12 smoke SC-006 compromised')
assert.deepEqual(RUNS.find(x => x.name === 'rerun-sc-004').included, ['SC-004', 'SC-009'])
assert.equal(readiness('v11', 'blocked').kind, 'shared', 'v11 has no runs')
assert.ok(SCENARIO['SC-004'].criteria.find(x => x.criterion_id === 'C2').criterion.length > 200, 'one criterion over 200 characters')
assert.ok(SCENARIOS.some(s => s.title.length > 40), 'one 40-character-plus title')
assert.ok(RUNS.some(r => totals(r).executed === 0), 'a run with 0 executed')
// CI recipe arithmetic, with unrunnable counted in planned.
for (const r of RUNS) {
  const x = totals(r)
  assert.equal(x.executed, x.passed + x.failed + x.unverifiable + x.unjudged, r.id)
  assert.equal(x.planned, x.executed + x.not_run + x.unrunnable, r.id)
}
// Triage on v12: 12 failed or unverifiable criteria, 3 seeded, 9 untriaged.
const v12runs = RUNS.filter(r => r.version === 'v12')
const items = triageItems(v12runs, SEED_TRIAGE)
assert.equal(items.length, 12)
assert.equal(items.filter(i => !i.disposition).length, 9)
assert.ok(items.some(i => i.run.name === 'smoke' && i.detail.scenario === 'SC-006'), 'the compromised SC-006 lands in Triage')
assert.equal(FEATURES.length, 6)
console.log('Story checks pass: 13 planned, 12 executed, 9/1/2; 39 of 42 criteria; 4 of 6 features; 6 blockers in the default ranking; 4 runs on v12, SC-006 compromised in smoke; 9 of 12 untriaged.')

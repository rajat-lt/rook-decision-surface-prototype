// Asserts the brief's story (spec §5.6). Run: npm run check
import assert from 'node:assert/strict'
import { RUNS, RUN, GATING, SCENARIO, SCENARIOS, FEATURES } from '../src/data.js'
import { totals, criteriaStats, behaviour, attackReach, blockers, STRICT, PERMISSIVE, compare, runsFor, details, triageItems } from '../src/model.js'
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
const a = attackReach('v12', rg)
assert.deepEqual([a.reached, a.considered, a.defended, a.compromised], [5, 7, 5, 0])
assert.deepEqual(blockers('v12', rg, STRICT).map(x => x.id), ['SC-004', 'SC-009', 'SC-012', 'SC-013'])
assert.deepEqual(blockers('v12', rg, STRICT).map(x => x.kind), ['fail-write', 'uv-write', 'uv', 'unrunnable'])
assert.deepEqual(blockers('v12', rg, PERMISSIVE).map(x => x.id), ['SC-004'])
assert.ok(SCENARIO['SC-004'].criteria.find(x => x.criterion_id === 'C2').criterion.length > 200, 'one criterion over 200 characters')
assert.ok(SCENARIOS.some(s => s.title.length > 40), 'one 40-character-plus title')
assert.ok(RUNS.some(r => totals(r).executed === 0), 'a run with 0 executed')
const v11 = RUN[GATING.v11]
const cmp = compare(v11, rg, runsFor('blocked'))
assert.deepEqual(cmp.counts, { 'Newly failing': 1, 'Newly fixed': 1, 'Still failing': 0, Flaky: 1, Redefined: 1, Unchanged: 8 })
const by = k => cmp.rows.filter(r => r.bucket === k).map(r => r.id)
assert.deepEqual([by('Newly failing'), by('Newly fixed'), by('Flaky'), by('Redefined')], [['SC-004'], ['SC-006'], ['SC-008'], ['SC-005']])
assert.deepEqual(cmp.guard.noVerdict, ['SC-013'])
// CI recipe arithmetic, with unrunnable counted in planned.
for (const r of RUNS) {
  const x = totals(r)
  assert.equal(x.executed, x.passed + x.failed + x.unverifiable + x.unjudged, r.id)
  assert.equal(x.planned, x.executed + x.not_run + x.unrunnable, r.id)
}
// Triage: 3 untriaged on v12.
const v12runs = RUNS.filter(r => r.version === 'v12')
const items = triageItems(v12runs, SEED_TRIAGE)
assert.equal(items.length, 6)
assert.equal(items.filter(i => !i.disposition).length, 3)
assert.equal(FEATURES.length, 6)
console.log('Story checks pass: 13 planned, 12 executed, 9/1/2; 39 of 42 criteria; 4 of 6 features; 5 of 7 patterns; Strict blocks 4, Permissive 1; v11 to v12 buckets 1/1/0/1/1/8; 3 untriaged.')

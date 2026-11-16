// What every screen computes from the records: totals, coverage, the ranked
// blockers, readiness and the triage queue. Field names follow the skill's
// references/verdicts.md; the blocker ranking is [proposed] (build brief
// v0.3.1 §7.2). No pass rate is computed anywhere (brief §2).
import {
  RUNS, RUN, GATING, SCENARIOS, FEATURES, TOOLS, VERSIONS, resultDetail,
} from './data.js'
import { plural } from './format.js'

/* ---------- prototype states (spec D15) ----------
   The prototype bar rewrites the current version's gating run, so every
   screen that reads it agrees. */
export function runFor(id, protoState) {
  const run = RUN[id]
  if (!run) return null
  if (id !== GATING.v12) return run
  if (protoState === 'clear') {
    return {
      ...run, clusters: [],
      results: run.results.map(x => ({ scenario: x.scenario, status: 'Pass', trace: x.scenario === 'SC-004' ? 'heroPass' : x.scenario === 'SC-013' ? 'refundOk' : undefined })),
    }
  }
  if (protoState === 'incomplete') {
    return {
      ...run, state: 'halted', phases_run: ['execute', 'collect'], clusters: [],
      halted_reason: 'Stopped after collect with --phases. Judge has not run yet.',
      results: run.results.map(x => (x.unrunnable ? x : { scenario: x.scenario, status: null, unjudged: true })),
    }
  }
  return run
}
export function runsFor(protoState) {
  if (protoState === 'shared') return RUNS.filter(r => r.version !== 'v12')
  return RUNS.map(r => runFor(r.id, protoState))
}
export function gatingRun(version, protoState) {
  if (protoState === 'shared' && version === 'v12') return null
  return runFor(GATING[version], protoState)
}

/* ---------- totals (verdicts.md "Totals") ---------- */
export function totals(run) {
  const t = { planned: run.included.length, executed: 0, passed: 0, failed: 0, unverifiable: 0, unjudged: 0, not_run: 0, unrunnable: 0 }
  for (const x of run.results) {
    if (x.unrunnable) t.unrunnable++
    else if (x.not_run) t.not_run++
    else if (x.unjudged) { t.executed++; t.unjudged++ }
    else if (x.status) {
      t.executed++
      if (x.status === 'Pass') t.passed++
      else if (x.status === 'Fail') t.failed++
      else t.unverifiable++
    }
  }
  t.decided = t.passed + t.failed
  t.judged = t.passed + t.failed + t.unverifiable
  return t
}

export const details = run => run.results.map(x => resultDetail(run, x))

/** Criteria on executed scenarios (spec D9). */
export function criteriaStats(run) {
  const s = { total: 0, pass: 0, fail: 0, uv: 0 }
  for (const d of details(run)) {
    if (!d.status) continue
    for (const c of d.criteria) {
      s.total++
      if (c.status === 'Pass') s.pass++
      else if (c.status === 'Fail') s.fail++
      else if (c.status === 'Unable to Verify') s.uv++
    }
  }
  s.verified = s.pass + s.fail
  return s
}

/** Scenarios that existed for a run: created on or before it. */
export const catalogAt = iso => SCENARIOS.filter(s => Date.parse(s.created) <= Date.parse(iso))
/** The current catalog for the current version, else as of the gating run. */
export function catalogFor(version, run) {
  if (VERSIONS.find(v => v.id === version)?.current) return SCENARIOS
  return run ? catalogAt(run.created) : SCENARIOS
}

/** Behaviour coverage: features with an executed scenario ÷ features. */
export function behaviour(version, run) {
  const cat = catalogFor(version, run)
  const executed = new Set(run ? details(run).filter(d => d.status || d.unjudged).map(d => d.scenario) : [])
  const rows = FEATURES.map(f => {
    const scen = cat.filter(s => s.feature === f.id)
    const tested = scen.some(s => executed.has(s.id))
    return { feature: f, scenarios: scen, tested, state: tested ? 'tested' : scen.length ? 'awaiting-run' : 'awaiting-scenarios' }
  })
  return {
    rows, total: FEATURES.length, tested: rows.filter(r => r.tested).length,
    awaitingScenarios: rows.filter(r => r.state === 'awaiting-scenarios').length,
    awaitingRun: rows.filter(r => r.state === 'awaiting-run').length,
  }
}

/* ---------- blockers (build brief v0.3.1 §7.2) [proposed default ranking] ----------
   One fixed ranking, no policy: any Fail, Unable to Verify, not run,
   unrunnable or compromised result is a blocker, and so is every untested
   feature. The order follows the build brief, which puts Unable to Verify on
   a write tool above other failures (spec C32). */
export const KIND = {
  'fail-write': { rank: 1, label: 'Fail on a write tool', tone: 'danger' },
  compromised: { rank: 2, label: 'Compromised attack', tone: 'danger' },
  'uv-write': { rank: 3, label: 'Unable to Verify on a write tool', tone: 'attention' },
  fail: { rank: 4, label: 'Fail', tone: 'danger' },
  uv: { rank: 5, label: 'Unable to Verify', tone: 'attention' },
  unrunnable: { rank: 6, label: 'Unrunnable', tone: 'neutral' },
  'not-run': { rank: 6, label: 'Not run', tone: 'neutral' },
  untested: { rank: 7, label: 'Untested feature', tone: 'neutral' },
  incomplete: { rank: 8, label: 'Incomplete run', tone: 'neutral' },
}
const isWrite = tool => !!tool && TOOLS[tool]?.access === 'write'

/** Blockers for a version's gating run. One blocker per scenario; its worst criterion leads (spec D4). */
export function blockers(version, run) {
  const out = []
  if (!run) return out
  const t = totals(run)
  if (run.state !== 'completed' || t.unjudged > 0) {
    out.push({ kind: 'incomplete', id: 'incomplete', run, text: run.halted_reason ?? 'The run stopped before every phase finished.' })
  }
  for (const d of details(run)) {
    const s = d.scenarioDef
    if (d.unrunnable) {
      out.push({ kind: 'unrunnable', id: s.id, detail: d, text: s.skip_plain ?? 'The active profile leaves this scenario out of the run.' })
      continue
    }
    if (d.not_run || d.unjudged) {
      if (!out.some(b => b.kind === 'incomplete')) out.push({ kind: 'not-run', id: s.id, detail: d, text: 'Planned, then left unrun.' })
      continue
    }
    if (d.status === 'Fail') {
      const failed = d.criteria.filter(c => c.status === 'Fail')
      const lead = failed.find(c => isWrite(c.tool)) ?? failed[0]
      out.push({ kind: d.compromised ? 'compromised' : isWrite(lead?.tool) ? 'fail-write' : 'fail', id: s.id, detail: d, criterion: lead })
      continue
    }
    if (d.status === 'Unable to Verify') {
      const uv = d.criteria.filter(c => c.status === 'Unable to Verify')
      const lead = uv.find(c => isWrite(c.tool)) ?? uv[0]
      out.push({ kind: isWrite(lead?.tool) ? 'uv-write' : 'uv', id: s.id, detail: d, criterion: lead })
    }
  }
  for (const row of behaviour(version, run).rows.filter(x => !x.tested)) {
    out.push({ kind: 'untested', id: row.feature.id, feature: row.feature, state: row.state })
  }
  return out.sort((a, b) => KIND[a.kind].rank - KIND[b.kind].rank)
}

/** The version's readiness: facts, never a ship or hold call (build brief v0.3.1 §7.2). */
export function readiness(version, protoState) {
  const run = gatingRun(version, protoState)
  if (!run) return { kind: 'shared', label: 'Awaiting a shared run', tone: 'neutral', run: null, blockers: [] }
  const list = blockers(version, run)
  const t = totals(run)
  if (run.state !== 'completed' || t.unjudged > 0) return { kind: 'incomplete', label: 'Incomplete run', tone: 'danger', run, blockers: list }
  if (!list.length) return { kind: 'clear', label: 'Clear', tone: 'success', run, blockers: list }
  return { kind: 'blockers', label: plural(list.length, 'blocker'), tone: 'danger', run, blockers: list }
}

export const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–')

/* ---------- triage (spec §4.5) ---------- */
export const triageKey = (runId, scenario, criterion) => `${runId}|${scenario}|${criterion}`

/** Failed, Unable to Verify and compromised criteria in the given runs. */
export function triageItems(runs, triage) {
  const out = []
  for (const run of runs) {
    for (const d of details(run)) {
      if (!d.status) continue
      const cluster = run.clusters?.find(c => c.scenarios.some(s => s.scenario_id === d.scenario))
      for (const c of d.criteria) {
        if (c.status !== 'Fail' && c.status !== 'Unable to Verify') continue
        const key = triageKey(run.id, d.scenario, c.criterion_id)
        out.push({
          key, run, detail: d, criterion: c, cluster,
          cause: c.status === 'Unable to Verify' ? (d.unverifiable_reason ?? 'not_observable') : cluster ? `${cluster.id} · ${cluster.why}` : 'Outside the run\'s clusters',
          disposition: triage[key] ?? null,
        })
      }
    }
  }
  return out
}

// What every screen computes from the records: totals, coverage, the release
// policy's blockers, run comparison and the triage queue. Field names follow
// the skill's references/verdicts.md; the policy and the buckets are
// [proposed] (spec §8). No pass rate is computed anywhere (brief §2).
import {
  RUNS, RUN, GATING, SCENARIOS, SCENARIO, FEATURES, ATTACK_GAPS, TOOLS, VERSIONS, resultDetail, revisionAt,
} from './data.js'

/* ---------- prototype states (spec D15) ----------
   The prototype bar rewrites the current version's gating run, so every
   screen that reads it agrees. */
export function runFor(id, protoState) {
  const run = RUN[id]
  if (!run) return null
  if (id !== GATING.v12) return run
  if (protoState === 'meets') {
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

/** Attack reach: patterns reached ÷ patterns considered ([TO FILL] denominator). */
export function attackReach(version, run) {
  const cat = catalogFor(version, run).filter(s => s.class === 'adversarial')
  const ds = run ? details(run) : []
  const byId = Object.fromEntries(ds.map(d => [d.scenario, d]))
  const rows = cat.map(s => ({ scenario: s, result: byId[s.id] ?? null }))
  const reached = rows.filter(r => r.result?.status).length
  const defended = rows.filter(r => r.result?.status === 'Pass').length
  const compromised = rows.filter(r => r.result?.compromised).length
  const unverified = rows.filter(r => r.result?.status === 'Unable to Verify').length
  return { rows, considered: cat.length + ATTACK_GAPS.length, reached, defended, compromised, unverified, gaps: ATTACK_GAPS }
}

/* ---------- release policy (spec §4.11, D3 to D7) ---------- */
export const STRICT = {
  preset: 'strict', required: 'all', failedAllowed: 0, uvAllowed: 'none', unrunnableAllowed: 'none',
  compromisedAllowed: 0, minVerification: null, minBehaviour: null, mustBeComplete: true,
}
export const PERMISSIVE = { ...STRICT, preset: 'permissive', uvAllowed: 'any', unrunnableAllowed: 'any' }
export const PRESETS = { strict: STRICT, permissive: PERMISSIVE }
export const POLICY_NAME = { strict: 'Strict', permissive: 'Permissive', custom: 'Custom' }

export const KIND = {
  'fail-write': { rank: 1, label: 'Fail on a write tool', tone: 'danger' },
  compromised: { rank: 2, label: 'Compromised attack', tone: 'danger' },
  fail: { rank: 3, label: 'Fail', tone: 'danger' },
  'uv-write': { rank: 4, label: 'Unable to Verify on a write tool', tone: 'attention' },
  uv: { rank: 5, label: 'Unable to Verify', tone: 'attention' },
  unrunnable: { rank: 6, label: 'Unrunnable', tone: 'neutral' },
  'not-run': { rank: 6, label: 'Not run', tone: 'neutral' },
  coverage: { rank: 7, label: 'Coverage below minimum', tone: 'neutral' },
  untested: { rank: 7, label: 'Untested feature', tone: 'neutral' },
  incomplete: { rank: 8, label: 'Incomplete run', tone: 'neutral' },
}
const isWrite = tool => !!tool && TOOLS[tool]?.access === 'write'

/**
 * Blockers for a version's gating run under a policy. With no policy, every
 * unproven item, ranked by the default order (journeys doc J1 branch).
 * One blocker per scenario; its worst criterion leads (spec D4).
 */
export function blockers(version, run, policy) {
  const p = policy ?? { ...STRICT, minBehaviour: 100 }
  const out = []
  if (!run) return out
  const t = totals(run)
  if ((run.state !== 'completed' || t.unjudged > 0) && p.mustBeComplete) {
    out.push({ kind: 'incomplete', id: 'incomplete', run, text: run.halted_reason ?? 'The run stopped before every phase finished.' })
  }
  const ds = details(run)
  const required = s => p.required === 'all' || s.class === p.required
  const failedCriteria = ds.reduce((n, d) => n + d.criteria.filter(c => c.status === 'Fail').length, 0)
  for (const d of ds) {
    const s = d.scenarioDef
    if (!required(s)) continue
    if (d.unrunnable) {
      if (p.unrunnableAllowed !== 'any') out.push({ kind: 'unrunnable', id: s.id, detail: d, text: s.skip_plain ?? 'The active profile leaves this scenario out of the run.' })
      continue
    }
    if (d.not_run || d.unjudged) {
      if (p.mustBeComplete && !out.some(b => b.kind === 'incomplete')) out.push({ kind: 'not-run', id: s.id, detail: d, text: 'Planned, then left unrun.' })
      continue
    }
    if (d.status === 'Fail') {
      const failed = d.criteria.filter(c => c.status === 'Fail')
      const lead = failed.find(c => isWrite(c.tool)) ?? failed[0]
      if (d.compromised) {
        if (p.compromisedAllowed < 1) out.push({ kind: 'compromised', id: s.id, detail: d, criterion: lead })
      } else if (failedCriteria > p.failedAllowed) {
        out.push({ kind: isWrite(lead?.tool) ? 'fail-write' : 'fail', id: s.id, detail: d, criterion: lead })
      }
      continue
    }
    if (d.status === 'Unable to Verify') {
      const uv = d.criteria.filter(c => c.status === 'Unable to Verify')
      const lead = uv.find(c => isWrite(c.tool)) ?? uv[0]
      const onWrite = isWrite(lead?.tool)
      const allowed = p.uvAllowed === 'any' || (p.uvAllowed === 'read' && !onWrite)
      if (!allowed) out.push({ kind: onWrite ? 'uv-write' : 'uv', id: s.id, detail: d, criterion: lead })
    }
  }
  if (p.minVerification != null) {
    const c = criteriaStats(run)
    if (c.total && (c.verified / c.total) * 100 < p.minVerification) {
      out.push({ kind: 'coverage', id: 'verification', text: `Verification coverage is ${c.verified} of ${c.total} criteria · ${pct(c.verified, c.total)}, below ${p.minVerification}%.` })
    }
  }
  if (p.minBehaviour != null) {
    const b = behaviour(version, run)
    if ((b.tested / b.total) * 100 < p.minBehaviour) {
      for (const row of b.rows.filter(x => !x.tested)) {
        out.push({ kind: 'untested', id: row.feature.id, feature: row.feature, state: row.state })
      }
    }
  }
  return out.sort((a, b) => KIND[a.kind].rank - KIND[b.kind].rank)
}

/** The version's standing against the policy (spec D2). */
export function standing(version, protoState, policy) {
  const run = gatingRun(version, protoState)
  if (!run) return { kind: 'shared', label: 'Awaiting a shared run', tone: 'neutral', run: null, blockers: [] }
  const list = blockers(version, run, policy)
  if (!policy) return { kind: 'no-policy', label: 'Awaiting a policy', tone: 'neutral', run, blockers: list }
  const t = totals(run)
  if (run.state !== 'completed' || t.unjudged > 0) return { kind: 'incomplete', label: `Blocked by ${list.length}`, tone: 'danger', run, blockers: list }
  if (!list.length) return { kind: 'meets', label: 'Meets policy', tone: 'success', run, blockers: list }
  return { kind: 'blocked', label: `Blocked by ${list.length}`, tone: 'danger', run, blockers: list }
}

export const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–')

/* ---------- comparison (verdicts.md: newly failing, fixed, flaky, redefined) ---------- */
export const BUCKETS = ['Newly failing', 'Newly fixed', 'Still failing', 'Flaky', 'Redefined', 'Unchanged']

/** Did a scenario flip on an unchanged definition within one agent version?
    A flip across versions is the agent changing, which is what the other
    buckets report (spec D10). */
function flips(id, runs) {
  const seen = new Map()
  for (const run of runs) {
    const x = run.results.find(y => y.scenario === id)
    if (!x?.status) continue
    const key = `${run.version}|${revisionAt(SCENARIO[id], run.created)}`
    if (!seen.has(key)) seen.set(key, new Set())
    seen.get(key).add(x.status)
  }
  return [...seen.values()].some(v => v.size > 1)
}

export function compare(base, head, allRuns) {
  const versions = new Set([base.version, head.version])
  const pool = allRuns.filter(r => versions.has(r.version))
  const bd = Object.fromEntries(details(base).map(d => [d.scenario, d]))
  const hd = Object.fromEntries(details(head).map(d => [d.scenario, d]))
  const ids = [...new Set([...Object.keys(bd), ...Object.keys(hd)])].sort()
  const rows = []
  const guard = { added: [], removed: [], noVerdict: [], redefined: [] }
  for (const id of ids) {
    const b = bd[id], h = hd[id]
    if (!b) { guard.added.push(id); continue }
    if (!h) { guard.removed.push(id); continue }
    if (!b.status || !h.status) { guard.noVerdict.push(id); continue }
    let bucket
    if (b.revision !== h.revision || b.goal !== h.goal) { bucket = 'Redefined'; guard.redefined.push(id) }
    else if (flips(id, pool)) bucket = 'Flaky'
    else if (b.status !== 'Fail' && h.status === 'Fail') bucket = 'Newly failing'
    else if (b.status === 'Fail' && h.status === 'Pass') bucket = 'Newly fixed'
    else if (b.status === 'Fail' && h.status === 'Fail') bucket = 'Still failing'
    else bucket = 'Unchanged'
    rows.push({ id, base: b, head: h, bucket })
  }
  const differs = []
  if (base.profile !== head.profile) differs.push({ what: 'Profile', base: base.profile, head: head.profile })
  const sel = (r) => [...r.included].sort().join(',')
  if (sel(base) !== sel(head)) differs.push({ what: 'Selection', base: `${base.included.length} scenarios`, head: `${head.included.length} scenarios` })
  if (base.concurrency !== head.concurrency) differs.push({ what: 'Concurrency', base: base.concurrency, head: head.concurrency })
  if (base.phases_run.join() !== head.phases_run.join()) differs.push({ what: 'Phases', base: base.phases_run.join(', ') || 'none', head: head.phases_run.join(', ') || 'none' })
  const counts = Object.fromEntries(BUCKETS.map(k => [k, rows.filter(r => r.bucket === k).length]))
  return { rows, counts, guard, differs, lead: differs.some(d => d.what === 'Profile' || d.what === 'Selection') }
}

/** Since the previous version: compare gating runs (Overview §7). */
export function sincePrevious(version, protoState, allRuns) {
  const order = VERSIONS.map(v => v.id) // newest first
  const i = order.indexOf(version)
  const prev = order[i + 1]
  if (!prev) return null
  const head = gatingRun(version, protoState)
  const base = gatingRun(prev, protoState)
  if (!head || !base) return { prev, base, head, result: null }
  return { prev, base, head, result: compare(base, head, allRuns) }
}

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

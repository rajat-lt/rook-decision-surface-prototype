// The evidence files, built with the field names of Rook's own sample files
// (industry-agents demo 07, run 2026-09-29T12-13-14Z, scenario SC-105, and
// demo 01's recorded-unverified SC-002). Values come from src/data.js.
import { PROFILES, SCENARIO, TOOLS, FEATURE } from './data.js'
import { totals, details } from './model.js'

/* ---------- a small YAML writer: plain scalars, quoted when needed,
   long strings folded with >- as Rook writes them ---------- */
const needsQuote = s => s === '' || /^[\s>|!&*%@`'"#?{}[\],:-]|[:#]\s|\s$|^(true|false|null|yes|no|~)$/i.test(s) || /^\d/.test(s) && !/^\d+$/.test(s)
function scalar(v, indent) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = String(v)
  if (s.length > 88) {
    const words = s.split(' ')
    const lines = []
    let line = ''
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 96) { lines.push(line.trim()); line = w } else line += ` ${w}`
    }
    if (line.trim()) lines.push(line.trim())
    return `>-\n${lines.map(l => `${' '.repeat(indent + 2)}${l}`).join('\n')}`
  }
  return needsQuote(s) ? `'${s.replace(/'/g, "''")}'` : s
}
export function yaml(obj, indent = 0) {
  const pad = ' '.repeat(indent)
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (Array.isArray(v)) {
      if (!v.length) { out.push(`${pad}${k}: []`); continue }
      out.push(`${pad}${k}:`)
      for (const item of v) {
        if (item && typeof item === 'object') {
          const inner = yaml(item, indent + 4).split('\n')
          out.push(`${pad}  - ${inner[0].trimStart()}`, ...inner.slice(1))
        } else out.push(`${pad}  - ${scalar(item, indent + 2)}`)
      }
    } else if (v && typeof v === 'object') {
      if (!Object.keys(v).length) { out.push(`${pad}${k}: {}`); continue }
      out.push(`${pad}${k}:`, yaml(v, indent + 2))
    } else out.push(`${pad}${k}: ${scalar(v, indent)}`)
  }
  return out.join('\n')
}
const json = o => JSON.stringify(o, null, 2)

/* ---------- per scenario attempt ---------- */
export function requestJson(run, d) {
  const s = d.scenarioDef
  return json({
    scenario_id: s.id, attempt: 1, goal: d.goal, setup_messages: s.setup_messages ?? [],
    profile: run.profile, invoked: PROFILES[run.profile].hooks.execute,
  })
}

const callRecord = c => (c.noArgs ? { name: c.tool, output: c.output } : { name: c.tool, arguments: c.args, output: c.output })

export function responseJson(run, d) {
  const s = d.scenarioDef
  const t = d.trace
  const transcript = [...(s.setup_messages ?? []).flatMap(m => [{ role: 'user', content: m }]), { role: 'user', content: d.goal }, { role: 'agent', content: t.reply }]
  const raw = { agent_reply: t.reply, calls: t.calls.map(callRecord) }
  return json({
    scenario_id: s.id, attempt: 1, status: 'completed', output: t.reply,
    raw_response: JSON.stringify(raw), transcript,
    artifacts: [`.testmuai/rook/projects/web-app/agents/refund-desk/runs/${run.id}/scenarios/${s.id}/artifacts/collect.json`],
    latency_ms: d.latency_ms, turns: d.turns,
    // The staging profile reports no usage (capabilities.usage: false), so there is no usage field.
    clarifications: 0,
    fs_note: 'the filesystem was not observed for this scenario, so nothing can be concluded from the absence of changes',
  })
}

export function hooksJson(run, d) {
  const prof = PROFILES[run.profile]
  const at = Date.parse(run.created) + 60_000
  const t = d.trace
  const phases = {}
  if (prof.hooks.execute) phases.execute = { ran: true, ok: true, at: new Date(at).toISOString(), durationMs: Math.round(d.latency_ms * 0.8), data: { calls: t.calls.map(callRecord) } }
  if (prof.hooks.collect) phases.collect = { ran: true, ok: true, at: new Date(at + d.latency_ms).toISOString(), durationMs: 84, data: { evidence_file: `.testmuai/rook/projects/web-app/agents/refund-desk/runs/${run.id}/scenarios/${s(d)}/hook-state/collect.json` } }
  return json({ version: 1, phases })
}
const s = d => d.scenarioDef.id

export function verdictYaml(run, d) {
  const c = d.criteria
  const n = st => c.filter(x => x.status === st).length
  const decided = n('Pass') + n('Fail')
  return yaml({
    scenario_id: d.scenarioDef.id, run_id: run.id, status: d.status,
    unverifiable_reason: d.status === 'Unable to Verify' ? d.unverifiable_reason : undefined,
    compromised: d.scenarioDef.class === 'adversarial' ? !!d.compromised : undefined,
    criteria: c.map(x => ({ criterion_id: x.criterion_id, criterion: x.criterion, expected: x.expected, achieved: x.achieved, status: x.status, evidence: x.evidence, confidence: x.confidence })),
    pass_count: n('Pass'), fail_count: n('Fail'), unable_to_verify_count: n('Unable to Verify'),
    compliance_percentage: decided ? Math.round((n('Pass') / decided) * 100) : 0,
    forbidden_hits: [],
    latency_ms: d.latency_ms, turns: d.turns,
    summary: summaryFor(run, d),
  })
}
export function summaryFor(run, d) {
  const cl = run.clusters?.flatMap(x => x.scenarios).find(x => x.scenario_id === d.scenarioDef.id)
  if (cl) return cl.summary
  if (d.status === 'Pass') return 'Every criterion is supported by the recorded calls and the reply.'
  if (d.status === 'Unable to Verify') return 'The profile reported no usage, so the token budget could not be checked. The refund itself completed.'
  return 'A criterion failed; see the criteria.'
}

/* The scenario as that run used it (0.1.16): the snapshot.yaml shape. */
export function snapshotYaml(run, d) {
  const sc = d.scenarioDef
  return yaml({
    local_id: sc.id, title: sc.title, feature_id: sc.feature, goal: d.goal, input_kind: 'text',
    acceptance_criteria: sc.criteria.filter(x => !x.criterion_id.startsWith('CALL')).map(x => ({ statement: x.criterion, check: x.check })),
    forbidden: sc.forbidden ?? [],
    verification_requires: sc.verification_requires ?? [],
    output_kind: 'text',
    calls: (sc.calls ?? []).map(x => ({ tool: x.tool, expect: x.expect, arguments: x.arguments })),
    multi_turn: !!sc.multi_turn, setup_messages: sc.setup_messages ?? [],
    class: sc.class, category: sc.category,
    redteam: sc.redteam ?? null,
    executable: !sc.skip_reason, skip_reason: sc.skip_reason ?? null, excluded: false, origin: 'generated',
  })
}

/* ---------- per run ---------- */
export function runYaml(run) {
  const prof = PROFILES[run.profile]
  const t = totals(run)
  return yaml({
    version: 1, id: run.id, agent_id: 'refund-desk', created: run.created, test_mode: false, concurrency: run.concurrency,
    pins: { profile_id: run.profile, tree_hash: prof.tree_hash },
    included: run.included.map(id => ({ confidence: 'high', scenario_id: id, why: `Selected for ${run.name}: ${SCENARIO[id].title.toLowerCase()}.` })),
    skipped: run.skipped.map(x => ({ confidence: 'high', scenario_id: x.scenario_id, why: x.why })),
    rca: false,
    unrunnable: details(run).filter(d => d.unrunnable).map(d => ({ scenario_id: d.scenario, why: d.scenarioDef.skip_reason })),
    gapped: [], stale: [],
    summary: `${t.planned} scenarios planned for ${run.name} on ${run.version}.`,
    name: run.name, resume_from: null, phases_run: run.phases_run,
  })
}

export function profileYaml(id) {
  const p = PROFILES[id]
  const hooks = Object.fromEntries(Object.entries(p.hooks).filter(([, v]) => v))
  return yaml({ id: p.id, name: p.name, hooks, env: p.env.map(v => ({ variable: v })), capabilities: p.capabilities, concurrency: p.concurrency })
}

export function featureYaml(id) {
  const f = FEATURE[id]
  return yaml({ local_id: f.id, name: f.name, user_story: f.user_story, expected_behaviour: f.expected_behaviour, edge_cases: f.edge_cases, validation_rules: f.validation_rules, sources: f.sources })
}

export function collectJson(run, d) {
  return json({ scenario_id: d.scenarioDef.id, observed: d.trace.calls.filter(c => TOOLS[c.tool].access === 'read' || c.tool === 'issue_refund').map(c => c.tool), note: 'Evidence the collect hook attached after the agent replied [mock].' })
}

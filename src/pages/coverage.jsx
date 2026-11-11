// Coverage (brief §7.7, spec §4.7): what is untested, unverifiable or
// unrunnable, and why? J3 (close the assurance gap) and J5 (plan coverage)
// ask about the same denominators, so they share one page.
import React, { useEffect, useMemo, useState } from 'react'
import { cx, LTButton, LTCheckbox, LTLink, LTTag, LTBlankSlate, LTCounterLabel } from '../lt.jsx'
import { LTSegmentedControl, LTTabNav } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { SCENARIOS, FEATURES } from '../data.js'
import { gatingRun, behaviour, details, criteriaStats, pct } from '../model.js'
import { ResultsBar, PanelState, VerdictLabel } from '../verdict.jsx'
import { href } from '../router.js'
import { absDate, plural } from '../format.js'

const CLASSES = [['functional', 'Functional'], ['non_functional', 'Non-functional'], ['adversarial', 'Adversarial']]
const CATEGORIES = {
  functional: ['happy_path', 'negative', 'boundary', 'integration', 'state_context'],
  non_functional: ['token_economy', 'quality'],
  adversarial: ['prompt_injection', 'jailbreak', 'data_exfiltration', 'pii_leakage', 'harmful_content', 'hallucination', 'hijacking', 'policy_violation', 'technical_injection'],
}

/* The docs' gap table (results doc, "Fix Verification Gaps"), plus the two
   product limits the scenarios doc names. `match` finds this run's gaps. */
const CAUSES = [
  { id: 'calls', cause: 'Tool calls missing, or missing their arguments', fix: 'Use profile fix or edit the hook to return actual calls. Test it again.', kind: 'Fixable',
    handoff: () => HANDOFF.profileFix("returns the agent's tool calls as calls[] with their arguments", 'Return tool call arguments') },
  { id: 'usage', cause: 'Token usage unreported', fix: 'Return observed usage only if the target provides it.', kind: 'Fixable',
    handoff: () => HANDOFF.profileFix("reports the target's token usage, when the target provides it", 'Report token usage') },
  { id: 'handle', cause: 'Missing conversation handle, so multi-turn scenarios skip', fix: 'Implement real session handling and return a conversation handle.', kind: 'Fixable',
    handoff: () => HANDOFF.profileFix('returns a conversation handle, so multi-turn scenarios can run', 'Return a conversation handle') },
  { id: 'collect', cause: 'Delayed evidence without a collect hook', fix: 'Add a collect hook and continue the same run with --run.', kind: 'Fixable' },
  { id: 'mcp', cause: 'MCP verifier missing, pending approval or on an unsupported transport', fix: 'Check its definition, connection and approval with rook mcp.', kind: 'Fixable', handoff: () => HANDOFF.mcp('billing') },
  { id: 'write', cause: 'The only check would write, so the judge refuses it', fix: 'Provide a read-only observation instead.', kind: 'Fixable' },
  { id: 'fields', cause: 'Criteria expect fields absent from the answer', fix: 'Align the criterion and returned evidence. Keep the business requirement as strict.', kind: 'Fixable' },
  { id: 'attribution', cause: 'Evidence spans more than one scenario', fix: 'Isolate fixtures and sessions, or use concurrency 1.', kind: 'Fixable' },
  { id: 'pixels', cause: 'Output beyond judging, such as image pixels', fix: 'Judge a produced file or image through a separate verifier, or accept the gap with a note.', kind: 'Product limit' },
  { id: 'attachments', cause: 'Native attachments, pr_ref or image input', fix: 'The runner has yet to deliver them. Keep these scenarios out of release gates.', kind: 'Product limit' },
]

function gapsFor(run) {
  const g = Object.fromEntries(CAUSES.map(c => [c.id, { criteria: 0, scenarios: new Set() }]))
  if (!run) return g
  for (const d of details(run)) {
    if (d.unrunnable) { g.handle.criteria += d.criteria.length; g.handle.scenarios.add(d.scenario); continue }
    for (const c of d.criteria) {
      if (c.status !== 'Unable to Verify') continue
      const id = d.scenarioDef.category === 'token_economy' ? 'usage' : 'calls'
      g[id].criteria++; g[id].scenarios.add(d.scenario)
    }
  }
  return g
}

export function CoveragePage({ route }) {
  const st = useStore()
  const handoff = useHandoff()
  const run = gatingRun('v12', st.proto)
  const b = behaviour('v12', run)
  const c = run ? criteriaStats(run) : null
  const byId = Object.fromEntries((run ? details(run) : []).map(d => [d.scenario, d]))
  const [list, setList] = useState('never')
  const [picked, setPicked] = useState(() => new Set(route.q.feature ? [route.q.feature] : []))
  const [cls, setCls] = useState('all')
  const [cats, setCats] = useState(() => new Set())
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const gaps = useMemo(() => gapsFor(run), [run])
  useEffect(() => { if (route.q.focus === 'gaps') document.getElementById('gaps-h')?.scrollIntoView({ block: 'start' }) }, [route.q.focus])
  const rows = [...b.rows].sort((x, y) => (x.tested === y.tested ? 0 : x.tested ? 1 : -1))

  const never = SCENARIOS.filter(s => !run || !run.included.includes(s.id)).filter(s => !s.skip_reason)
  const unrunnable = SCENARIOS.filter(s => s.skip_reason)
  const LISTS = [
    { id: 'never', label: 'Never Run', counter: never.length },
    { id: 'unrunnable', label: 'Unrunnable', counter: unrunnable.length },
    { id: 'excluded', label: 'Excluded', counter: 0 },
    { id: 'stale', label: 'Stale', counter: 0 },
  ]

  const generate = () => {
    const feats = FEATURES.filter(f => picked.has(f.id))
    const focus = feats.length ? feats.map(f => `${f.id}, ${f.name.toLowerCase()}`).join('; ') : 'the features awaiting scenarios'
    handoff(HANDOFF.generate({ categories: [...cats], total: Math.max(2, feats.length * 2), focus }))
  }

  return (
    <AgentFrame route={route}>
      <section className="panel" aria-labelledby="mx-h">
        <div className="panel__head">
          <h2 id="mx-h" className="sec-h">Features by class</h2>
          <span className="caption">{b.tested} of {b.total} features tested · {pct(b.tested, b.total)} · last results from {run ? `${run.name} on ${absDate(run.created)}` : 'a shared run, once one syncs'}</span>
        </div>
        {panel ? <PanelState state={panel} object="the coverage matrix" rows={6} lead /> : (
          <table className="lt-table matrix">
            <caption className="vh">Scenarios per feature and class, with their last results</caption>
            <thead><tr><th scope="col"><span className="vh">Select</span></th><th scope="col">Feature</th>{CLASSES.map(([k, l]) => <th key={k} scope="col">{l}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.feature.id} className={cx(picked.has(r.feature.id) && 'is-selected')}>
                  <td><LTCheckbox checked={picked.has(r.feature.id)} ariaLabel={`Select ${r.feature.id} for generation`}
                    onChange={() => setPicked(s => { const n = new Set(s); n.has(r.feature.id) ? n.delete(r.feature.id) : n.add(r.feature.id); return n })} /></td>
                  <th scope="row" className="matrix__feat">
                    <span className="mono-strong">{r.feature.id}</span> <span>{r.feature.name}</span>
                    <LTTag text={r.state === 'tested' ? 'Tested' : r.state === 'awaiting-run' ? 'Awaiting a run' : 'Awaiting scenarios'}
                      variant={r.state === 'tested' ? 'success' : 'attention'} className="matrix__state" />
                  </th>
                  {CLASSES.map(([k]) => {
                    const sc = r.scenarios.filter(s => s.class === k)
                    if (!sc.length) return <td key={k} className="matrix__empty">Awaiting scenarios</td>
                    const counts = { passed: 0, failed: 0, unverifiable: 0, unrunnable: 0, not_run: 0 }
                    for (const s of sc) {
                      const d = byId[s.id]
                      if (!d) counts.not_run++
                      else if (d.unrunnable) counts.unrunnable++
                      else if (d.status === 'Pass') counts.passed++
                      else if (d.status === 'Fail') counts.failed++
                      else if (d.status === 'Unable to Verify') counts.unverifiable++
                      else counts.not_run++
                    }
                    return (
                      <td key={k} className="matrix__cell">
                        <span className="matrix__n">{plural(sc.length, 'scenario')}</span>
                        <ResultsBar counts={counts} hover />
                        <span className="matrix__ids">{sc.map(s => s.id).join(', ')}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="gen">
          <span className="field-label">Generate for</span>
          <span className="caption">{picked.size ? `${plural(picked.size, 'feature')} selected` : 'Select features above, then pick categories'}</span>
          <LTSegmentedControl ariaLabel="Class to generate" variant="small" selectedValue={cls} onChange={v => { setCls(v); setCats(new Set()) }}
            options={[{ value: 'all', label: 'Any class' }, ...CLASSES.map(([k, l]) => ({ value: k, label: l }))]} />
          {cls !== 'all' && (
            <span className="gen__cats" role="group" aria-label="Categories">
              {CATEGORIES[cls].map(cat => (
                <LTCheckbox key={cat} label={cat} checked={cats.has(cat)} onChange={() => setCats(s => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n })} />
              ))}
            </span>
          )}
          <LTButton variant="primary" size="medium" label="Generate Scenarios" onClick={generate} className="gen__go" />
        </div>
      </section>

      <section className="panel" aria-labelledby="lists-h">
        <div className="panel__head"><h2 id="lists-h" className="sec-h">Scenarios outside the results</h2></div>
        <LTTabNav ariaLabel="Scenario lists" idPrefix="cov" items={LISTS} activeTab={list} onSelect={setList} size="small" />
        <div id="cov-panel" role="tabpanel" aria-labelledby={`cov-tab-${list}`} className="cov-panel">
          {list === 'never' && (never.length ? (
            <ul className="slist">{never.map(s => <li key={s.id}><span className="mono-strong">{s.id}</span> <span>{s.title}</span> <span className="caption">{s.feature} · {s.class} · {s.category} · generated {absDate(s.created)}, after {run?.name ?? 'the last run'}</span></li>)}</ul>
          ) : <p className="body muted">Every scenario has a recorded result.</p>)}
          {list === 'unrunnable' && (
            <ul className="slist">{unrunnable.map(s => <li key={s.id}><span className="mono-strong">{s.id}</span> <span>{s.title}</span> <code className="mono-inline">{s.skip_reason}</code></li>)}</ul>
          )}
          {list === 'excluded' && <p className="body muted">0 excluded scenarios. An excluded scenario stays on disk and out of runs, with its reason.</p>}
          {list === 'stale' && <p className="body muted">0 stale scenarios. Whether the hosted record carries staleness after a new exploration is an open question.</p>}
        </div>
      </section>

      <section className="panel" aria-labelledby="gaps-h">
        <div className="panel__head">
          <h2 id="gaps-h" className="sec-h">Gap breakdown</h2>
          <span className="caption">{c ? `${c.uv} Unable to Verify ${c.uv === 1 ? 'criterion' : 'criteria'} and ${plural(unrunnable.length, 'unrunnable scenario')} on ${run.name}, by cause` : '–'}</span>
        </div>
        {panel ? <PanelState state={panel} object="the gap breakdown" rows={4} /> : (
          <table className="lt-table gaps">
            <caption className="vh">Gaps by cause</caption>
            <thead><tr><th scope="col">Cause</th><th scope="col">Blocks</th><th scope="col">Fix</th><th scope="col">Kind</th><th scope="col"><span className="vh">Next step</span></th></tr></thead>
            <tbody>
              {CAUSES.map(x => {
                const g = gaps[x.id]
                const active = g.criteria > 0
                return (
                  <tr key={x.id} className={cx(!active && 'is-quiet')}>
                    <td>{x.cause}</td>
                    <td>{active ? <>{plural(g.criteria, 'criterion', 'criteria')} · {[...g.scenarios].join(', ')}</> : <span className="muted">0 criteria</span>}</td>
                    <td className="caption">{x.fix}</td>
                    <td><LTTag text={x.kind} variant={x.kind === 'Fixable' ? 'secondary' : 'attention'} /></td>
                    <td>{active && x.handoff && <LTButton variant="outline" size="small" label="Next Step" onClick={() => handoff(x.handoff())} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="caption">Close a gap with better evidence. Keep the business criterion as strict as it is.</p>
      </section>
    </AgentFrame>
  )
}

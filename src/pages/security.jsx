// Security (brief §7.8, spec §4.8): which attacks landed, which held, and
// which never reached the agent? The brief forbids typing OWASP or ATLAS IDs
// or names from memory, and no source maps refund-desk's patterns to them, so
// the default lens is Rook's nine adversarial categories (spec D14, gap G9).
import React, { useState } from 'react'
import { cx, LTLink, LTTag, LTBlankSlate, LTButton } from '../lt.jsx'
import { LTSegmentedControl, LTSelect } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { VERSIONS, GATING } from '../data.js'
import { gatingRun, attackReach } from '../model.js'
import { VerdictLabel, ResultLabel, PanelState } from '../verdict.jsx'
import { summaryFor } from '../files.js'
import { href, setQuery } from '../router.js'
import { absDate } from '../format.js'

const CATS = ['prompt_injection', 'jailbreak', 'data_exfiltration', 'pii_leakage', 'harmful_content', 'hallucination', 'hijacking', 'policy_violation', 'technical_injection']
const OUTCOMES = ['Compromised', 'Defended', 'Unverified', 'Unreached']
const LENSES = [{ value: 'rook', label: 'Rook categories' }, { value: 'llm', label: 'OWASP LLM' }, { value: 'agentic', label: 'OWASP Agentic' }, { value: 'atlas', label: 'MITRE ATLAS' }]

const outcomeOf = r => (!r.result?.status ? 'Unreached' : r.result.compromised ? 'Compromised' : r.result.status === 'Pass' ? 'Defended' : r.result.status === 'Unable to Verify' ? 'Unverified' : 'Compromised')

export function SecurityPage({ route }) {
  const st = useStore()
  const handoff = useHandoff()
  const [lens, setLens] = useState('rook')
  const [cell, setCell] = useState(null)
  const version = route.q.version && GATING[route.q.version] ? route.q.version : 'v12'
  const run = gatingRun(version, st.proto)
  const a = attackReach(version, run)
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const rows = CATS.map(cat => {
    const scen = a.rows.filter(r => r.scenario.category === cat)
    const gaps = a.gaps.filter(g => g.category === cat)
    const by = Object.fromEntries(OUTCOMES.map(o => [o, scen.filter(r => outcomeOf(r) === o)]))
    return { cat, scen, gaps, by, reached: scen.filter(r => r.result?.status).length }
  }).sort((x, y) => (y.by.Compromised.length - x.by.Compromised.length) || (y.scen.length + y.gaps.length) - (x.scen.length + x.gaps.length))
  const compromised = a.rows.filter(r => r.result?.compromised)
  const listed = cell ? rows.find(r => r.cat === cell.cat)?.by[cell.outcome] ?? [] : a.rows

  return (
    <AgentFrame route={route} actions={
      <LTSelect leadingText="Version" inputAriaLabel="Version" value={version} width={240}
        options={VERSIONS.map(v => ({ value: v.id, label: v.current ? `${v.id} · current` : v.id }))} onChange={v => setQuery({ version: v === 'v12' ? null : v })} />
    }>
      <div className="page-head">
        <h2 className="sec-h">Attack posture</h2>
        <span className="caption">{a.reached} of {a.considered} patterns reached · {a.defended} defended · {a.compromised} compromised{run ? ` · from ${run.name} on ${absDate(run.created)}` : ''}</span>
        <div className="page-head__actions"><LTSegmentedControl ariaLabel="Lens" variant="small" selectedValue={lens} onChange={setLens} options={LENSES} /></div>
      </div>

      {panel ? <PanelState state={panel} object="the attack posture" rows={6} lead /> : !run ? (
        <LTBlankSlate heading={`${version} is waiting for its first shared run`} description="Attack results arrive with the first normal run." />
      ) : lens !== 'rook' ? (
        <div className="state-card">
          <p className="baseline__h">{LENSES.find(l => l.value === lens).label} mapping awaits Rook's record</p>
          <p className="body">Rook's report carries a red-team coverage table whose rows are framework entries, such as owasp:llm01. That mapping for refund-desk's attack patterns is missing from the prototype's data, and the brief keeps framework names to sources read.</p>
          <LTButton variant="outline" size="small" label="Show Rook Categories" onClick={() => setLens('rook')} />
        </div>
      ) : (
        <>
          {compromised.length > 0 && (
            <section className="panel" aria-labelledby="comp-h">
              <div className="panel__head"><h3 id="comp-h" className="sec-h">Compromised on {version}</h3></div>
              {compromised.map(r => (
                <div key={r.scenario.id} className="why why--danger">
                  <p className="why__h">Why it was compromised · <LTLink href={href.result(run.id, r.scenario.id)} className="mono-link">{r.scenario.id}</LTLink></p>
                  <p className="body">{summaryFor(run, r.result)}</p>
                  <p className="caption">Goal sent: <span className="mono-inline">{r.result.goal}</span></p>
                  <LTButton variant="outline" size="small" label="Next Step" onClick={() => handoff(HANDOFF.bug({ runUrl: `${location.origin}${location.pathname}${href.result(run.id, r.scenario.id)}`, scenario: r.scenario.id, criterion: r.result.criteria.find(c => c.status === 'Fail'), excerpt: r.result.criteria.find(c => c.status === 'Fail').evidence }))} />
                </div>
              ))}
            </section>
          )}

          <section className="panel" aria-labelledby="grid-h">
            <div className="panel__head"><h3 id="grid-h" className="sec-h">Category by outcome</h3><span className="caption">Select a cell to filter the attacks below</span></div>
            <table className="lt-table secgrid">
              <caption className="vh">Attack scenarios by category and outcome</caption>
              <thead><tr>
                <th scope="col">Category</th><th scope="col">Generated</th><th scope="col">Reached</th>
                {OUTCOMES.map(o => <th key={o} scope="col">{o}</th>)}
                <th scope="col">Patterns awaiting a scenario</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.cat} className={cx(!r.scen.length && !r.gaps.length && 'is-quiet')}>
                    <th scope="row" className="mono-inline-th">{r.cat}</th>
                    <td>{r.scen.length}</td>
                    <td>{r.reached}</td>
                    {OUTCOMES.map(o => (
                      <td key={o}>
                        {r.by[o].length ? (
                          <button type="button" className={cx('gridcell', `gridcell--${o.replace(' ', '-').toLowerCase()}`, cell?.cat === r.cat && cell?.outcome === o && 'is-on')}
                            aria-pressed={cell?.cat === r.cat && cell?.outcome === o} aria-label={`${r.by[o].length} ${o} in ${r.cat}`}
                            onClick={() => setCell(cell?.cat === r.cat && cell?.outcome === o ? null : { cat: r.cat, outcome: o })}>{r.by[o].length}</button>
                        ) : <span className="muted">0</span>}
                      </td>
                    ))}
                    <td>{r.gaps.length ? r.gaps.map(g => <span key={g.pattern_id} className="caption gap-pat">{g.feature} · {g.pattern_id}</span>) : <span className="muted">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="caption">A zero row means the category awaits scenarios, so safety against it stays unverified. Patterns awaiting a scenario come from the agent's coverage gaps.</p>
          </section>

          <section className="panel" aria-labelledby="atk-h">
            <div className="panel__head">
              <h3 id="atk-h" className="sec-h">{cell ? `${cell.outcome} in ${cell.cat}` : 'Every attack scenario'}</h3>
              {cell && <LTButton variant="invisible" size="small" label="Show Every Attack" onClick={() => setCell(null)} />}
            </div>
            <ul className="atk">
              {listed.map(r => (
                <li key={r.scenario.id} className="atk__row">
                  <LTLink href={href.result(run.id, r.scenario.id)} className="mono-link">{r.scenario.id}</LTLink>
                  <span className="atk__title">{r.scenario.title}</span>
                  <span className="mono-muted">{r.scenario.category}</span>
                  {r.result ? <ResultLabel d={r.result} size="small" /> : <VerdictLabel verdict="Not run" size="small" />}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AgentFrame>
  )
}

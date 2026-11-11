// Run comparison (brief §7.6, spec §4.6): regression, fix or noise? The
// guard lists everything that differs besides the agent first, as the docs
// require "before calling a change a regression". Flaky and redefined follow
// the skill's verdicts.md; redefined scenarios stay out of the regression
// buckets (spec D10).
import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import { cx, LTButton, LTLink, LTFlash, LTTag, LTCounterLabel, LTBlankSlate } from '../lt.jsx'
import { LTSelect } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { GATING, SCENARIO } from '../data.js'
import { runsFor, compare, BUCKETS } from '../model.js'
import { VerdictLabel, ResultLabel, PanelState } from '../verdict.jsx'
import { href, setQuery } from '../router.js'
import { absDate, plural } from '../format.js'

const BUCKET_TONE = { 'Newly failing': 'danger', 'Newly fixed': 'success', 'Still failing': 'danger', Flaky: 'attention', Redefined: 'secondary', Unchanged: 'secondary' }
const BUCKET_HELP = {
  'Newly failing': 'Passed or unverifiable in the base run, Fail in the head run',
  'Newly fixed': 'Fail in the base run, Pass in the head run',
  'Still failing': 'Fail in both runs',
  Flaky: 'Flips between runs of one agent version on an unchanged scenario',
  Redefined: 'Scenario text changed between the runs, so it stays out of the regression buckets',
  Unchanged: 'Same verdict in both runs',
}

export function ComparePage({ route }) {
  const st = useStore()
  const all = runsFor(st.proto)
  const byId = Object.fromEntries(all.map(r => [r.id, r]))
  const base = byId[route.q.base] ?? byId[GATING.v11]
  const head = byId[route.q.head] ?? byId[GATING.v12] ?? all[all.length - 1]
  const bucket = BUCKETS.includes(route.q.bucket) ? route.q.bucket : null
  const res = useMemo(() => (base && head ? compare(base, head, all) : null), [base, head, all])
  const [open, setOpen] = useState(() => new Set())
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const opts = [...all].reverse().map(r => ({ value: r.id, label: `${r.name} · ${r.version}`, description: `${absDate(r.created)} · ${r.state}` }))
  const rows = res ? res.rows.filter(r => !bucket || r.bucket === bucket) : []

  return (
    <AgentFrame route={route} current="compare">
      <div className="page-head">
        <h2 className="sec-h">Run comparison</h2>
        <div className="page-head__actions cmp-pickers">
          <LTSelect leadingText="Base" inputAriaLabel="Base run" value={base?.id} options={opts} width={300} onChange={v => setQuery({ base: v, bucket: null })} />
          <ArrowRight size={16} aria-hidden="true" className="muted" />
          <LTSelect leadingText="Head" inputAriaLabel="Head run" value={head?.id} options={opts} width={300} onChange={v => setQuery({ head: v, bucket: null })} />
        </div>
      </div>
      {panel ? <PanelState state={panel} object="the comparison" rows={6} lead /> : !res ? (
        <LTBlankSlate heading="Pick two runs to compare" description="The comparison needs a base run and a head run." />
      ) : base.id === head.id ? (
        <LTBlankSlate heading="Pick two different runs" description="Base and head are the same run." />
      ) : (
        <>
          {res.lead && (
            <LTFlash variant="warning" text={`${res.differs.filter(d => d.what === 'Profile' || d.what === 'Selection').map(d => `${d.what} differs: ${d.base} against ${d.head}`).join('. ')}. A change here can come from that as well as from the agent.`} />
          )}
          <section className="panel" aria-labelledby="guard-h">
            <div className="panel__head"><h3 id="guard-h" className="sec-h">What differs besides the agent</h3><span className="caption">{base.name} on {base.version} against {head.name} on {head.version}</span></div>
            <ul className="guard">
              <li><span className="field-label">Agent version</span> {base.version} <ArrowRight size={12} aria-hidden="true" /> {head.version}</li>
              {['Profile', 'Selection', 'Concurrency', 'Phases'].map(w => {
                const d = res.differs.find(x => x.what === w)
                return <li key={w} className={cx(d && 'is-diff')}><span className="field-label">{w}</span> {d ? <>{String(d.base)} <ArrowRight size={12} aria-hidden="true" /> {String(d.head)}</> : 'Same'}</li>
              })}
              <li className={cx(res.guard.redefined.length && 'is-diff')}><span className="field-label">Edited scenarios</span> {res.guard.redefined.length ? `${res.guard.redefined.join(', ')} left out of the regression buckets` : '0'}</li>
              <li><span className="field-label">Without a verdict</span> {res.guard.noVerdict.length ? `${res.guard.noVerdict.join(', ')} in one or both runs` : '0'}</li>
              {(res.guard.added.length > 0 || res.guard.removed.length > 0) && (
                <li className="is-diff"><span className="field-label">In one run only</span> {[...res.guard.added.map(x => `${x} (head)`), ...res.guard.removed.map(x => `${x} (base)`)].join(', ')}</li>
              )}
            </ul>
          </section>

          <div className="buckets" role="group" aria-label="Filter by bucket">
            {BUCKETS.map(k => (
              <button key={k} type="button" aria-pressed={bucket === k} className={cx('bucket', `bucket--${BUCKET_TONE[k]}`, bucket === k && 'is-on')}
                onClick={() => setQuery({ bucket: bucket === k ? null : k })}>
                <span className="bucket__n">{res.counts[k]}</span>
                <span className="bucket__label">{k}</span>
              </button>
            ))}
          </div>
          <p className="caption">{bucket ? `${BUCKET_HELP[bucket]}. ` : ''}{bucket ? <LTButton variant="invisible" size="small" label="Show Every Bucket" onClick={() => setQuery({ bucket: null })} /> : 'Select a count to filter the rows.'}</p>

          <section className="panel cmp" aria-label="Scenarios compared">
            {!rows.length ? <p className="body muted">0 scenarios in {bucket}.</p> : (
              <ul className="cmp__list">
                {rows.map(r => {
                  const exp = open.has(r.id)
                  return (
                    <li key={r.id} className="cmp__row">
                      <div className="cmp__line">
                        <button type="button" className="cmp__toggle" aria-expanded={exp} aria-label={`${exp ? 'Collapse' : 'Expand'} ${r.id}`}
                          onClick={() => setOpen(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}>
                          {exp ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                        </button>
                        <LTLink href={href.result(head.id, r.id)} className="mono-link">{r.id}</LTLink>
                        <span className="cmp__title">{SCENARIO[r.id].title}</span>
                        <span className="cmp__verdicts"><ResultLabel d={r.base} size="small" /><ArrowRight size={14} aria-hidden="true" className="muted" /><ResultLabel d={r.head} size="small" /></span>
                        <LTTag text={r.bucket} variant={BUCKET_TONE[r.bucket]} />
                        {r.bucket === 'Newly failing' && <LTLink href={href.tab('triage')}>Send to Triage</LTLink>}
                      </div>
                      {exp && <Detail r={r} base={base} head={head} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </AgentFrame>
  )
}

function Detail({ r, base, head }) {
  const ids = [...new Set([...r.base.criteria.map(c => c.criterion_id), ...r.head.criteria.map(c => c.criterion_id)])]
  return (
    <div className="cmp__detail">
      {r.bucket === 'Redefined' && (
        <div className="cmp__goals">
          <p className="caption">Goal in {base.name} ({base.version}): <span className="mono-inline">{r.base.goal}</span></p>
          <p className="caption">Goal in {head.name} ({head.version}): <span className="mono-inline">{r.head.goal}</span></p>
        </div>
      )}
      <table className="lt-table cmp__table">
        <caption className="vh">Criteria before and after for {r.id}</caption>
        <thead><tr><th scope="col">Criterion</th><th scope="col">{base.name} · {base.version}</th><th scope="col">{head.name} · {head.version}</th></tr></thead>
        <tbody>
          {ids.map(id => {
            const b = r.base.criteria.find(c => c.criterion_id === id)
            const h = r.head.criteria.find(c => c.criterion_id === id)
            return (
              <tr key={id}>
                <td><span className="mono-strong">{id}</span> <span className="caption">{(h ?? b).criterion}</span></td>
                <td>{b ? <><VerdictLabel verdict={b.status} size="small" /><q className="evidence cmp__ev">{b.evidence}</q></> : '–'}</td>
                <td>{h ? <><VerdictLabel verdict={h.status} size="small" /><q className="evidence cmp__ev">{h.evidence}</q></> : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

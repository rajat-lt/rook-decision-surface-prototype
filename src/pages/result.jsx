// Scenario result, the workhorse (brief §7.4, spec §4.4): why did this
// criterion get this verdict, and what do I do now? Effects come before
// words (spec D12); a disposition sits beside the verdict and never changes
// it (spec D8).
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import {
  cx, LTButton, LTTag, LTLink, LTCodeBlock, LTCopyToClipboard, LTInputBox, LTTextarea, LTInlineMessage, LTBlankSlate,
  LTCounterLabel, LTFlash,
} from '../lt.jsx'
import { LTSegmentedControl, LTSelect, LTTabNav, LTDrawer } from '../overlays.jsx'
import { useStore, nowMs } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { FEATURE, PEOPLE, DISPOSITIONS, PROFILES, revisionAt } from '../data.js'
import { runFor, details, totals, triageKey } from '../model.js'
import { ResultLabel, VerdictLabel, ToolName, PinnedLine, PanelState } from '../verdict.jsx'
import { requestJson, responseJson, verdictYaml, hooksJson, snapshotYaml, collectJson, summaryFor } from '../files.js'
import { href, setQuery } from '../router.js'
import { latency, relTime, absDate } from '../format.js'

/* Reason codes (spec §4.16). Meanings from the skill's troubleshooting.md;
   undecidable has none in any source read [TO FILL]. */
export const REASON = {
  not_observable: { meaning: 'The profile leaves out the evidence this check needs', fix: 'Return the missing evidence from the profile, then rerun the scenario.' },
  agent_never_ran: { meaning: 'The agent run is missing for this attempt', fix: 'Test the profile against the agent, then repair it.' },
  undecidable: { meaning: 'The evidence fits more than one reading', fix: 'Reword the criterion so one reading decides it. [TO FILL]' },
}
const FILTERS = [['all', 'All'], ['pass', 'Pass'], ['fail', 'Fail'], ['uv', 'Unable to Verify']]
const FILTER_STATUS = { pass: 'Pass', fail: 'Fail', uv: 'Unable to Verify' }

/** What the profile must return so a criterion becomes checkable. */
export function missingFor(d) {
  if (d.scenarioDef.category === 'token_economy') return { what: "reports the target's token usage, when the target provides it", reason: 'Report token usage' }
  if (d.trace?.calls?.some(c => c.noArgs)) return { what: "returns the agent's tool calls as calls[] with their arguments", reason: 'Return tool call arguments' }
  return { what: 'returns the evidence these criteria need', reason: 'Fix what the profile returns' }
}

/** The hand-off for a criterion's disposition (spec §4.4 triage footer, D13). */
export function handoffFor(run, d, c, disposition) {
  const pick = disposition ?? (c.status === 'Fail' ? 'Agent defect' : 'Harness gap')
  if (pick === 'Agent defect') {
    return HANDOFF.bug({ runUrl: `${location.origin}${location.pathname}${href.result(run.id, d.scenario)}`, scenario: d.scenario, criterion: c, excerpt: c.evidence })
  }
  if (pick === 'Harness gap') { const m = missingFor(d); return HANDOFF.profileFix(m.what, m.reason) }
  if (pick === 'Wrong expectation') return HANDOFF.editExpectation(d.scenario)
  if (pick === 'Flaky') return HANDOFF.rerun([d.scenario])
  return HANDOFF.acceptRisk()
}

export function ResultPage({ route }) {
  const st = useStore()
  const run = runFor(route.run, st.proto)
  if (!run) return <div className="page-col"><LTBlankSlate heading="This run is outside the prototype" primaryAction={<LTLink href={href.tab('runs')}>Open Runs</LTLink>} /></div>
  const ds = details(run)
  const d = ds.find(x => x.scenario === route.scenario) ?? ds[0]
  return (
    <div className="result">
      <ScenarioPane run={run} ds={ds} current={d.scenario} />
      <div className="result__centre">
        <ResultCentre run={run} d={d} route={route} />
      </div>
    </div>
  )
}

/* ---------- left pane: the run's scenarios (400px, automation-details.md) ---------- */
function ScenarioPane({ run, ds, current }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const listRef = useRef(null)
  const shown = ds.filter(d => !q || `${d.scenario} ${d.scenarioDef.title}`.toLowerCase().includes(q.toLowerCase()))
  useEffect(() => { listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }) }, [current])
  return (
    <aside className="spane" aria-label="Scenarios in this run">
      <div className="spane__head">
        <h2 className="sec-h">Scenarios in this run <LTCounterLabel count={ds.length} /></h2>
        <LTInputBox value={q} onChange={setQ} placeholder="Search scenarios" ariaLabel="Search scenarios" />
      </div>
      {st.proto === 'loading' ? <div className="spane__list"><PanelState state="loading" object="scenarios" rows={8} /></div> : (
        <ul className="spane__list" ref={listRef}>
          {shown.map(d => {
            const open = d.criteria.filter(c => c.status === 'Fail' || c.status === 'Unable to Verify')
            const untriaged = open.filter(c => !st.triage[triageKey(run.id, d.scenario, c.criterion_id)]?.disposition).length
            const on = d.scenario === current
            return (
              <li key={d.scenario}>
                <a href={href.result(run.id, d.scenario)} className={cx('srow', on && 'is-selected')} aria-current={on ? 'page' : undefined}>
                  <span className="srow__top">
                    <span className="mono-strong">{d.scenario}</span>
                    <ResultLabel d={d} size="small" />
                  </span>
                  <span className="srow__title">{d.scenarioDef.title}</span>
                  {open.length > 0 && (
                    <span className={cx('srow__triage', untriaged && 'is-open')}>
                      {untriaged ? `${untriaged} of ${open.length} untriaged` : `${open.length} of ${open.length} triaged`}
                    </span>
                  )}
                </a>
              </li>
            )
          })}
          {!shown.length && <li className="spane__empty">0 scenarios match "{q}". Clear the search to see all {ds.length}.</li>}
        </ul>
      )}
    </aside>
  )
}

/* ---------- centre ---------- */
function ResultCentre({ run, d, route }) {
  const st = useStore()
  const handoff = useHandoff()
  const [snap, setSnap] = useState(false)
  const [hooks, setHooks] = useState(false)
  const s = d.scenarioDef
  const t = totals(run)
  const evidenceTab = route.q.tab
  const counts = { all: d.criteria.length, pass: 0, fail: 0, uv: 0 }
  d.criteria.forEach(c => { if (c.status === 'Pass') counts.pass++; else if (c.status === 'Fail') counts.fail++; else if (c.status === 'Unable to Verify') counts.uv++ })
  const filter = route.q.filter && FILTERS.some(([k]) => k === route.q.filter) ? route.q.filter : counts.fail ? 'fail' : counts.uv ? 'uv' : 'all'
  const ran = !!d.status

  return (
    <div className="rc">
      <header className="rc__head">
        <div className="rc__title-row">
          <h1 className="h-title rc__title">{s.title}</h1>
          <ResultLabel d={d} />
        </div>
        <div className="rc__meta">
          <span className="mono-strong">{s.id}</span>
          <LTLink href={href.tab('coverage', { feature: s.feature })}>{s.feature} · {FEATURE[s.feature].name}</LTLink>
          <span>{s.class}</span><span>{s.category}</span>
          {ran && <><span>Latency {latency(d.latency_ms)}</span><span>{d.turns} {d.turns === 1 ? 'turn' : 'turns'}</span><span>Attempt 1</span></>}
          <LTButton variant="invisible" size="small" leadingIcon={FileText} label="View Scenario at Run Time" onClick={() => setSnap(true)} />
        </div>
        <PinnedLine run={run} totals={t} prefix="From" />
      </header>

      <WhyCard run={run} d={d} onHandoff={handoff} />

      <section className="rc__sec" aria-labelledby="goal-h">
        <h2 id="goal-h" className="sec-h">Goal sent to the agent</h2>
        {s.setup_messages?.length > 0 && <p className="caption">Setup turn: <span className="mono-inline">{s.setup_messages.join(' / ')}</span></p>}
        <pre className="goal">{d.goal}</pre>
      </section>

      {ran && <>
        <section className="rc__sec" aria-labelledby="did-h">
          <div className="panel__head">
            <h2 id="did-h" className="sec-h">What the agent did</h2>
            <LTButton variant="invisible" size="small" label="View hooks.json" onClick={() => setHooks(true)} />
          </div>
          <Calls d={d} run={run} onFix={() => { const m = missingFor(d); handoff(HANDOFF.profileFix(m.what, m.reason)) }} />
        </section>
        <section className="rc__sec" aria-labelledby="said-h">
          <h2 id="said-h" className="sec-h">What the agent said</h2>
          <p className="caption">The agent's claim. The calls above are the evidence.</p>
          <blockquote className="reply">{d.trace.reply}</blockquote>
        </section>
      </>}

      <Criteria run={run} d={d} filter={filter} counts={counts} unavailable={st.proto === 'error'} />

      <section className="rc__sec" aria-labelledby="ev-h">
        <h2 id="ev-h" className="sec-h">Evidence</h2>
        {ran ? (
          <div className="ev-buttons">
            {[['request', 'Request'], ['response', 'Response'], ['verdict', 'Verdict'], ['artefacts', 'Artefacts']].map(([k, l]) => (
              <LTButton key={k} variant="outline" size="medium" label={l} onClick={() => setQuery({ tab: k })} />
            ))}
          </div>
        ) : <p className="body muted">Missing from this attempt: request, response and verdict.</p>}
      </section>

      {ran && <EvidenceDrawer run={run} d={d} tab={evidenceTab} />}
      <LTDrawer isOpen={snap} onClose={() => setSnap(false)} width={640} title={`${s.id} as ${run.name} ran it`}
        subTitle={`Snapshot from ${absDate(run.created)}. Today's definition can differ.`}>
        <SnapshotBody run={run} d={d} />
      </LTDrawer>
      <LTDrawer isOpen={hooks} onClose={() => setHooks(false)} width={640} title="hooks.json" subTitle="The phase records the profile's hooks returned">
        {ran && <CodeFile name="hooks.json" text={hooksJson(run, d)} />}
      </LTDrawer>
    </div>
  )
}

/* ---------- the why card (exists: 0.1.17, 0.1.18) ---------- */
function WhyCard({ run, d, onHandoff }) {
  const cluster = run.clusters?.find(c => c.scenarios.some(x => x.scenario_id === d.scenario))
  const summary = cluster?.scenarios.find(x => x.scenario_id === d.scenario)?.summary
  if (d.unrunnable) {
    return (
      <section className="why why--neutral">
        <p className="why__h">Unrunnable on the {run.profile} profile</p>
        <p className="body">{d.scenarioDef.skip_plain}</p>
        <p className="caption">Recorded skip reason: <code className="mono-inline">{d.scenarioDef.skip_reason}</code></p>
        <p className="caption">It counts toward the assurance gap and stays out of Fail.</p>
        <LTButton variant="outline" size="small" label="Next Step"
          onClick={() => onHandoff(HANDOFF.profileFix('returns a conversation handle, so multi-turn scenarios can run', 'Return a conversation handle'))} />
      </section>
    )
  }
  if (d.not_run) {
    return (
      <section className="why why--neutral">
        <p className="why__h">The run halted before this scenario ran</p>
        <p className="body">{run.halted_reason}</p>
        <LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.resume(run))} />
      </section>
    )
  }
  if (d.unjudged) {
    return (
      <section className="why why--neutral">
        <p className="why__h">Awaiting judge</p>
        <p className="body">The agent replied and the evidence is collected. Judge runs when the run continues.</p>
        <LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.finishRun(run))} />
      </section>
    )
  }
  if (d.status === 'Pass') return null
  const clusterLink = cluster && <LTLink href={href.run(run.id, { cluster: cluster.id })}>See This Cluster on the Run Page</LTLink>
  if (d.compromised) {
    const hit = d.trace.calls.find(c => c.tool === 'issue_refund')
    return (
      <section className="why why--danger">
        <p className="why__h">Why it was compromised</p>
        {cluster && <p className="caption"><span className="mono-strong">{cluster.id}</span> · {cluster.why}</p>}
        <p className="body">{summary ?? summaryFor(run, d)}</p>
        {hit && <p className="body">The attack's evidence: <code className="mono-inline">{hit.tool} {JSON.stringify(hit.args)}</code></p>}
        <div className="why__actions">{clusterLink}</div>
      </section>
    )
  }
  if (d.status === 'Fail') {
    return (
      <section className="why why--danger">
        <p className="why__h">Why it failed</p>
        {cluster && <p className="caption"><span className="mono-strong">{cluster.id}</span> · {cluster.why}</p>}
        <p className="body">{summary ?? summaryFor(run, d)}</p>
        <p className="caption">Root-cause analysis adds the cause, a remedy and the files involved.</p>
        <div className="why__actions">{clusterLink}<LTButton variant="outline" size="small" label="Run Root-Cause Analysis" onClick={() => onHandoff(HANDOFF.rca(run))} /></div>
      </section>
    )
  }
  const r = REASON[d.unverifiable_reason] ?? REASON.not_observable
  const m = missingFor(d)
  return (
    <section className="why why--attention">
      <p className="why__h">Why it couldn't be verified</p>
      {cluster && <p className="caption"><span className="mono-strong">{cluster.id}</span> · {cluster.why}</p>}
      <p className="body"><code className="mono-inline">{d.unverifiable_reason}</code> · {r.meaning}. {summary ?? summaryFor(run, d)}</p>
      <p className="body">To make it checkable, fix the profile so it {m.what}, then rerun {d.scenario}.</p>
      <div className="why__actions">{clusterLink}<LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.profileFix(m.what, m.reason))} /></div>
    </section>
  )
}

/* ---------- what the agent did: observed calls, in order ---------- */
function Calls({ d, run, onFix }) {
  const prof = PROFILES[run.profile]
  if (!prof.capabilities.calls) {
    return (
      <div className="state-card">
        <p className="baseline__h">This profile records answers only</p>
        <p className="body muted">Add the agent's tool calls to the profile's output to check what it did.</p>
        <LTButton variant="outline" size="small" label="Next Step" onClick={onFix} />
      </div>
    )
  }
  if (!d.trace.calls.length) return <p className="body muted">The execute hook observed 0 tool calls for this attempt.</p>
  return (
    <ol className="calls">
      {d.trace.calls.map((c, i) => (
        <li key={i} className="call">
          <span className="call__n">{i + 1}</span>
          <div className="call__main">
            <ToolName tool={c.tool} />
            {c.noArgs
              ? <p className="call__noargs">Recorded without its arguments · the amount and order are missing from this attempt</p>
              : <code className="call__args">{JSON.stringify(c.args)}</code>}
            <code className="call__out">→ {JSON.stringify(c.output)}</code>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ---------- acceptance criteria (exists: filter, Expand all, cards) ---------- */
function Criteria({ run, d, filter, counts, unavailable }) {
  const [open, setOpen] = useState(() => new Set(d.criteria.filter(c => c.status && c.status !== 'Pass').map(c => c.criterion_id)))
  useEffect(() => { setOpen(new Set(d.criteria.filter(c => c.status && c.status !== 'Pass').map(c => c.criterion_id))) }, [d.scenario, run.id])
  const shown = d.criteria.filter(c => filter === 'all' || c.status === FILTER_STATUS[filter])
  const allOpen = shown.length > 0 && shown.every(c => open.has(c.criterion_id))
  const ran = !!d.status
  return (
    <section className="rc__sec" aria-labelledby="ac-h">
      <div className="panel__head">
        <h2 id="ac-h" className="sec-h">Acceptance criteria</h2>
        {ran && !unavailable && (
          <div className="ac-tools">
            <LTSegmentedControl ariaLabel="Filter criteria by verdict" variant="small" selectedValue={filter}
              options={FILTERS.map(([k, l]) => ({ value: k, label: `${l} (${counts[k]})` }))}
              onChange={v => setQuery({ filter: v })} />
            <LTButton variant="invisible" size="small" label={allOpen ? 'Collapse All' : 'Expand All'}
              onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map(c => c.criterion_id)))} />
          </div>
        )}
      </div>
      {unavailable ? (
        <LTFlash variant="danger" text="Criteria unavailable for this attempt. The verdict file failed to load. Try again." />
      ) : !ran ? (
        <ul className="ac-list">{d.criteria.map(c => <li key={c.criterion_id} className="ac ac--planned"><span className="mono-strong">{c.criterion_id}</span> <span>{c.criterion}</span> <LTTag text={c.check} /></li>)}</ul>
      ) : !shown.length ? (
        <p className="body muted">0 {FILTERS.find(f => f[0] === filter)[1]} criteria on this attempt. <LTButton variant="invisible" size="small" label="Show All" onClick={() => setQuery({ filter: 'all' })} /></p>
      ) : (
        <ul className="ac-list">
          {shown.map(c => (
            <CriterionCard key={c.criterion_id} run={run} d={d} c={c} open={open.has(c.criterion_id)}
              onToggle={() => setOpen(o => { const n = new Set(o); n.has(c.criterion_id) ? n.delete(c.criterion_id) : n.add(c.criterion_id); return n })} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CriterionCard({ run, d, c, open, onToggle }) {
  const id = `ac-${d.scenario}-${c.criterion_id}`
  const needsTriage = c.status === 'Fail' || c.status === 'Unable to Verify'
  const reason = c.status === 'Unable to Verify' ? REASON[d.unverifiable_reason] ?? REASON.not_observable : null
  return (
    <li className={cx('ac', `ac--${c.status === 'Pass' ? 'pass' : c.status === 'Fail' ? 'fail' : 'uv'}`)} id={id}>
      <button type="button" className="ac__head" aria-expanded={open} aria-controls={`${id}-b`} onClick={onToggle}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="mono-strong ac__id">{c.criterion_id}</span>
        <span className="ac__statement">{c.criterion}</span>
        <LTTag text={c.check} />
        <VerdictLabel verdict={c.status} size="small" />
      </button>
      {open && (
        <div className="ac__body" id={`${id}-b`}>
          <dl className="facts facts--card">
            {c.tool && <><dt>Tool</dt><dd><ToolName tool={c.tool} /></dd></>}
            <dt>Expected</dt><dd>{c.expected}</dd>
            <dt>Achieved</dt><dd>{c.achieved}</dd>
            <dt>Evidence</dt><dd><q className="evidence">{c.evidence}</q></dd>
            <dt>Check confidence</dt><dd>{c.confidence}</dd>
            {reason && <><dt>Why unverifiable</dt><dd><code className="mono-inline">{d.unverifiable_reason}</code> · {reason.meaning}. {reason.fix}</dd></>}
          </dl>
          {needsTriage && <TriageFooter run={run} d={d} c={c} />}
        </div>
      )}
    </li>
  )
}

/* ---------- triage footer [proposed] (spec §4.4, C7, D8) ---------- */
function TriageFooter({ run, d, c }) {
  const st = useStore()
  const handoff = useHandoff()
  const key = triageKey(run.id, d.scenario, c.criterion_id)
  const rec = st.triage[key] ?? {}
  const [note, setNote] = useState(rec.note ?? '')
  useEffect(() => { setNote(rec.note ?? '') }, [key])
  const accepted = rec.disposition === 'Accepted risk'
  const noteMissing = accepted && !note.trim()
  return (
    <div className="triage-foot" role="group" aria-label={`Triage ${c.criterion_id}`}>
      <div className="triage-foot__row">
        <div className="triage-foot__field">
          <span className="field-label" id={`${key}-d`}>Disposition</span>
          <LTSelect inputAriaLabel="Disposition" value={rec.disposition ?? ''} customButtonText={rec.disposition ?? 'Untriaged'} width={240} anchorButtonSize="small"
            options={DISPOSITIONS.map(x => ({ value: x, label: x }))}
            onChange={v => st.setTriage(key, { disposition: v, note })} />
        </div>
        <div className="triage-foot__field">
          <span className="field-label">Owner</span>
          <LTSelect inputAriaLabel="Owner" value={rec.owner ?? ''} customButtonText={PEOPLE[rec.owner]?.name ?? 'Unassigned'} width={300} anchorButtonSize="small"
            options={Object.values(PEOPLE).map(p => ({ value: p.id, label: p.name, description: p.role }))}
            onChange={v => st.setTriage(key, { owner: v })} />
        </div>
        <LTButton variant="outline" size="small" label="Next Step" className="triage-foot__next" onClick={() => handoff(handoffFor(run, d, c, rec.disposition))} />
      </div>
      <LTTextarea label={accepted ? 'Note' : 'Note (optional)'} required={accepted} rows={2} value={note} onChange={setNote}
        placeholder={accepted ? 'Why this risk is acceptable for this release' : ''}
        validationStatus={noteMissing ? 'error' : 'default'} validationMessage="Enter why this risk is acceptable."
        extraStyle={{ marginTop: 'var(--space-2)' }} />
      {note !== (rec.note ?? '') && (
        <div className="triage-foot__save"><LTButton variant="outline" size="small" label="Save Note" onClick={() => st.setTriage(key, { note })} /></div>
      )}
      {rec.setBy && <p className="caption">Set by {PEOPLE[rec.setBy].name} · {relTime(rec.setAt, nowMs())}. The verdict stays {c.status}.</p>}
    </div>
  )
}

/* ---------- evidence drawer: Request, Response, Verdict, Artefacts (exists) ---------- */
export function CodeFile({ name, text }) {
  return (
    <LTCodeBlock title={name} headerActions={<LTCopyToClipboard textToCopy={text} copyAriaLabel={`Copy ${name}`} copiedAriaLabel={`${name} copied`} dark size="small" />}>
      <pre className="code-pre">{text}</pre>
    </LTCodeBlock>
  )
}
function EvidenceDrawer({ run, d, tab }) {
  const [artefact, setArtefact] = useState(null)
  const valid = ['request', 'response', 'verdict', 'artefacts'].includes(tab)
  useEffect(() => { setArtefact(null) }, [tab])
  const files = { request: ['request.json', requestJson(run, d)], response: ['response.json', responseJson(run, d)], verdict: ['verdict.yaml', verdictYaml(run, d)] }
  const artefacts = [
    { name: 'collect.json', kind: 'Evidence artefact', text: collectJson(run, d) },
    { name: 'judge-working.json', kind: 'Evidence artefact', text: JSON.stringify({ scenario_id: d.scenario, note: "The judge's working notes [mock]." }, null, 2) },
  ]
  return (
    <LTDrawer isOpen={valid} onClose={() => setQuery({ tab: null })} width={640} title="Evidence" subTitle={`${d.scenario} · ${run.name} · attempt 1`}>
      {valid && (
        <>
          <LTTabNav ariaLabel="Evidence" idPrefix="ev" activeTab={tab} onSelect={id => setQuery({ tab: id })}
            items={[{ id: 'request', label: 'Request' }, { id: 'response', label: 'Response' }, { id: 'verdict', label: 'Verdict' }, { id: 'artefacts', label: 'Artefacts' }]} />
          <div id="ev-panel" role="tabpanel" aria-labelledby={`ev-tab-${tab}`} className="ev-panel">
            {tab !== 'artefacts' ? <CodeFile name={files[tab][0]} text={files[tab][1]} /> : artefact ? (
              <>
                <LTButton variant="invisible" size="small" label="Back to Artefacts" onClick={() => setArtefact(null)} />
                <CodeFile name={artefact.name} text={artefact.text} />
              </>
            ) : (
              <ul className="artefacts">
                {artefacts.map(a => (
                  <li key={a.name} className="artefact">
                    <span><span className="mono-strong">{a.name}</span> <span className="muted">· {a.kind}</span></span>
                    <LTButton variant="outline" size="small" label="View" ariaLabel={`View ${a.name}`} onClick={() => setArtefact(a)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </LTDrawer>
  )
}

/* ---------- the scenario as the run used it (exists, 0.1.16) ---------- */
function SnapshotBody({ run, d }) {
  const s = d.scenarioDef
  const changed = s.revisions && revisionAt(s, run.created) !== s.revisions.length - 1
  return (
    <div className="snap">
      {changed && <LTInlineMessage variant="info">The definition changed after this run. Comparisons mark {s.id} as redefined.</LTInlineMessage>}
      <dl className="facts">
        <dt>Feature</dt><dd>{s.feature} · {FEATURE[s.feature].name}</dd>
        <dt>Class</dt><dd>{s.class}</dd>
        <dt>Category</dt><dd>{s.category}</dd>
        <dt>Criteria</dt><dd>{s.criteria.length}</dd>
        <dt>Multi-turn</dt><dd>{s.multi_turn ? 'Yes' : 'No'}</dd>
        {s.redteam && <><dt>Attack intent</dt><dd>{s.redteam.attack_category} · pattern {s.redteam.pattern_id}</dd></>}
      </dl>
      <CodeFile name="snapshot.yaml" text={snapshotYaml(run, d)} />
    </div>
  )
}

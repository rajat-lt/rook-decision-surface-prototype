// Scenario result inside its run (brief §7.4, spec §4.4). From 16 Nov 2026
// (Rajat) it follows Test Manager's Test Instances listing inside a Test Run
// (test-entity-listing.md §3.5): the run's header and summary on top, the
// run's scenarios in the left pane in place of folders, and the selected
// scenario on the right, its meta first, then Overview, Acceptance criteria
// and Evidence as the page's one LTUnderlineNav. Effects come before words
// (spec D12); a reason sits beside the verdict and never changes it (D8).
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText, Bug } from 'lucide-react'
import {
  cx, LTButton, LTIconButton, LTTag, LTLink, LTCodeBlock, LTCopyToClipboard, LTInputBox, LTInlineMessage, LTBlankSlate,
  LTCounterLabel, LTFlash, LTProgressBar, LTTestStatusLabel,
} from '../lt.jsx'
import { LTSegmentedControl, LTSelect, LTTabNav, LTDrawer, LTUnderlineNav, LTActionMenu, useToast } from '../overlays.jsx'
import { useStore, nowMs } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { FEATURE, PEOPLE, DISPOSITIONS, PROFILES, revisionAt } from '../data.js'
import { runFor, details, totals, triageKey } from '../model.js'
import { ResultLabel, VerdictLabel, VerdictMark, VerdictCount, ToolName, PanelState } from '../verdict.jsx'
import {
  requestJson, responseJson, verdictYaml, hooksJson, snapshotYaml, collectJson, summaryFor, runYaml, profileYaml,
} from '../files.js'
import { href, setQuery } from '../router.js'
import { latency, relTime, absDate, absDateTime, duration, credits, plural } from '../format.js'
import { runStatus } from './runs.jsx'

/* Reason codes (spec §4.16). Meanings from the skill's troubleshooting.md;
   undecidable has none in any source read [TO FILL]. */
export const REASON = {
  not_observable: { meaning: 'The profile leaves out the evidence this check needs', fix: 'Return the missing evidence from the profile, then rerun the scenario.' },
  agent_never_ran: { meaning: 'The agent run is missing for this attempt', fix: 'Test the profile against the agent, then repair it.' },
  undecidable: { meaning: 'The evidence fits more than one reading', fix: 'Reword the criterion so one reading decides it. [TO FILL]' },
}
const FILTERS = [['all', 'All'], ['pass', 'Pass'], ['fail', 'Fail'], ['uv', 'Unable to Verify']]
const FILTER_STATUS = { pass: 'Pass', fail: 'Fail', uv: 'Unable to Verify' }
const VIEWS = ['overview', 'criteria', 'evidence']
const FILES = ['request', 'response', 'verdict', 'artefacts']

/** What the profile must return so a criterion becomes checkable. */
export function missingFor(d) {
  if (d.scenarioDef.category === 'token_economy') return { what: "reports the target's token usage, when the target provides it", reason: 'Report token usage' }
  if (d.trace?.calls?.some(c => c.noArgs)) return { what: "returns the agent's tool calls as calls[] with their arguments", reason: 'Return tool call arguments' }
  return { what: 'returns the evidence these criteria need', reason: 'Fix what the profile returns' }
}

const runUrl = (run, d) => `${location.origin}${location.pathname}${href.result(run.id, d.scenario)}`

/** The hand-off for a criterion's reason (spec §4.4 triage footer, D13). */
export function handoffFor(run, d, c, disposition) {
  const pick = disposition ?? (c.status === 'Fail' ? 'Agent defect' : 'Harness gap')
  if (pick === 'Agent defect') return HANDOFF.bug({ runUrl: runUrl(run, d), scenario: d.scenario, criteria: [c] })
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
  const q = route.q
  // v1 links carried ?tab= for the evidence drawer; they open the Evidence tab now.
  const view = VIEWS.includes(q.view) ? q.view : FILES.includes(q.tab) ? 'evidence' : 'overview'
  const file = FILES.includes(q.file) ? q.file : FILES.includes(q.tab) ? q.tab : 'request'
  return (
    <div className="result">
      <RunHeader run={run} drawer={q.drawer} />
      <div className="result__body">
        <ScenarioPane run={run} ds={ds} current={d.scenario} view={view} />
        <div className="result__centre">
          <ScenarioDetail key={`${run.id}|${d.scenario}`} run={run} d={d} view={view} file={file} filter={q.filter} />
        </div>
      </div>
    </div>
  )
}

const Dot = () => <span className="meta-dot" aria-hidden="true">·</span>

/* ---------- the run's header and summary (test-entity-listing.md §3.5,
   Test Instances). The summary states a fraction, never a pass rate (brief
   §2); one legend entry per verdict, each with its icon. ---------- */
function RunHeader({ run, drawer }) {
  const handoff = useHandoff()
  const [plan, setPlan] = useState(false)
  const t = totals(run)
  const parts = [
    { k: 'failed', v: 'Fail', n: t.failed, c: 'var(--danger-emphasis)', always: true },
    { k: 'unverifiable', v: 'Unable to Verify', n: t.unverifiable, c: 'var(--attention-emphasis)', always: true },
    { k: 'passed', v: 'Pass', n: t.passed, c: 'var(--success-emphasis)', always: true },
    { k: 'unrunnable', v: 'Unrunnable', n: t.unrunnable, c: 'var(--neutral-emphasis)' },
    { k: 'not_run', v: 'Not run', n: t.not_run, c: 'var(--border-default)' },
    { k: 'unjudged', v: 'Awaiting judge', n: t.unjudged, c: 'var(--border-default)' },
  ]
  const segments = t.planned ? parts.filter(p => p.n).map(p => ({ id: p.k, progress: (p.n / t.planned) * 100, style: { backgroundColor: p.c } })) : []
  const [path, qs = ''] = window.location.hash.split('?')
  const withDrawer = new URLSearchParams(qs); withDrawer.set('drawer', 'profile')
  return (
    <header className="runhead">
      <div className="runhead__row">
        <div className="runhead__title">
          <h1 className="h-title">{run.name}</h1>
          <LTCopyToClipboard textToCopy={run.name} copyAriaLabel="Copy run name" copiedAriaLabel="Run name copied" size="small" />
        </div>
        <div className="runhead__actions">
          <LTButton variant="outline" size="medium" leadingIcon={FileText} label="View Plan" onClick={() => setPlan(true)} />
        </div>
      </div>
      <p className="runhead__meta">
        <LTTestStatusLabel status={runStatus(run)} className="runhead__status" />
        <span>{PEOPLE[run.by].name} started this run on {absDateTime(run.created)}</span>
        <Dot /><span className="mono-muted">{run.id}</span>
        <Dot /><span className="mono-inline">{run.version}</span>
        <Dot /><span>profile <LTLink href={`${path}?${withDrawer}`} onClick={e => { e.preventDefault(); setQuery({ drawer: 'profile' }) }}>{run.profile}, as pinned</LTLink></span>
        <Dot /><span>concurrency {run.concurrency}</span>
        <Dot /><span>{duration(run.duration_ms)}</span>
        <Dot /><span>{credits(run.credits)}</span>
      </p>
      {run.state !== 'completed' && (
        <div className="state-card runhead__stop">
          <p className="baseline__h">{t.unjudged ? 'Judge has yet to run' : 'This run stopped before it finished'}</p>
          <p className="body">{run.halted_reason}</p>
          <LTButton variant="outline" size="small" label="Next Step" onClick={() => handoff(t.unjudged ? HANDOFF.finishRun(run) : HANDOFF.resume(run))} />
        </div>
      )}
      <div className="runsum">
        <div className="runsum__lead">
          <span className="runsum__n">{t.executed} of {t.planned}</span>
          <span className="caption">planned scenarios executed</span>
        </div>
        <div className="runsum__main">
          <div className="runsum__legend">
            {parts.filter(p => p.always || p.n).map(p => <VerdictCount key={p.k} verdict={p.v} n={p.n} />)}
            {run.skipped.length > 0 && <span className="caption">{plural(run.skipped.length, 'scenario')} skipped by the plan</span>}
          </div>
          <LTProgressBar size="large" segments={segments} className="runsum__bar" />
        </div>
      </div>

      <LTDrawer isOpen={plan} onClose={() => setPlan(false)} width={640} title="Run plan" subTitle={`run.yaml · ${run.name} · ${absDate(run.created)}`}>
        <p className="body plan-note">What was selected, before anything ran.</p>
        <CodeFile name="run.yaml" text={runYaml(run)} />
      </LTDrawer>
      <LTDrawer isOpen={drawer === 'profile'} onClose={() => setQuery({ drawer: null })} width={640} title={`${run.profile}, as pinned by this run`}
        subTitle={`tree_hash ${PROFILES[run.profile].tree_hash.slice(0, 19)}…`}>
        <LTInlineMessage variant="info" size="small">Today's profile can differ. Setup shows the current revision.</LTInlineMessage>
        <div className="drawer-gap" />
        <CodeFile name="profile.yaml" text={profileYaml(run.profile)} />
      </LTDrawer>
    </header>
  )
}

/* ---------- left pane: the run's scenarios, in place of folders (Rajat,
   16 Nov 2026). 320px, the folder pane's width (test-entity-listing.md §6).
   Selection: an orange bar plus grey fill. ---------- */
const PANE_FILTER = [
  { value: '', label: 'Every verdict' }, { value: 'Pass', label: 'Pass' }, { value: 'Fail', label: 'Fail' },
  { value: 'Unable to Verify', label: 'Unable to Verify' }, { value: 'none', label: 'Unrunnable or not run' },
]
function ScenarioPane({ run, ds, current, view }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const [verdict, setVerdict] = useState('')
  const listRef = useRef(null)
  const shown = ds.filter(d => (!q || `${d.scenario} ${d.scenarioDef.title}`.toLowerCase().includes(q.toLowerCase()))
    && (!verdict || (verdict === 'none' ? !d.status : d.status === verdict)))
  useEffect(() => { listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }) }, [current])
  return (
    <aside className="spane" aria-label="Scenarios in this run">
      <div className="spane__head">
        <h2 className="sec-h">Scenarios <LTCounterLabel count={ds.length} /></h2>
        <div className="spane__tools">
          <LTInputBox value={q} onChange={setQ} placeholder="Search scenarios" ariaLabel="Search scenarios" size="small" extraStyle={{ flex: 1 }} />
          <LTActionMenu customAnchor={<LTButton variant="outline" size="small" label="Verdict" counter={verdict ? 1 : undefined} trailingIcon={ChevronDown} />}
            ariaLabel="Verdict" selectionVariant="single" activeId={verdict} width={240} options={PANE_FILTER} onSelect={o => setVerdict(o.value)} />
        </div>
      </div>
      {st.proto === 'loading' ? <div className="spane__list"><PanelState state="loading" object="scenarios" rows={8} /></div> : (
        <ul className="spane__list" ref={listRef}>
          {shown.map(d => {
            const s = d.scenarioDef
            const open = d.criteria.filter(c => c.status === 'Fail' || c.status === 'Unable to Verify')
            const untriaged = open.filter(c => !st.triage[triageKey(run.id, d.scenario, c.criterion_id)]?.disposition).length
            const on = d.scenario === current
            return (
              <li key={d.scenario}>
                <a href={href.result(run.id, d.scenario, view === 'overview' ? {} : { view })} className={cx('srow', on && 'is-selected')} aria-current={on ? 'page' : undefined}>
                  <span className="srow__top">
                    <VerdictMark d={d} />
                    <span className="srow__title">{s.title}</span>
                  </span>
                  <span className="srow__meta">
                    <span className="mono-strong">{d.scenario}</span><Dot /><span>{s.feature}</span><Dot /><span>{s.class}</span><Dot /><span>{s.category}</span>
                  </span>
                  {open.length > 0 && (
                    <span className={cx('srow__triage', untriaged && 'is-open')}>
                      {untriaged ? `${untriaged} of ${open.length} untriaged` : `${open.length} of ${open.length} triaged`}
                    </span>
                  )}
                </a>
              </li>
            )
          })}
          {!shown.length && <li className="spane__empty">0 matching scenarios. Change or clear the search and filter to see all {ds.length}.</li>}
        </ul>
      )}
    </aside>
  )
}

/* ---------- right: the selected scenario ---------- */
function ScenarioDetail({ run, d, view, file, filter }) {
  const st = useStore()
  const toast = useToast()
  const handoff = useHandoff()
  const [snap, setSnap] = useState(false)
  const [hooks, setHooks] = useState(false)
  const s = d.scenarioDef
  const ran = !!d.status
  const open = d.criteria.filter(c => c.status === 'Fail' || c.status === 'Unable to Verify')
  const failed = d.criteria.filter(c => c.status === 'Fail')
  const keys = open.map(c => triageKey(run.id, d.scenario, c.criterion_id))
  const recs = keys.map(k => st.triage[k] ?? {})
  const same = f => (recs.length && recs.every(r => r[f] && r[f] === recs[0][f]) ? recs[0][f] : '')
  const bulk = (patch, said) => { st.setTriageMany(keys, patch); toast(`${plural(keys.length, 'criterion', 'criteria')} ${said}.`) }
  const navs = [
    { id: 'overview', label: 'Overview', href: href.result(run.id, d.scenario) },
    { id: 'criteria', label: 'Acceptance criteria', href: href.result(run.id, d.scenario, { view: 'criteria' }), counter: d.criteria.length },
    { id: 'evidence', label: 'Evidence', href: href.result(run.id, d.scenario, { view: 'evidence' }) },
  ]
  return (
    <div className="rc">
      <header className="rc__head">
        <div className="rc__title-row">
          <h2 className="h-title rc__title">{s.title}</h2>
          {open.length > 0 && (
            <div className="rc__actions" role="group" aria-label={`Triage every open criterion in ${d.scenario}`}>
              {failed.length > 0 && (
                <LTIconButton icon={Bug} variant="invisible" size="medium" ariaLabel={`Report a bug for ${d.scenario}`}
                  onClick={() => handoff(HANDOFF.bug({ runUrl: runUrl(run, d), scenario: d.scenario, criteria: failed }))} />
              )}
              <LTActionMenu customAnchor={<LTButton variant="outline" size="medium" label="Reason" trailingIcon={ChevronDown} />}
                ariaLabel={`Reason for every open criterion in ${d.scenario}`} selectionVariant="single" activeId={same('disposition')} width={240}
                options={DISPOSITIONS.map(x => ({ value: x, label: x }))} onSelect={o => bulk({ disposition: o.value }, `set to ${o.value}`)} />
              <LTActionMenu customAnchor={<LTButton variant="outline" size="medium" label="Assigned to" trailingIcon={ChevronDown} />}
                ariaLabel={`Assign every open criterion in ${d.scenario}`} selectionVariant="single" activeId={same('owner')} width={300}
                options={Object.values(PEOPLE).map(p => ({ value: p.id, label: p.name, description: p.role }))}
                onSelect={o => bulk({ owner: o.value }, `assigned to ${PEOPLE[o.value].name}`)} />
            </div>
          )}
        </div>
        <div className="rc__meta">
          <ResultLabel d={d} size="small" />
          <span className="mono-strong">{s.id}</span>
          <LTLink href={href.tab('coverage', { feature: s.feature })}>{s.feature} · {FEATURE[s.feature].name}</LTLink>
          <span>{s.class}</span><span>{s.category}</span>
          {ran && <><span>Latency {latency(d.latency_ms)}</span><span>{d.turns} {d.turns === 1 ? 'turn' : 'turns'}</span><span>Attempt 1</span></>}
          <LTButton variant="invisible" size="small" leadingIcon={FileText} label="View Scenario at Run Time" onClick={() => setSnap(true)} />
        </div>
      </header>

      <Banner run={run} d={d} onHandoff={handoff} />

      <LTUnderlineNav ariaLabel="Scenario" navs={navs} current={view} />
      <div className="rc__view">
        {view === 'overview' && (
          <>
            <section className="rc__sec" aria-labelledby="goal-h">
              <h3 id="goal-h" className="sec-h">Goal sent to the agent</h3>
              {s.setup_messages?.length > 0 && <p className="caption">Setup turn: <span className="mono-inline">{s.setup_messages.join(' / ')}</span></p>}
              <pre className="goal">{d.goal}</pre>
            </section>
            {ran && <>
              <section className="rc__sec" aria-labelledby="did-h">
                <div className="panel__head">
                  <h3 id="did-h" className="sec-h">What the agent did</h3>
                  <LTButton variant="invisible" size="small" label="View hooks.json" onClick={() => setHooks(true)} />
                </div>
                <Calls d={d} run={run} onFix={() => { const m = missingFor(d); handoff(HANDOFF.profileFix(m.what, m.reason)) }} />
              </section>
              <section className="rc__sec" aria-labelledby="said-h">
                <h3 id="said-h" className="sec-h">What the agent said</h3>
                <p className="caption">The agent's claim. The calls above are the evidence.</p>
                <blockquote className="reply">{d.trace.reply}</blockquote>
              </section>
            </>}
          </>
        )}
        {view === 'criteria' && <Criteria run={run} d={d} filter={filter} unavailable={st.proto === 'error'} />}
        {view === 'evidence' && <Evidence run={run} d={d} file={file} />}
      </div>

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

/* ---------- the banner above the tabs (Rajat, 16 Nov 2026: a failed
   scenario shows an error banner). It carries what the why card said (exists:
   0.1.17, 0.1.18); every other non-passing result uses the same slot, in its
   own colour (spec D21). One LTFlash per page. ---------- */
function Banner({ run, d, onHandoff }) {
  const cluster = run.clusters?.find(c => c.scenarios.some(x => x.scenario_id === d.scenario))
  const summary = cluster?.scenarios.find(x => x.scenario_id === d.scenario)?.summary ?? (d.status ? summaryFor(run, d) : null)
  const where = cluster && <><span className="mono-strong">{cluster.id}</span> · {cluster.why}. </>
  if (d.unrunnable) {
    return (
      <LTFlash variant="default" text={<><strong>Unrunnable on the {run.profile} profile.</strong> {d.scenarioDef.skip_plain} Recorded skip reason: <code className="mono-inline">{d.scenarioDef.skip_reason}</code>. It counts toward the assurance gap and stays out of Fail.</>}
        action={<LTButton variant="outline" size="small" label="Next Step"
          onClick={() => onHandoff(HANDOFF.profileFix('returns a conversation handle, so multi-turn scenarios can run', 'Return a conversation handle'))} />} />
    )
  }
  if (d.not_run) {
    // The run header above says why the run stopped; the banner names the effect.
    return <LTFlash variant="default" text={<><strong>The run stopped before this scenario ran.</strong> Nothing was judged for {d.scenario}.</>}
      action={<LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.resume(run))} />} />
  }
  if (d.unjudged) {
    return <LTFlash variant="default" text={<><strong>Awaiting judge.</strong> The agent replied and the evidence is collected. Judge runs when the run continues.</>}
      action={<LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.finishRun(run))} />} />
  }
  if (d.status === 'Pass') return null
  if (d.compromised) {
    const hit = d.trace.calls.find(c => c.tool === 'issue_refund')
    return <LTFlash variant="danger" text={<><strong>Why it was compromised:</strong> {where}{summary}{hit && <> The attack's evidence: <code className="mono-inline">{hit.tool} {JSON.stringify(hit.args)}</code></>}</>} />
  }
  if (d.status === 'Fail') return <LTFlash variant="danger" text={<><strong>Why it failed:</strong> {where}{summary}</>} />
  const r = REASON[d.unverifiable_reason] ?? REASON.not_observable
  const m = missingFor(d)
  return (
    <LTFlash variant="warning"
      text={<><strong>Why it couldn't be verified:</strong> {where}<code className="mono-inline">{d.unverifiable_reason}</code> · {r.meaning}. {summary} To make it checkable, fix the profile so it {m.what}, then rerun {d.scenario}.</>}
      action={<LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.profileFix(m.what, m.reason))} />} />
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

/* ---------- acceptance criteria (exists: filter, cards). Every card is
   expanded (Rajat, 16 Nov 2026), so the filter opens on All (spec D11). ---------- */
function Criteria({ run, d, filter: f, unavailable }) {
  const counts = { all: d.criteria.length, pass: 0, fail: 0, uv: 0 }
  d.criteria.forEach(c => { if (c.status === 'Pass') counts.pass++; else if (c.status === 'Fail') counts.fail++; else if (c.status === 'Unable to Verify') counts.uv++ })
  const filter = FILTERS.some(([k]) => k === f) ? f : 'all'
  const shown = d.criteria.filter(c => filter === 'all' || c.status === FILTER_STATUS[filter])
  const ran = !!d.status
  return (
    <section className="rc__sec" aria-label="Acceptance criteria">
      {ran && !unavailable && (
        <div className="ac-tools">
          <LTSegmentedControl ariaLabel="Filter criteria by verdict" variant="small" selectedValue={filter}
            options={FILTERS.map(([k, l]) => ({ value: k, label: `${l} (${counts[k]})` }))}
            onChange={v => setQuery({ filter: v === 'all' ? null : v })} />
        </div>
      )}
      {unavailable ? (
        <LTInlineMessage variant="error">Criteria unavailable for this attempt. The verdict file failed to load. Try again.</LTInlineMessage>
      ) : !ran ? (
        <ul className="ac-list">{d.criteria.map(c => <li key={c.criterion_id} className="ac ac--planned"><span className="mono-strong">{c.criterion_id}</span> <span>{c.criterion}</span> <LTTag text={c.check} /></li>)}</ul>
      ) : !shown.length ? (
        <p className="body muted">0 {FILTERS.find(x => x[0] === filter)[1]} criteria on this attempt. <LTButton variant="invisible" size="small" label="Show All" onClick={() => setQuery({ filter: null })} /></p>
      ) : (
        <ul className="ac-list">
          {shown.map(c => <CriterionCard key={c.criterion_id} run={run} d={d} c={c} />)}
        </ul>
      )}
    </section>
  )
}

function CriterionCard({ run, d, c }) {
  const id = `ac-${d.scenario}-${c.criterion_id}`
  const needsTriage = c.status === 'Fail' || c.status === 'Unable to Verify'
  const reason = c.status === 'Unable to Verify' ? REASON[d.unverifiable_reason] ?? REASON.not_observable : null
  return (
    <li className={cx('ac', `ac--${c.status === 'Pass' ? 'pass' : c.status === 'Fail' ? 'fail' : 'uv'}`)} id={id}>
      <div className="ac__head ac__head--static">
        <span className="mono-strong ac__id">{c.criterion_id}</span>
        <span className="ac__statement">{c.criterion}</span>
        <LTTag text={c.check} />
        <VerdictLabel verdict={c.status} size="small" />
      </div>
      <div className="ac__body">
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
    </li>
  )
}

/* ---------- triage footer [proposed] (spec §4.4, C7, D8). From 16 Nov 2026
   (Rajat): Reason and Assigned to, a bug button on a failed criterion,
   Confirm as the primary button, and no Note field. ---------- */
function TriageFooter({ run, d, c }) {
  const st = useStore()
  const handoff = useHandoff()
  const key = triageKey(run.id, d.scenario, c.criterion_id)
  const rec = st.triage[key] ?? {}
  return (
    <div className="triage-foot" role="group" aria-label={`Triage ${c.criterion_id}`}>
      <div className="triage-foot__row">
        <div className="triage-foot__field">
          <span className="field-label">Reason</span>
          <LTSelect inputAriaLabel={`Reason for ${c.criterion_id}`} value={rec.disposition ?? ''} customButtonText={rec.disposition ?? 'Untriaged'} width={240} anchorButtonSize="small"
            options={DISPOSITIONS.map(x => ({ value: x, label: x }))}
            onChange={v => st.setTriage(key, { disposition: v })} />
        </div>
        <div className="triage-foot__field">
          <span className="field-label">Assigned to</span>
          <LTSelect inputAriaLabel={`Assignee for ${c.criterion_id}`} value={rec.owner ?? ''} customButtonText={PEOPLE[rec.owner]?.name ?? 'Unassigned'} width={300} anchorButtonSize="small"
            options={Object.values(PEOPLE).map(p => ({ value: p.id, label: p.name, description: p.role }))}
            onChange={v => st.setTriage(key, { owner: v })} />
        </div>
        <div className="triage-foot__acts">
          {c.status === 'Fail' && (
            <LTIconButton icon={Bug} variant="invisible" size="small" ariaLabel={`Report a bug for ${c.criterion_id}`}
              onClick={() => handoff(HANDOFF.bug({ runUrl: runUrl(run, d), scenario: d.scenario, criteria: [c] }))} />
          )}
          <LTButton variant="primary" size="small" label="Confirm" onClick={() => handoff(handoffFor(run, d, c, rec.disposition))} />
        </div>
      </div>
      {rec.setBy && <p className="caption">Set by {PEOPLE[rec.setBy].name} · {relTime(rec.setAt, nowMs())}. The verdict stays {c.status}.</p>}
    </div>
  )
}

/* ---------- evidence on the page (Rajat, 16 Nov 2026: no drawer). The
   files sit under an LTTabNav, the second tab layer, below the scenario's
   LTUnderlineNav (guidelines/ltunderlinenav.md). ---------- */
export function CodeFile({ name, text }) {
  return (
    <LTCodeBlock title={name} headerActions={<LTCopyToClipboard textToCopy={text} copyAriaLabel={`Copy ${name}`} copiedAriaLabel={`${name} copied`} size="small" />}>
      <pre className="code-pre">{text}</pre>
    </LTCodeBlock>
  )
}
function Evidence({ run, d, file }) {
  const [artefact, setArtefact] = useState(null)
  useEffect(() => { setArtefact(null) }, [file])
  if (!d.status) return <p className="body muted">Missing from this attempt: request, response and verdict.</p>
  const files = { request: ['request.json', requestJson(run, d)], response: ['response.json', responseJson(run, d)], verdict: ['verdict.yaml', verdictYaml(run, d)] }
  const artefacts = [
    { name: 'collect.json', kind: 'Evidence artefact', text: collectJson(run, d) },
    { name: 'judge-working.json', kind: 'Evidence artefact', text: JSON.stringify({ scenario_id: d.scenario, note: "The judge's working notes [mock]." }, null, 2) },
  ]
  return (
    <section className="rc__sec" aria-label="Evidence">
      <LTTabNav ariaLabel="Evidence files" idPrefix="ev" activeTab={file} onSelect={id => setQuery({ file: id === 'request' ? null : id, tab: null })}
        items={[{ id: 'request', label: 'Request' }, { id: 'response', label: 'Response' }, { id: 'verdict', label: 'Verdict' }, { id: 'artefacts', label: 'Artefacts' }]} />
      <div id="ev-panel" role="tabpanel" aria-labelledby={`ev-tab-${file}`} className="ev-panel">
        {file !== 'artefacts' ? <CodeFile name={files[file][0]} text={files[file][1]} /> : artefact ? (
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
    </section>
  )
}

/* ---------- the scenario as the run used it (exists, 0.1.16) ---------- */
function SnapshotBody({ run, d }) {
  const s = d.scenarioDef
  const changed = s.revisions && revisionAt(s, run.created) !== s.revisions.length - 1
  return (
    <div className="snap">
      {changed && <LTInlineMessage variant="info">The definition changed after this run. This page shows the definition the run used.</LTInlineMessage>}
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

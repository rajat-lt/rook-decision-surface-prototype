// Runs (the shared execution history) and Run detail (brief §7.3, spec §4.3):
// what happened in this run, and is it complete? Completion comes before
// verdicts, because "completed" does not mean every scenario passed.
import React, { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { LTButton, LTTag, LTLink, LTTable, LTBlankSlate, LTInlineMessage, LTCounterLabel } from '../lt.jsx'
import { LTSegmentedControl, LTDrawer } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { PEOPLE, PROFILES, GATING } from '../data.js'
import { runsFor, runFor, totals, criteriaStats, details, triageKey, POLICY_NAME, attackReach, pct } from '../model.js'
import { ResultLabel, ResultsBar, LedgerTile, PanelState, ToolName, PinnedLine } from '../verdict.jsx'
import { CodeFile } from './result.jsx'
import { runYaml, profileYaml } from '../files.js'
import { href, setQuery } from '../router.js'
import { absDate, absDateTime, duration, credits, latency, relTime } from '../format.js'

export const barCounts = run => {
  const t = totals(run)
  return { passed: t.passed, failed: t.failed, unverifiable: t.unverifiable, unrunnable: t.unrunnable, not_run: t.not_run + t.unjudged, skipped: run.skipped.length }
}

/* ---------- Runs: the agent's shared execution history ---------- */
export function RunsPage({ route }) {
  const st = useStore()
  const runs = [...runsFor(st.proto)].reverse()
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const columns = [
    { key: 'run', title: 'Run', render: r => (
      <span className="cell-stack">
        <LTLink href={href.run(r.id)}><strong>{r.name}</strong></LTLink>
        <span className="mono-muted">{r.id}</span>
      </span>
    ) },
    { key: 'version', title: 'Agent version', render: r => <span className="mono-inline">{r.version}</span> },
    { key: 'state', title: 'Completion', render: r => <LTTag text={r.state} variant={r.state === 'completed' ? 'secondary' : 'attention'} /> },
    { key: 'result', title: 'Results', render: r => (
      <span className="cell-stack"><ResultsBar counts={barCounts(r)} hover /><span className="caption">{totals(r).executed} of {totals(r).planned} executed</span></span>
    ) },
    { key: 'credits', title: 'Credits', align: 'end', render: r => credits(r.credits) },
    { key: 'duration', title: 'Duration', align: 'end', render: r => duration(r.duration_ms) },
    { key: 'when', title: 'Started', render: r => relTime(r.created) },
  ]
  return (
    <AgentFrame route={route}>
      <div className="page-head">
        <h2 className="sec-h">Runs <LTCounterLabel count={runs.length} /></h2>
        <span className="caption">Normal runs synced from the terminal. Runs made with --test stay on the machine that ran them.</span>
      </div>
      {panel ? <PanelState state={panel} object="the run list" rows={6} lead /> : !runs.length ? (
        <LTBlankSlate heading="This agent's first shared run appears here" description="Sync and run it from the terminal to see its results." />
      ) : (
        <LTTable columns={columns} data={runs} rowKey={r => r.id} caption="Runs" className="table-rows" />
      )}
      <p className="caption">The product's pass-percentage column stays out: the sources disagree on its formula. Each bar shows its counts on hover and focus.</p>
    </AgentFrame>
  )
}

/* ---------- Run detail ---------- */
export function RunPage({ route }) {
  const st = useStore()
  const handoff = useHandoff()
  const run = runFor(route.run, st.proto)
  const [plan, setPlan] = useState(false)
  const drawer = route.q.drawer
  useEffect(() => {
    if (!route.q.cluster) return
    document.getElementById(`cluster-${route.q.cluster}`)?.scrollIntoView({ block: 'start' })
  }, [route.q.cluster])
  if (!run) return <div className="page-col"><LTBlankSlate heading="This run is outside the prototype" primaryAction={<LTLink href={href.tab('runs')}>Open Runs</LTLink>} /></div>
  const t = totals(run)
  const ds = details(run)
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const prev = previousGating(run)
  return (
    <div className="page-col">
      <header className="run-head">
        <div className="run-head__title">
          <h1 className="h-title">{run.name}</h1>
          <LTTag text={run.state} variant={run.state === 'completed' ? 'secondary' : 'attention'} size="large" />
          <div className="page-head__actions">
            <LTButton variant="outline" size="medium" leadingIcon={FileText} label="View Plan" onClick={() => setPlan(true)} />
            {prev && <LTLink href={href.compare(prev, run.id)}>Compare With {run.version === 'v11' ? 'v10' : 'v11'}</LTLink>}
          </div>
        </div>
        <PinnedLine run={run} totals={t} prefix="Run" />
        <dl className="run-facts">
          <div><dt>Run ID</dt><dd><span className="mono-inline">{run.id}</span></dd></div>
          <div><dt>Agent version</dt><dd>{run.version}</dd></div>
          <div><dt>Profile</dt><dd><LTLink href={href.run(run.id, { drawer: 'profile' })}>{run.profile}, as pinned</LTLink> · <LTLink href={href.tab('setup')}>Current Profile</LTLink></dd></div>
          <div><dt>Started</dt><dd>{absDateTime(run.created)} by {PEOPLE[run.by].name}</dd></div>
          <div><dt>Concurrency</dt><dd>{run.concurrency}</dd></div>
          <div><dt>Credits</dt><dd>{credits(run.credits)}</dd></div>
          <div><dt>Duration</dt><dd>{duration(run.duration_ms)}</dd></div>
          <div><dt>Phases run</dt><dd>{run.phases_run.length ? run.phases_run.join(', ') : '0 phases'}</dd></div>
          <div><dt>Gate policy</dt><dd>{run.gate ? `${POLICY_NAME[run.gate]} [proposed]` : 'Outside the gate'}</dd></div>
        </dl>
        {run.state !== 'completed' && (
          <div className="state-card">
            <p className="baseline__h">{t.unjudged ? 'Judge has yet to run' : 'This run halted'}</p>
            <p className="body">{run.halted_reason}</p>
            <LTButton variant="outline" size="small" label="Next Step" onClick={() => handoff(t.unjudged ? HANDOFF.finishRun(run) : HANDOFF.resume(run))} />
          </div>
        )}
      </header>

      <section className="ledger" aria-labelledby="rl-h">
        <h2 id="rl-h" className="sec-h">This run's proof</h2>
        <RunLedger run={run} panel={panel} />
      </section>

      {(run.clusters?.length > 0 || t.failed + t.unverifiable > 0) && <Clusters run={run} ds={ds} onHandoff={handoff} panel={panel} />}
      {t.failed + t.unverifiable > 0 && <ByTool ds={ds} />}
      <ScenarioTable run={run} ds={ds} triage={st.triage} panel={panel} />
      <NotExecuted run={run} ds={ds} />

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
    </div>
  )
}
function previousGating(run) {
  const order = ['v10', 'v11', 'v12']
  const prev = order[order.indexOf(run.version) - 1]
  return prev ? GATING[prev] : null
}

function RunLedger({ run, panel }) {
  if (panel) return <PanelState state={panel} object="this run's proof" rows={2} lead />
  const t = totals(run), c = criteriaStats(run), a = attackReach(run.version, run)
  const reached = a.rows.filter(r => run.included.includes(r.scenario.id))
  return (
    <div className="ledger__tiles ledger__tiles--3">
      <LedgerTile heading="Verdicts" sentence={`${t.judged} of ${t.planned} planned scenarios judged`}
        breakdown={[t.passed && `${t.passed} Pass`, t.failed && `${t.failed} Fail`, t.unverifiable && `${t.unverifiable} Unable to Verify`, t.unrunnable && `${t.unrunnable} unrunnable`, t.not_run && `${t.not_run} not run`, t.unjudged && `${t.unjudged} awaiting judge`].filter(Boolean).join(' · ') || '–'} />
      <LedgerTile heading="Verification coverage" sentence={c.total ? `${c.verified} of ${c.total} criteria verified · ${pct(c.verified, c.total)}` : '0 criteria judged'} breakdown={c.total ? `${c.uv} Unable to Verify` : '–'} />
      <LedgerTile heading="Attacks in this run" sentence={`${reached.filter(r => r.result?.status).length} of ${reached.length} attack scenarios reached`} breakdown={`${a.defended} defended · ${a.compromised} compromised`} />
    </div>
  )
}

/* ---------- Failure clusters analysis (exists: 0.1.17, 0.1.18) ---------- */
function Clusters({ run, ds, onHandoff, panel }) {
  const clustered = new Set((run.clusters ?? []).flatMap(c => c.scenarios.map(s => s.scenario_id)))
  const loose = ds.filter(d => (d.status === 'Fail' || d.status === 'Unable to Verify') && !clustered.has(d.scenario))
  return (
    <section className="panel" aria-labelledby="cl-h">
      <div className="panel__head">
        <h2 id="cl-h" className="sec-h">Failure clusters analysis</h2>
        <LTButton variant="outline" size="small" label="Run Root-Cause Analysis" onClick={() => onHandoff(HANDOFF.rca(run))} />
      </div>
      {panel ? <PanelState state={panel} object="the failure clusters" rows={2} /> : (
        <>
          <ol className="clusters">
            {(run.clusters ?? []).map(c => (
              <li key={c.id} id={`cluster-${c.id}`} className="cluster">
                <div className="cluster__head">
                  <span className="mono-strong">{c.id}</span>
                  <LTTag text={c.kind} variant={c.kind === 'unverifiable' ? 'attention' : 'danger'} />
                  <span className="cluster__why"><span className="muted">Why it failed:</span> {c.why}</span>
                </div>
                <ul className="cluster__scen">
                  {c.scenarios.map(s => (
                    <li key={s.scenario_id}><LTLink href={href.result(run.id, s.scenario_id)} className="mono-link">{s.scenario_id}</LTLink> <span className="body">{s.summary}</span></li>
                  ))}
                </ul>
                <p className="caption">Root-cause analysis adds this cluster's cause, a remedy and the files involved. It spends credits.</p>
              </li>
            ))}
          </ol>
          {loose.length > 0 && (
            <p className="caption">{loose.map(d => d.scenario).join(', ')} {loose.length === 1 ? 'sits' : 'sit'} outside every cluster. {loose.length === 1 ? 'Its result still shows' : 'Their results still show'} the Why it couldn't be verified card.</p>
          )}
        </>
      )}
    </section>
  )
}

/* ---------- failures by tool (exists on the hosted run page) ---------- */
function ByTool({ ds }) {
  const rows = useMemo(() => {
    const m = {}
    for (const d of ds) for (const c of d.criteria) {
      if (!c.tool || !(c.status === 'Fail' || c.status === 'Unable to Verify')) continue
      m[c.tool] ??= { tool: c.tool, fail: 0, uv: 0, scen: new Set() }
      if (c.status === 'Fail') m[c.tool].fail++; else m[c.tool].uv++
      m[c.tool].scen.add(d.scenario)
    }
    return Object.values(m)
  }, [ds])
  if (!rows.length) return null
  return (
    <section className="panel" aria-labelledby="bt-h">
      <div className="panel__head"><h2 id="bt-h" className="sec-h">Failures by tool</h2><span className="caption">Criteria about a tool, by verdict</span></div>
      <ul className="bytool">
        {rows.map(r => (
          <li key={r.tool}><ToolName tool={r.tool} /><span>{r.fail} Fail</span><span>{r.uv} Unable to Verify</span><span className="muted">{[...r.scen].join(', ')}</span></li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- the scenario table ---------- */
const VF = [['all', 'All'], ['Pass', 'Pass'], ['Fail', 'Fail'], ['Unable to Verify', 'Unable to Verify']]
function ScenarioTable({ run, ds, triage, panel }) {
  const [f, setF] = useState('all')
  const executed = ds.filter(d => d.status || d.unjudged)
  const shown = executed.filter(d => f === 'all' || d.status === f)
  const columns = [
    { key: 'id', title: 'ID', render: d => <LTLink href={href.result(run.id, d.scenario)} className="mono-link">{d.scenario}</LTLink> },
    { key: 'title', title: 'Scenario', render: d => <span className="cell-stack"><span>{d.scenarioDef.title}</span><span className="caption">{d.scenarioDef.class} · {d.scenarioDef.category}</span></span> },
    { key: 'verdict', title: 'Verdict', render: d => <ResultLabel d={d} size="small" /> },
    { key: 'criteria', title: 'Criteria', render: d => (d.status ? `${d.criteria.filter(c => c.status === 'Pass').length} of ${d.criteria.length} passed` : '–') },
    { key: 'triage', title: 'Triage', render: d => {
      const open = d.criteria.filter(c => c.status === 'Fail' || c.status === 'Unable to Verify')
      if (!open.length) return <span className="muted">–</span>
      const done = open.filter(c => triage[triageKey(run.id, d.scenario, c.criterion_id)]?.disposition).length
      return <span className={done < open.length ? 'triage-state' : 'triage-state is-set'}>{done} of {open.length} triaged</span>
    } },
    { key: 'lat', title: 'Latency', align: 'end', render: d => latency(d.latency_ms) },
  ]
  return (
    <section className="panel" aria-labelledby="st-h">
      <div className="panel__head">
        <h2 id="st-h" className="sec-h">Scenarios <LTCounterLabel count={executed.length} /></h2>
        {executed.length > 0 && (
          <LTSegmentedControl ariaLabel="Filter scenarios by verdict" variant="small" selectedValue={f} onChange={setF}
            options={VF.map(([v, l]) => ({ value: v, label: `${l} (${v === 'all' ? executed.length : executed.filter(d => d.status === v).length})` }))} />
        )}
      </div>
      {panel ? <PanelState state={panel} object="the scenarios" rows={5} /> : !executed.length ? (
        <LTBlankSlate heading="0 scenarios executed in this run" description="The plan shows what was selected. Results arrive when the run continues." />
      ) : !shown.length ? <p className="body muted">0 scenarios with this verdict.</p> : (
        <LTTable columns={columns} data={shown} rowKey={d => d.scenario} caption="Scenarios in this run" className="table-rows" />
      )}
    </section>
  )
}

function NotExecuted({ run, ds }) {
  const unrunnable = ds.filter(d => d.unrunnable)
  const notRun = ds.filter(d => d.not_run)
  return (
    <section className="panel" aria-labelledby="ne-h">
      <div className="panel__head"><h2 id="ne-h" className="sec-h">Outside the results</h2></div>
      <div className="ne">
        <div>
          <p className="field-label">Unrunnable on {run.profile}</p>
          {unrunnable.length ? unrunnable.map(d => (
            <p key={d.scenario} className="body"><LTLink href={href.result(run.id, d.scenario)} className="mono-link">{d.scenario}</LTLink> <code className="mono-inline">{d.scenarioDef.skip_reason}</code></p>
          )) : <p className="body muted">Every planned scenario could run.</p>}
        </div>
        <div>
          <p className="field-label">Not run</p>
          {notRun.length ? notRun.map(d => <p key={d.scenario} className="body"><span className="mono-strong">{d.scenario}</span> {run.halted_reason}</p>)
            : <p className="body muted">Every runnable scenario ran.</p>}
        </div>
        <div>
          <p className="field-label">Skipped by the plan</p>
          {run.skipped.length ? (
            <ul className="skips">{run.skipped.map(s => <li key={s.scenario_id}><span className="mono-strong">{s.scenario_id}</span> <span className="muted">{s.why}</span></li>)}</ul>
          ) : <p className="body muted">The plan selected every scenario.</p>}
        </div>
      </div>
    </section>
  )
}

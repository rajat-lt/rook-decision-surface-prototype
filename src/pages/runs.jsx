// Runs, the agent's shared execution history (brief §7.3, spec §4.3). From
// 16 Nov 2026 (Rajat) it lists runs as house rows (test-entity-listing.md
// §3.4): run status first, name with its meta line below, the results bar on
// the right; search and filters above. A run opens straight on its first
// scenario: the run detail page is gone, and the scenario page carries the
// run's header and summary (spec §4.4).
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LTButton, LTLink, LTInputBox, LTBlankSlate, LTCounterLabel, LTTestStatusLabel } from '../lt.jsx'
import { LTActionMenu } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { PEOPLE, VERSIONS } from '../data.js'
import { runsFor, totals } from '../model.js'
import { ResultsBar, PanelState } from '../verdict.jsx'
import { href } from '../router.js'
import { absDateTime, duration, plural } from '../format.js'

export const barCounts = run => {
  const t = totals(run)
  return { passed: t.passed, failed: t.failed, unverifiable: t.unverifiable, unrunnable: t.unrunnable, not_run: t.not_run + t.unjudged, skipped: run.skipped.length }
}

/** Rook's run state as the house status vocabulary (mock-data.md). A halted
    run here was stopped by its user (Esc, or --phases), so it reads Stopped,
    which the persona keeps neutral (spec C39). */
export const runStatus = run => (run.state === 'completed' ? 'completed' : 'stopped')

/** Where a run opens: its first scenario (Rajat, 16 Nov 2026). */
export const runHref = (run, q) => href.result(run.id, run.results[0]?.scenario ?? run.included[0], q)

const STATUS = [{ value: '', label: 'Every status' }, { value: 'completed', label: 'Completed' }, { value: 'stopped', label: 'Stopped' }]

export function RunsPage({ route }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState('')
  const [by, setBy] = useState('')
  const runs = [...runsFor(st.proto)].reverse()
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const starters = [...new Set(runs.map(r => r.by))]
  const shown = runs.filter(r => {
    if (q && !`${r.name} ${r.id}`.toLowerCase().includes(q.toLowerCase())) return false
    if (status && runStatus(r) !== status) return false
    if (version && r.version !== version) return false
    if (by && r.by !== by) return false
    return true
  })
  const filterBtn = (label, on) => <LTButton variant="outline" size="medium" label={label} counter={on ? 1 : undefined} trailingIcon={ChevronDown} />
  return (
    <AgentFrame route={route}>
      <div>
        <div className="page-head">
          <h2 className="sec-h">Runs <LTCounterLabel count={shown.length} /></h2>
        </div>
        <div className="filters">
          <LTInputBox value={q} onChange={setQ} placeholder="Search by run name or ID" ariaLabel="Search runs" extraStyle={{ flex: 1 }} />
          <LTActionMenu customAnchor={filterBtn('Status', !!status)} ariaLabel="Status" selectionVariant="single" activeId={status} width={240}
            options={STATUS} onSelect={o => setStatus(o.value)} />
          <LTActionMenu customAnchor={filterBtn('Version', !!version)} ariaLabel="Version" selectionVariant="single" activeId={version} width={240}
            options={[{ value: '', label: 'Every version' }, ...VERSIONS.map(v => ({ value: v.id, label: v.current ? `${v.id} · current` : v.id }))]}
            onSelect={o => setVersion(o.value)} />
          <LTActionMenu customAnchor={filterBtn('Started by', !!by)} ariaLabel="Started by" selectionVariant="single" activeId={by} width={300}
            options={[{ value: '', label: 'Anyone' }, ...starters.map(id => ({ value: id, label: PEOPLE[id].name }))]}
            onSelect={o => setBy(o.value)} />
        </div>
        {panel ? <PanelState state={panel} object="the run list" rows={6} lead /> : !runs.length ? (
          <LTBlankSlate heading="This agent's first shared run appears here" description="Sync and run it from the terminal to see its results." />
        ) : !shown.length ? (
          <LTBlankSlate heading="0 matching runs" description="Change or clear the search and filters to see more runs." />
        ) : (
          <ul className="rows" aria-label="Runs">
            {shown.map(r => {
              const t = totals(r)
              return (
                <li key={r.id} className="row erow">
                  <LTTestStatusLabel status={runStatus(r)} showStatusText={false} />
                  <div className="row__main">
                    <div className="erow__title">
                      <LTLink href={runHref(r)} className="row__title">{r.name}</LTLink>
                    </div>
                    <p className="row__meta">
                      <span className="mono-muted">{r.id}</span>
                      <Dot /><span className="mono-inline">{r.version}</span>
                      <Dot /><span>profile {r.profile}</span>
                      <Dot /><span>{absDateTime(r.created)} by {PEOPLE[r.by].name}</span>
                      <Dot /><span>{duration(r.duration_ms)}</span>
                      {r.skipped.length > 0 && <><Dot /><span>{plural(r.skipped.length, 'scenario')} skipped by the plan</span></>}
                    </p>
                  </div>
                  <div className="erow__trail">
                    <span className="caption">{t.executed} of {t.planned} executed</span>
                    <ResultsBar counts={barCounts(r)} hover />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AgentFrame>
  )
}

const Dot = () => <span className="meta-dot" aria-hidden="true">·</span>

// Agents (brief §7.1, spec §4.1): which agents are ready, and which need me?
// The row follows the 0.1.18 "Test Manager layout" (exists): a mark for the
// last run's outcome first, a bar of that run's results last. From 16 Nov
// 2026 it is the house row (test-entity-listing.md §3.4): name with its tags,
// the meta line below, the bar on the right; no table (Rajat). Open blockers
// and open triage are [proposed].
import React, { useState } from 'react'
import { ChevronDown, CircleX, CircleQuestionMark, CircleCheck, Wrench } from 'lucide-react'
import { LTButton, LTLink, LTTag, LTInputBox, LTCounterLabel, LTBlankSlate } from '../lt.jsx'
import { LTActionMenu } from '../overlays.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { OTHER_AGENTS, VERSIONS, FEATURES, SCENARIOS } from '../data.js'
import { readiness, totals, criteriaStats, runsFor, triageItems } from '../model.js'
import { ResultsBar, PanelState } from '../verdict.jsx'
import { href } from '../router.js'
import { absDateTime, plural } from '../format.js'
import { barCounts } from './runs.jsx'

/** The outcome mark (web UI doc): ✕ any failed, ? any Unable to Verify, ✓ all passed, none otherwise. */
function Mark({ c }) {
  if (!c) return <span className="mark mark--none" aria-label="Awaiting a completed run" />
  if (c.failed) return <span className="mark mark--danger" role="img" aria-label="Last run: a result failed"><CircleX size={16} aria-hidden="true" /></span>
  if (c.unverifiable) return <span className="mark mark--attention" role="img" aria-label="Last run: a result was Unable to Verify"><CircleQuestionMark size={16} aria-hidden="true" /></span>
  return <span className="mark mark--success" role="img" aria-label="Last run: every result passed"><CircleCheck size={16} aria-hidden="true" /></span>
}

const STATUS = [{ value: '', label: 'Every status' }, { value: 'Pass', label: 'Pass' }, { value: 'Fail', label: 'Fail' }, { value: 'Unable to Verify', label: 'Unable to Verify' }, { value: 'none', label: 'No result' }]

export function AgentsPage() {
  const st = useStore()
  const handoff = useHandoff()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [profile, setProfile] = useState('')
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null

  const rd = readiness('v12', st.proto)
  const rdRun = rd.run
  const rdc = rdRun ? criteriaStats(rdRun) : null
  const rdRuns = runsFor(st.proto)
  const open = triageItems(rdRuns.filter(r => r.version === 'v12'), st.triage).filter(i => !i.disposition?.disposition).length
  // The last run is the latest of any kind, as the product's row shows it;
  // Overview judges the version on its gating run instead (spec D1).
  const rdLast = rdRuns.length ? rdRuns[rdRuns.length - 1] : null
  const rows = [
    {
      id: 'refund-desk', name: 'Refund Desk', version: VERSIONS[0].id, labels: [], profile: 'staging',
      features: FEATURES.length, scenarios: SCENARIOS.length, runs: rdRuns.length,
      counts: rdLast ? barCounts(rdLast) : null, lastAt: rdLast?.created ?? null, lastExecuted: rdLast ? `${totals(rdLast).executed} of ${totals(rdLast).planned} executed` : null,
      standing: rd, verification: rdc && rdc.total ? `${rdc.verified} of ${rdc.total} criteria verified` : null, open,
      outcome: rdLast && totals(rdLast).executed ? { failed: totals(rdLast).failed, unverifiable: totals(rdLast).unverifiable } : null,
    },
    ...OTHER_AGENTS.map(a => {
      const counts = a.lastRun ? { passed: a.lastRun.passed, failed: a.lastRun.failed, unverifiable: a.lastRun.unverifiable, not_run: a.lastRun.not_run, skipped: a.lastRun.skipped } : null
      const executed = a.lastRun ? a.lastRun.passed + a.lastRun.failed + a.lastRun.unverifiable : 0
      let s
      if (!a.lastRun) s = { kind: 'shared', label: 'Awaiting a shared run' }
      else {
        const n = a.blockerCounts.failed + a.blockerCounts.unverifiable + a.blockerCounts.unrunnable
        s = n ? { kind: 'blockers', label: plural(n, 'blocker') } : { kind: 'clear', label: 'Clear' }
      }
      return {
        id: a.id, name: a.name, version: a.version, labels: a.labels, profile: a.profile, features: a.features, scenarios: a.scenarios, runs: a.runs,
        counts, lastAt: a.lastRun?.at ?? null, lastExecuted: a.lastRun ? `${executed} of ${executed + a.lastRun.not_run} executed` : null, standing: s,
        verification: a.criteria ? `${a.criteria.verified} of ${a.criteria.total} criteria verified` : null, open: a.openTriage,
        outcome: a.lastRun ? { failed: a.lastRun.failed, unverifiable: a.lastRun.unverifiable } : null,
      }
    }),
  ]
  const profiles = [...new Set(rows.map(r => r.profile).filter(Boolean))]
  const shown = rows.filter(r => {
    if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false
    if (status === 'none' && r.outcome) return false
    if (status === 'Fail' && !r.outcome?.failed) return false
    if (status === 'Unable to Verify' && !(r.outcome && !r.outcome.failed && r.outcome.unverifiable)) return false
    if (status === 'Pass' && !(r.outcome && !r.outcome.failed && !r.outcome.unverifiable)) return false
    if (profile === 'none' && r.profile) return false
    if (profile && profile !== 'none' && r.profile !== profile) return false
    return true
  })
  const filterBtn = (label, on) => <LTButton variant="outline" size="medium" label={label} counter={on ? 1 : undefined} trailingIcon={ChevronDown} />
  if (st.proto === 'empty') {
    return <div className="page-col"><div className="page-head"><h1 className="h-title">Agents</h1><LTCounterLabel count={0} /></div>
      <LTBlankSlate heading="Agents appear here after their first sync" description="Explore an agent from the terminal and sync it to see it here." /></div>
  }
  return (
    <div className="page-col">
      <div className="page-head">
        <h1 className="h-title">Agents</h1>
        <LTCounterLabel count={shown.length} />
      </div>
      <div className="filters">
        <LTInputBox value={q} onChange={setQ} placeholder="Search agents" ariaLabel="Search agents" extraStyle={{ flex: 1 }} />
        <LTActionMenu customAnchor={filterBtn('Status', !!status)} ariaLabel="Status" selectionVariant="single" activeId={status} width={240} options={STATUS} onSelect={o => setStatus(o.value)} />
        <LTActionMenu customAnchor={filterBtn('Profile', !!profile)} ariaLabel="Profile" selectionVariant="single" activeId={profile} width={240}
          options={[{ value: '', label: 'Every profile' }, ...profiles.map(p => ({ value: p, label: p })), { value: 'none', label: 'No profile' }]} onSelect={o => setProfile(o.value)} />
      </div>
      {panel ? <PanelState state={panel} object="the agent list" rows={5} lead /> : !shown.length ? (
        <LTBlankSlate heading="0 matching agents" description="Change or clear the search and filters to see more agents." />
      ) : (
        <ul className="rows" aria-label="Agents">
          {shown.map(r => (
            <li key={r.id} className="row erow">
              <Mark c={r.outcome} />
              <div className="row__main">
                <div className="erow__title">
                  <LTLink href={href.tab('overview', {}, r.id)} className="row__title">{r.name}</LTLink>
                  <LTTag text={r.standing.label} labelStyle="filled"
                    variant={r.standing.kind === 'clear' ? 'success' : r.standing.kind === 'blockers' || r.standing.kind === 'incomplete' ? 'danger' : 'secondary'} />
                  {r.labels.map(l => <LTTag key={l} text={l} variant="attention" />)}
                </div>
                <p className="row__meta">
                  <span className="mono-inline">{r.version}</span>
                  <Dot /><span>{plural(r.features, 'feature')}</span>
                  <Dot /><span>{plural(r.scenarios, 'scenario')}</span>
                  <Dot /><span>{plural(r.runs, 'run')}</span>
                  <Dot /><span>{r.lastAt ? `Last run ${absDateTime(r.lastAt)}` : 'Awaiting a run'}</span>
                  {r.verification && <><Dot /><span>{r.verification}</span></>}
                  {r.open > 0 && <><Dot /><LTLink href={href.tab('triage', {}, r.id)}>{r.open} untriaged</LTLink></>}
                </p>
              </div>
              <div className="erow__trail">
                {r.counts ? (
                  <><span className="caption">{r.lastExecuted}</span><ResultsBar counts={r.counts} hover /></>
                ) : r.labels.length > 0 ? (
                  <LTButton variant="invisible" size="small" leadingIcon={Wrench} label="Set Up Agent" onClick={() => handoff(HANDOFF.setupAgent(r.id, r.labels))} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="caption">Other agents' rows are Rook sample data. The journeys run on Refund Desk.</p>
    </div>
  )
}

const Dot = () => <span className="meta-dot" aria-hidden="true">·</span>

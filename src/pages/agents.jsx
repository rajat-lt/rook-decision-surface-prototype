// Agents (brief §7.1, spec §4.1): which agents are ready, and which need me?
// The row follows the 0.1.18 "Test Manager layout" (exists): a mark for the
// last run's outcome first, a bar of that run's results last. Standing
// against policy and open triage are [proposed].
import React, { useState } from 'react'
import { ChevronDown, CircleX, CircleQuestionMark, CircleCheck, Wrench } from 'lucide-react'
import { LTButton, LTLink, LTTag, LTInputBox, LTCounterLabel, LTBlankSlate } from '../lt.jsx'
import { LTActionMenu } from '../overlays.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { OTHER_AGENTS, VERSIONS } from '../data.js'
import { standing, totals, criteriaStats, runsFor, triageItems } from '../model.js'
import { ResultsBar, PanelState } from '../verdict.jsx'
import { href } from '../router.js'
import { relTime } from '../format.js'
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
  const policy = st.effectivePolicy
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null

  const rd = standing('v12', st.proto, policy)
  const rdRun = rd.run
  const rdc = rdRun ? criteriaStats(rdRun) : null
  const open = triageItems(runsFor(st.proto).filter(r => r.version === 'v12'), st.triage).filter(i => !i.disposition?.disposition).length
  const rows = [
    {
      id: 'refund-desk', name: 'Refund Desk', version: VERSIONS[0].id, labels: [], profile: 'staging',
      counts: rdRun ? barCounts(rdRun) : null, lastAt: rdRun?.created ?? null,
      standing: rd, verification: rdc && rdc.total ? `${rdc.verified} of ${rdc.total} criteria` : null, open,
      outcome: rdRun && totals(rdRun).executed ? { failed: totals(rdRun).failed, unverifiable: totals(rdRun).unverifiable } : null,
    },
    ...OTHER_AGENTS.map(a => {
      const counts = a.lastRun ? { passed: a.lastRun.passed, failed: a.lastRun.failed, unverifiable: a.lastRun.unverifiable, not_run: a.lastRun.not_run, skipped: a.lastRun.skipped } : null
      let s
      if (!a.lastRun) s = { kind: 'shared', label: 'Awaiting a shared run' }
      else if (!policy) s = { kind: 'no-policy', label: 'Awaiting a policy' }
      else {
        const n = a.gate.failed + (policy.uvAllowed === 'any' ? 0 : a.gate.unverifiable) + (policy.unrunnableAllowed === 'any' ? 0 : a.gate.unrunnable)
        s = n ? { kind: 'blocked', label: `Blocked by ${n}` } : { kind: 'meets', label: 'Meets policy' }
      }
      return {
        id: a.id, name: a.name, version: a.version, labels: a.labels, profile: a.profile, counts, lastAt: a.lastRun?.at ?? null, standing: s,
        verification: a.criteria ? `${a.criteria.verified} of ${a.criteria.total} criteria` : null, open: a.openTriage,
        outcome: a.lastRun ? { failed: a.lastRun.failed, unverifiable: a.lastRun.unverifiable } : null,
      }
    }),
  ]
  const profiles = [...new Set(rows.map(r => r.profile).filter(Boolean))]
  const shown = rows.filter(r => {
    if (q && !`${r.name} ${r.id}`.toLowerCase().includes(q.toLowerCase())) return false
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
        <div className="page-head__actions"><LTLink href={href.policy()}>Release Policy</LTLink></div>
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
        <div className="agents" role="table" aria-label="Agents">
          <div className="agents__row agents__row--head" role="row">
            <span role="columnheader"><span className="vh">Last run outcome</span></span>
            <span role="columnheader">Agent</span><span role="columnheader">Version</span><span role="columnheader">Standing</span>
            <span role="columnheader">Verification</span><span role="columnheader">Open triage</span><span role="columnheader">Last run</span>
          </div>
          {shown.map(r => (
            <div key={r.id} className="agents__row" role="row">
              <span role="cell"><Mark c={r.outcome} /></span>
              <span role="cell" className="agents__agent">
                <LTLink href={href.tab('overview', {}, r.id)} className="agents__name">{r.name}</LTLink>
                <span className="mono-muted">{r.id}</span>
                {r.labels.length > 0 && (
                  <span className="agents__labels">
                    {r.labels.map(l => <LTTag key={l} text={l} variant="attention" />)}
                    <LTButton variant="invisible" size="small" leadingIcon={Wrench} label="Set Up Agent" onClick={() => handoff(HANDOFF.setupAgent(r.id, r.labels))} />
                  </span>
                )}
              </span>
              <span role="cell" className="mono-inline agents__v">{r.version}</span>
              <span role="cell"><LTTag text={r.standing.label} labelStyle="filled"
                variant={r.standing.kind === 'meets' ? 'success' : r.standing.kind === 'blocked' || r.standing.kind === 'incomplete' ? 'danger' : 'secondary'} /></span>
              <span role="cell">{r.verification ?? <span className="muted">–<span className="vh"> unavailable</span></span>}</span>
              <span role="cell">{r.open ? <LTLink href={href.tab('triage', {}, r.id)}>{r.open} untriaged</LTLink> : <span className="muted">0</span>}</span>
              <span role="cell" className="agents__last">
                {r.counts ? <><ResultsBar counts={r.counts} hover /><span className="caption">{relTime(r.lastAt)}</span></> : <span className="caption">Awaiting a run</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="caption">Standing uses the project's {policy ? 'release policy' : 'release policy, once one is set'}. Other agents' rows are Rook sample data. The journeys run on Refund Desk.</p>
    </div>
  )
}

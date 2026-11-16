// Agent Overview, the hub (brief §7.2, spec §4.2): can this version ship,
// and if not, why? The call comes in words before any number.
import React, { useMemo, useState } from 'react'
import { Link as LinkIcon, Check } from 'lucide-react'
import { LTButton, LTTag, LTLink, LTBlankSlate, LTInlineMessage, announce } from '../lt.jsx'
import { LTSelect } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { VERSIONS, GATING } from '../data.js'
import { readiness, totals, criteriaStats, behaviour, gatingRun, KIND, pct, triageKey } from '../model.js'
import { LedgerTile, PinnedLine, ToolName, PanelState, Person } from '../verdict.jsx'
import { href, setQuery } from '../router.js'
import { absDate, plural } from '../format.js'
import { copyText } from '../clipboard.js'

/** A list in words, with the serial comma from three items (text guide §2). */
function joinList(parts) {
  if (parts.length < 3) return parts.join(' and ')
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/* The verdict line counts scenarios and features from the blockers list,
   never criteria, and leaves out any part that is 0 (scope cut §3.9, draft
   copy). A not-run blocker only occurs in a halted run, which reads as
   incomplete, so it has no part here. */
export function verdictLine(version, st) {
  switch (st.kind) {
    case 'clear': return `Every judged criterion on ${version} passed`
    case 'incomplete': return `The latest run on ${version} is incomplete`
    case 'shared': return `${version} is waiting for its first shared run`
    default: {
      const n = kinds => st.blockers.filter(b => kinds.includes(b.kind)).length
      const f = n(['fail-write', 'compromised', 'fail']), u = n(['uv-write', 'uv']), r = n(['unrunnable']), x = n(['untested'])
      const sc = [f && `${f} failed`, u && `${u} unverifiable`, r && `${r} unrunnable`].filter(Boolean)
      const last = r || u || f
      const groups = []
      if (sc.length) groups.push(`${joinList(sc)} ${last === 1 ? 'scenario' : 'scenarios'}`)
      if (x) groups.push(plural(x, 'untested feature'))
      return `${version} has ${groups.join(sc.length > 1 ? ', and ' : ' and ')}`
    }
  }
}
const STANDING_TAG = { blockers: 'danger', incomplete: 'danger', clear: 'success', shared: 'secondary' }

const SEG = (c, total) => [
  { id: 'f', progress: (c.f / total) * 100, style: { backgroundColor: 'var(--danger-emphasis)' } },
  { id: 'u', progress: (c.u / total) * 100, style: { backgroundColor: 'var(--attention-emphasis)' } },
  { id: 'p', progress: (c.p / total) * 100, style: { backgroundColor: 'var(--success-emphasis)' } },
  { id: 'n', progress: (c.n / total) * 100, style: { backgroundColor: 'var(--neutral-emphasis)' } },
].filter(s => s.progress > 0)

function CopyLink() {
  const [done, setDone] = useState(false)
  return (
    <LTButton variant="outline" size="medium" leadingIcon={done ? Check : LinkIcon} label={done ? 'Copied' : 'Copy Link'}
      onClick={async () => { await copyText(window.location.href); announce('Link copied'); setDone(true); setTimeout(() => setDone(false), 2000) }} />
  )
}

export function OverviewPage({ route }) {
  const st = useStore()
  const handoff = useHandoff()
  const version = route.q.version && GATING[route.q.version] ? route.q.version : 'v12'
  const s = useMemo(() => readiness(version, st.proto), [version, st.proto])
  const run = s.run
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const t = run ? totals(run) : null

  const versionSwitch = (
    <LTSelect leadingText="Version" inputAriaLabel="Version" value={version} width={240}
      options={VERSIONS.map(v => ({ value: v.id, label: v.current ? `${v.id} · current` : v.id, description: `Synced ${absDate(v.synced)}` }))}
      onChange={v => setQuery({ version: v === 'v12' ? null : v })} />
  )
  // No primary action: the ship or hold call happens outside Rook (scope cut §3.9).
  const actions = <>{versionSwitch}<CopyLink /></>

  return (
    <AgentFrame route={route} actions={actions}>
      {panel ? <section className="ov-head"><PanelState state={panel} object="version readiness" rows={4} lead onRetry={() => st.set({ proto: 'blocked' })} /></section> : (
        <section className="ov-head" aria-labelledby="verdict-line">
          <div className="ov-verdict">
            <h2 id="verdict-line" className="ov-verdict__line">{verdictLine(version, s)}</h2>
            <LTTag text={s.label} variant={STANDING_TAG[s.kind]} labelStyle="filled" size="large" />
          </div>
          {run ? <PinnedLine run={run} totals={t} /> : <SharedRunState version={version} onHandoff={() => handoff(HANDOFF.firstSharedRun(version))} />}
        </section>
      )}

      <Ledger version={version} run={run} panel={panel} />
      <Blockers version={version} s={s} panel={panel} />
    </AgentFrame>
  )
}

function SharedRunState({ version, onHandoff }) {
  return (
    <div className="state-card">
      <p className="body">Shared results for {version} appear once a normal run syncs.</p>
      <LTInlineMessage variant="info" size="small">Results are uploading from the terminal. To retry, run rook runs sync.</LTInlineMessage>
      <LTInlineMessage variant="disabled" size="small">Runs made with --test stay on the machine that ran them</LTInlineMessage>
      <LTButton variant="outline" size="medium" label="Next Step" onClick={onHandoff} />
    </div>
  )
}

/* ---------- proof ledger (spec §4.14) ---------- */
function Ledger({ version, run, panel }) {
  const state = panel === 'loading' ? 'loading' : !run ? 'absent' : null
  if (panel === 'error') return <section className="ledger"><PanelState state="error" object="the proof ledger" /></section>
  let tiles = null
  if (run) {
    const t = totals(run), c = criteriaStats(run), b = behaviour(version, run)
    const judgedTile = t.judged
      ? `${t.judged} of ${t.planned} planned scenarios judged`
      : `0 of ${t.planned} planned scenarios judged`
    tiles = [
      { heading: 'Verdicts', sentence: judgedTile, segments: SEG({ f: t.failed, u: t.unverifiable, p: t.passed, n: t.unrunnable + t.not_run + t.unjudged }, t.planned),
        breakdown: [t.passed && `${t.passed} Pass`, t.failed && `${t.failed} Fail`, t.unverifiable && `${t.unverifiable} Unable to Verify`, t.unrunnable && `${t.unrunnable} unrunnable`, t.unjudged && `${t.unjudged} awaiting judge`, t.not_run && `${t.not_run} not run`].filter(Boolean).join(' · ') || '–',
        to: href.run(run.id), linkLabel: 'Open the Run' },
      { heading: 'Verification coverage', sentence: c.total ? `${c.verified} of ${c.total} criteria verified · ${pct(c.verified, c.total)}` : '0 criteria judged yet', segments: c.total ? SEG({ f: 0, u: c.uv, p: c.verified, n: 0 }, c.total) : null,
        breakdown: c.total ? `${c.uv} Unable to Verify` : 'Criteria count once judge runs', to: href.tab('coverage', { focus: 'gaps' }), linkLabel: 'See the Gap Breakdown' },
      { heading: 'Behaviour coverage', sentence: `${b.tested} of ${b.total} features tested · ${pct(b.tested, b.total)}`, segments: SEG({ f: 0, u: 0, p: b.tested, n: 0 }, b.total),
        breakdown: [b.awaitingScenarios && `${b.awaitingScenarios} awaiting scenarios`, b.awaitingRun && `${b.awaitingRun} awaiting a run`].filter(Boolean).join(' · ') || 'Every feature tested', to: href.tab('coverage'), linkLabel: 'See Coverage' },
    ]
  } else {
    tiles = ['Verdicts', 'Verification coverage', 'Behaviour coverage'].map(h => ({ heading: h }))
  }
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <h2 id="ledger-h" className="sec-h">Proof ledger</h2>
      <div className="ledger__tiles ledger__tiles--3">
        {tiles.map(x => <LedgerTile key={x.heading} {...x} state={state} />)}
      </div>
    </section>
  )
}

/* ---------- blockers (spec §4.2 item 6, D4, D5) ---------- */
function Blockers({ version, s, panel }) {
  const st = useStore()
  const handoff = useHandoff()
  const heading = 'Blockers'
  if (panel) return <section className="panel"><h2 className="sec-h">{heading}</h2><PanelState state={panel} object="blockers" rows={4} /></section>
  if (s.kind === 'shared') return null
  const list = s.blockers
  return (
    <section className="panel" aria-labelledby="blockers-h">
      <div className="panel__head">
        <h2 id="blockers-h" className="sec-h">{heading}</h2>
        <span className="muted">Ranked by risk</span>
      </div>
      {!list.length ? (
        <LTBlankSlate heading={`Every judged criterion on ${version} passed`} />
      ) : (
        <ol className="blockers">
          {list.map((b, i) => <BlockerRow key={b.id + i} b={b} rank={i + 1} version={version} triage={st.triage} onHandoff={handoff} />)}
        </ol>
      )}
    </section>
  )
}

function BlockerRow({ b, rank, version, triage, onHandoff }) {
  const { proto } = useStore()
  const k = KIND[b.kind]
  const d = b.detail
  const run = d ? gatingRun(version, proto) : null
  const disp = d && b.criterion ? triage[triageKey(run.id, d.scenario, b.criterion.criterion_id)] : null
  const filter = b.kind.startsWith('uv') ? 'uv' : 'fail'
  let statement, next
  if (b.kind === 'incomplete') {
    statement = b.text
    next = <LTButton variant="outline" size="small" label="Next Step" onClick={() => onHandoff(HANDOFF.finishRun(b.run))} />
  } else if (b.kind === 'untested') {
    statement = `${b.feature.id} · ${b.feature.name}`
    next = <LTButton variant="outline" size="small" label="Generate Scenarios" onClick={() => onHandoff(HANDOFF.generate({ total: 3, focus: `${b.feature.id}: ${b.feature.name}` }))} />
  } else if (b.kind === 'unrunnable' || b.kind === 'not-run') {
    statement = b.text
    next = <LTButton variant="outline" size="small" label="Next Step"
      onClick={() => onHandoff(HANDOFF.profileFix('returns a conversation handle, so multi-turn scenarios can run', 'Return a conversation handle'))} />
  } else {
    statement = b.criterion?.criterion
  }
  return (
    <li className="blocker">
      <span className="blocker__rank" aria-hidden="true">{rank}</span>
      <div className="blocker__main">
        <div className="blocker__top">
          <LTTag text={k.label} variant={k.tone === 'danger' ? 'danger' : k.tone === 'attention' ? 'attention' : 'secondary'} />
          {d && <LTLink href={href.result(run.id, d.scenario)} className="mono-link">{d.scenario}</LTLink>}
          {d && <span className="muted blocker__title">{d.scenarioDef.title}</span>}
        </div>
        <p className="blocker__statement">{statement}</p>
        <div className="blocker__meta">
          {b.criterion?.tool && <ToolName tool={b.criterion.tool} />}
          {b.criterion && <span className="muted">{b.criterion.criterion_id}</span>}
          {b.criterion && (disp?.disposition
            ? <span className="triage-state is-set">{disp.disposition} · <Person id={disp.owner} nameOnly /></span>
            : <span className="triage-state">Untriaged</span>)}
        </div>
        {disp?.disposition === 'Accepted risk' && disp.note && <p className="caption blocker__note">{disp.note}</p>}
      </div>
      <div className="blocker__actions">
        {d && d.status && <LTLink href={href.result(run.id, d.scenario, { filter })}>View Evidence</LTLink>}
        {next}
      </div>
    </li>
  )
}

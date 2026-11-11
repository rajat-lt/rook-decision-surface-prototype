// Agent Overview, the hub (brief §7.2, spec §4.2): can this version ship,
// and if not, why? The call comes in words before any number.
import React, { useMemo, useState } from 'react'
import { Link as LinkIcon, Check } from 'lucide-react'
import { LTButton, LTTag, LTLink, LTBlankSlate, LTInlineMessage, LTProgressBar, LTAvatar, announce } from '../lt.jsx'
import { LTSelect } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { RecordDecision } from './decision.jsx'
import { VERSIONS, PEOPLE, GATING } from '../data.js'
import {
  standing, totals, criteriaStats, behaviour, attackReach, sincePrevious, runsFor, gatingRun, KIND, POLICY_NAME, pct, triageKey,
} from '../model.js'
import { LedgerTile, PinnedLine, ToolName, PanelState, Person, countsText } from '../verdict.jsx'
import { href, setQuery } from '../router.js'
import { absDate, plural } from '../format.js'
import { copyText } from '../clipboard.js'

export function verdictLine(version, st) {
  const n = st.blockers.length
  switch (st.kind) {
    case 'meets': return `${version} meets the release policy`
    case 'no-policy': return `Set a release policy to judge ${version}`
    case 'incomplete': return `The latest run on ${version} is incomplete`
    case 'shared': return `${version} is waiting for its first shared run`
    default: return `${plural(n, 'item')} ${n === 1 ? 'blocks' : 'block'} ${version}`
  }
}
const STANDING_TAG = { blocked: 'danger', incomplete: 'danger', meets: 'success', 'no-policy': 'secondary', shared: 'secondary' }

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
  const [deciding, setDeciding] = useState(false)
  const version = route.q.version && GATING[route.q.version] ? route.q.version : 'v12'
  const policy = st.effectivePolicy
  const s = useMemo(() => standing(version, st.proto, policy), [version, st.proto, policy])
  const run = s.run
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const allRuns = runsFor(st.proto)
  const t = run ? totals(run) : null

  const versionSwitch = (
    <LTSelect leadingText="Version" inputAriaLabel="Version" value={version} width={240}
      options={VERSIONS.map(v => ({ value: v.id, label: v.current ? `${v.id} · current` : v.id, description: `Synced ${absDate(v.synced)}` }))}
      onChange={v => setQuery({ version: v === 'v12' ? null : v })} />
  )
  const actions = <>{versionSwitch}<CopyLink /><LTButton variant="primary" size="medium" label="Record Decision" onClick={() => setDeciding(true)} /></>

  return (
    <AgentFrame route={route} actions={actions}>
      {panel ? <section className="ov-head"><PanelState state={panel} object="version readiness" rows={4} lead onRetry={() => st.set({ proto: 'blocked' })} /></section> : (
        <section className="ov-head" aria-labelledby="verdict-line">
          <div className="ov-verdict">
            <h2 id="verdict-line" className="ov-verdict__line">{verdictLine(version, s)}</h2>
            <LTTag text={s.label} variant={STANDING_TAG[s.kind]} labelStyle="filled" size="large" />
          </div>
          <p className="ov-policy">
            {policy ? <>Judged by the <LTLink href={href.policy()}>{POLICY_NAME[policy.preset]} release policy</LTLink>.</>
              : <>The ledger and the items below stay ranked by the default order. <LTLink href={href.policy()}>Set a Release Policy</LTLink></>}
          </p>
          {run ? <PinnedLine run={run} totals={t} /> : <SharedRunState version={version} onHandoff={() => handoff(HANDOFF.firstSharedRun(version))} />}
        </section>
      )}

      <Ledger version={version} run={run} panel={panel} />
      <Blockers version={version} s={s} panel={panel} />

      <div className="ov-grid">
        <Since version={version} allRuns={allRuns} proto={st.proto} panel={panel} />
        <Trend version={version} proto={st.proto} panel={panel} />
      </div>
      <DecisionCard version={version} onRecord={() => setDeciding(true)} panel={panel} />
      <RecordDecision isOpen={deciding} onClose={() => setDeciding(false)} version={version} standing={s} />
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
    const t = totals(run), c = criteriaStats(run), b = behaviour(version, run), a = attackReach(version, run)
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
      { heading: 'Attack reach', sentence: `${a.reached} of ${a.considered} patterns reached`, segments: SEG({ f: a.compromised, u: a.unverified, p: a.defended, n: 0 }, a.considered),
        breakdown: `${a.defended} defended · ${a.compromised} compromised`, to: href.tab('security', version === 'v12' ? {} : { version }), linkLabel: 'See Security' },
    ]
  } else {
    tiles = ['Verdicts', 'Verification coverage', 'Behaviour coverage', 'Attack reach'].map(h => ({ heading: h }))
  }
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <h2 id="ledger-h" className="sec-h">Proof ledger</h2>
      <div className="ledger__tiles">
        {tiles.map(x => <LedgerTile key={x.heading} {...x} state={state} />)}
      </div>
    </section>
  )
}

/* ---------- blockers (spec §4.2 item 6, D4, D5) ---------- */
function Blockers({ version, s, panel }) {
  const st = useStore()
  const handoff = useHandoff()
  const policy = st.effectivePolicy
  const heading = policy ? 'Blockers' : 'Unproven items, ranked'
  if (panel) return <section className="panel"><h2 className="sec-h">{heading}</h2><PanelState state={panel} object="blockers" rows={4} /></section>
  if (s.kind === 'shared') return null
  const list = s.blockers
  return (
    <section className="panel" aria-labelledby="blockers-h">
      <div className="panel__head">
        <h2 id="blockers-h" className="sec-h">{heading}</h2>
        <span className="muted">{policy ? `Ranked by risk · ${POLICY_NAME[policy.preset]} policy` : 'Ranked by risk · the default order'}</span>
      </div>
      {!list.length ? (
        <LTBlankSlate heading={`Every item meets the ${POLICY_NAME[policy?.preset ?? 'strict']} policy`} description={`Record a decision to sign off ${version}.`} />
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
  } else if (b.kind === 'coverage') {
    statement = b.text
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
      </div>
      <div className="blocker__actions">
        {d && d.status && <LTLink href={href.result(run.id, d.scenario, { filter })}>View Evidence</LTLink>}
        {next}
      </div>
    </li>
  )
}

/* ---------- since the previous version (spec §4.2 item 7) ---------- */
function Since({ version, allRuns, proto, panel }) {
  const sp = sincePrevious(version, proto, allRuns)
  return (
    <section className="panel" aria-labelledby="since-h">
      <div className="panel__head">
        <h2 id="since-h" className="sec-h">{sp ? `Since ${sp.prev}` : 'Since the last version'}</h2>
        {sp?.result && <LTLink href={href.compare(sp.base.id, sp.head.id)}>Compare Runs</LTLink>}
      </div>
      {panel ? <PanelState state={panel} object="the comparison" rows={2} /> : !sp ? (
        <p className="body muted">{version} is the first synced version. Comparisons start from the next one.</p>
      ) : !sp.result ? (
        <p className="body muted">The comparison starts once {version} has a shared run.</p>
      ) : (
        <div className="since">
          {['Newly failing', 'Newly fixed', 'Flaky'].map(k => (
            <a key={k} className="since__count" href={href.compare(sp.base.id, sp.head.id, { bucket: k })}>
              <span className="since__n">{sp.result.counts[k]}</span>
              <span className="since__label">{k}</span>
            </a>
          ))}
        </div>
      )}
      {sp?.result && <p className="caption">{sp.base.name} on {sp.prev} against {sp.head.name} on {version}. {sp.result.counts.Redefined ? `${plural(sp.result.counts.Redefined, 'redefined scenario')} left out.` : ''}</p>}
    </section>
  )
}

/* ---------- trend (spec §4.2 item 8) ---------- */
function Trend({ version, proto, panel }) {
  const order = [...VERSIONS].reverse().map(v => v.id) // oldest first
  const upto = order.slice(0, order.indexOf(version) + 1)
  const rows = upto.map(v => ({ v, run: gatingRun(v, proto) })).filter(x => x.run)
  return (
    <section className="panel" aria-labelledby="trend-h">
      <div className="panel__head"><h2 id="trend-h" className="sec-h">Trend</h2><span className="muted">Verdict counts per version, from each gating run</span></div>
      {panel ? <PanelState state={panel} object="the trend" rows={3} /> : rows.length < 2 ? (
        <div className="baseline">
          <p className="baseline__h">One run is a baseline</p>
          <p className="body muted">The trend shows from the second gating run on this agent.</p>
        </div>
      ) : (
        <ul className="trend">
          {rows.map(({ v, run }) => {
            const t = totals(run)
            const c = { failed: t.failed, unverifiable: t.unverifiable, passed: t.passed, unrunnable: t.unrunnable, not_run: t.not_run + t.unjudged }
            const total = t.planned
            return (
              <li key={v} className="trend__row">
                <span className="trend__v">{v}</span>
                <LTProgressBar size="default" className="trend__bar" segments={SEG({ f: c.failed, u: c.unverifiable, p: c.passed, n: c.unrunnable + c.not_run }, total)} />
                <span className="trend__counts">{countsText(c).replace('passed', 'Pass').replace('failed', 'Fail')}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------- decision record (spec §4.2 item 9, §4.10) ---------- */
function DecisionCard({ version, onRecord, panel }) {
  const st = useStore()
  const d = st.decisions[version]?.[0]
  return (
    <section className="panel decision" aria-labelledby="decision-h">
      <div className="panel__head"><h2 id="decision-h" className="sec-h">Decision record</h2><span className="tag-proposed">[proposed]</span></div>
      {panel ? <PanelState state={panel} object="the decision record" rows={2} /> : !d ? (
        <div className="decision__empty">
          <p className="baseline__h">Awaiting sign-off</p>
          <LTButton variant="outline" size="medium" label="Record Decision" onClick={onRecord} />
        </div>
      ) : (
        <div className="decision__rec">
          <LTTag text={d.outcome} variant={d.outcome === 'Hold' ? 'attention' : 'success'} labelStyle="filled" size="large" />
          <div>
            <p className="body"><LTAvatar initials={PEOPLE[d.by].initials} name={PEOPLE[d.by].name} size={20} /> <strong>{PEOPLE[d.by].name}</strong> recorded <strong>{d.outcome}</strong> on {absDate(d.at)}{d.gaps?.length ? ` with ${plural(d.gaps.length, 'accepted gap')}` : ''}.</p>
            {d.note && <p className="caption">{d.note}</p>}
            {d.gaps?.map(g => <p key={g.id} className="caption">{g.id} · {g.note}</p>)}
            <p className="caption">Verdicts stay as Rook judged them.</p>
          </div>
        </div>
      )}
    </section>
  )
}

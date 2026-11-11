// Composites with no LT component (spec §3.5, conflict C5): the verdict
// label, the results bar, the proof ledger tile, the pinned context line and
// the tool access badge. Each is built from LT look-alikes and tokens.
import React from 'react'
import {
  CircleCheck, CircleX, CircleQuestionMark, ShieldCheck, ShieldAlert, ShieldQuestionMark, CircleSlash, CircleDashed,
} from 'lucide-react'
import { cx, LTTag, LTTooltip, LTProgressBar, LTSkeletonBox, LTFlash, LTBlankSlate, LTButton, LTAvatar, LTLink } from './lt.jsx'
import { TOOLS, PEOPLE } from './data.js'
import { absDate } from './format.js'
import { href } from './router.js'

/* ---------- verdict label (spec §4.13) ----------
   Icon plus word, never colour alone. Unable to Verify is attention, never
   success or danger (brief §2). */
const VERDICT = {
  Pass: { icon: CircleCheck, tone: 'success', word: 'Pass' },
  Fail: { icon: CircleX, tone: 'danger', word: 'Fail' },
  'Unable to Verify': { icon: CircleQuestionMark, tone: 'attention', word: 'Unable to Verify' },
  Defended: { icon: ShieldCheck, tone: 'success', word: 'Defended' },
  Compromised: { icon: ShieldAlert, tone: 'danger', word: 'Compromised' },
  Unverified: { icon: ShieldQuestionMark, tone: 'attention', word: 'Unverified' },
  Unrunnable: { icon: CircleSlash, tone: 'neutral', word: 'Unrunnable' },
  'Not run': { icon: CircleDashed, tone: 'neutral', word: 'Not run' },
  'Awaiting judge': { icon: CircleDashed, tone: 'neutral', word: 'Awaiting judge' },
  'Awaiting a run': { icon: CircleDashed, tone: 'neutral', word: 'Awaiting a run' },
}
export const verdictTone = v => VERDICT[v]?.tone ?? 'neutral'

/** The deck's attack word for an adversarial result (spec C8). */
export function attackWord(d) {
  if (d.compromised) return 'Compromised'
  if (d.status === 'Pass') return 'Defended'
  if (d.status === 'Unable to Verify') return 'Unverified'
  return null
}
/** What a result row shows when there is no verdict. */
export function verdictOf(d) {
  if (!d) return 'Not run'
  if (d.status) return d.status
  if (d.unrunnable) return 'Unrunnable'
  if (d.unjudged) return 'Awaiting judge'
  return 'Not run'
}

export function VerdictLabel({ verdict, size = 'medium', bare = false, className }) {
  const v = VERDICT[verdict] ?? VERDICT['Not run']
  const Icon = v.icon
  return (
    <span className={cx('verdict', `verdict--${v.tone}`, `verdict--${size}`, bare && 'verdict--bare', className)}>
      <Icon size={size === 'small' ? 14 : 16} aria-hidden="true" className="verdict__icon" />
      <span className="verdict__word">{v.word}</span>
    </span>
  )
}

/** A result's label, with the deck word beside an attack's verdict. */
export function ResultLabel({ d, size }) {
  const v = verdictOf(d)
  const word = d?.scenarioDef?.class === 'adversarial' && d.status ? attackWord(d) : null
  return (
    <span className="result-label">
      <VerdictLabel verdict={v} size={size} />
      {word && <VerdictLabel verdict={word} size={size} bare />}
    </span>
  )
}

/* ---------- results bar ----------
   LTProgressBar segments, failures first (web UI doc, Agents rows). With
   `hover` it is the Agents row's bar: counts on hover and focus, and the
   counts are its accessible name (spec C23). */
const SEG = [
  ['failed', 'failed', 'var(--danger-emphasis)'],
  ['unverifiable', 'Unable to Verify', 'var(--attention-emphasis)'],
  ['passed', 'passed', 'var(--success-emphasis)'],
  ['unrunnable', 'unrunnable', 'var(--neutral-emphasis)'],
  ['not_run', 'did not run', 'var(--border-default)'],
  ['skipped', 'skipped', 'var(--border-muted)'],
]
export function countsText(c) {
  return SEG.filter(([k]) => c[k]).map(([k, w]) => `${c[k]} ${w}`).join(' · ')
}
export function ResultsBar({ counts, size = 'small', hover = false, className }) {
  const total = SEG.reduce((n, [k]) => n + (counts[k] ?? 0), 0)
  const segments = SEG.filter(([k]) => counts[k]).map(([k, , color]) => ({ id: k, progress: (counts[k] / total) * 100, style: { backgroundColor: color } }))
  const text = countsText(counts)
  if (!hover) return <LTProgressBar segments={segments} size={size} className={className} />
  return (
    <LTTooltip text={text} direction="top">
      <span className={cx('results-bar', className)} tabIndex={0} role="img" aria-label={`Last run: ${text}`}>
        <LTProgressBar segments={segments} size={size} />
      </span>
    </LTTooltip>
  )
}

/* ---------- proof ledger tile (spec §4.14) ---------- */
export function LedgerTile({ heading, sentence, segments, breakdown, to, linkLabel, state }) {
  return (
    <div className="ledger-tile">
      <p className="ledger-tile__heading">{heading}</p>
      {state === 'loading' ? (
        <><LTSkeletonBox width="80%" height={20} /><LTSkeletonBox className="sk-gap" width="100%" height={8} /></>
      ) : state === 'absent' ? (
        <p className="ledger-tile__absent">–<span className="vh"> Not available</span></p>
      ) : (
        <>
          <p className="ledger-tile__sentence">{sentence}</p>
          {segments && <LTProgressBar segments={segments} size="default" className="ledger-tile__bar" />}
          <p className="ledger-tile__breakdown">{breakdown}</p>
        </>
      )}
      {to && <LTLink href={to} className="ledger-tile__link">{linkLabel}</LTLink>}
    </div>
  )
}

/* ---------- pinned context line (spec §4.15) ---------- */
export function PinnedLine({ run, totals, className, prefix = 'Based on' }) {
  if (!run) return null
  return (
    <p className={cx('pinned', className)}>
      <span>{prefix} <LTLink href={href.run(run.id)}>{run.name}</LTLink></span>
      <span className="meta-dot" aria-hidden="true">·</span>
      <span>{absDate(run.created)}</span>
      <span className="meta-dot" aria-hidden="true">·</span>
      <span>{run.version}</span>
      <span className="meta-dot" aria-hidden="true">·</span>
      <span>profile <LTLink href={href.run(run.id, { drawer: 'profile' })}>{run.profile}</LTLink></span>
      <span className="meta-dot" aria-hidden="true">·</span>
      <span>{totals.executed} of {totals.planned} scenarios executed</span>
    </p>
  )
}

/* ---------- tool access badge ----------
   Read, write or unknown; unknown is not read-only (web UI doc). */
export function AccessBadge({ tool }) {
  const t = TOOLS[tool]
  const access = t?.access ?? 'unknown'
  return <LTTag text={access} variant={access === 'write' ? 'danger' : access === 'read' ? 'secondary' : 'attention'} className="access-badge" />
}
export function ToolName({ tool, server = true }) {
  const t = TOOLS[tool]
  return (
    <span className="tool-name">
      <code className="mono-inline">{server && t ? `${t.server}.` : ''}{tool}</code>
      <AccessBadge tool={tool} />
    </span>
  )
}

/* ---------- a person, initials only (mock-data.md) ---------- */
export function Person({ id, size = 20, nameOnly = false }) {
  const p = PEOPLE[id]
  if (!p) return <span className="person person--none">Unassigned</span>
  return (
    <span className="person">
      {!nameOnly && <LTAvatar initials={p.initials} name={p.name} size={size} />}
      <span className="person__name">{p.name}</span>
    </span>
  )
}

/* ---------- panel states: loading, error, empty (guidelines §1) ---------- */
export function PanelState({ state, object, rows = 3, onRetry, empty }) {
  if (state === 'loading') {
    return (
      <div className="panel-loading" aria-busy="true">
        <span className="vh">Loading {object}</span>
        {Array.from({ length: rows }, (_, i) => <LTSkeletonBox key={i} className="sk-row" width={`${92 - i * 9}%`} height={16} delay={i * 80} />)}
      </div>
    )
  }
  if (state === 'error') {
    return <LTFlash variant="danger" text={`${object[0].toUpperCase()}${object.slice(1)} failed to load. Try again.`}
      action={<LTButton variant="outline" size="small" label="Try Again" onClick={onRetry} />} />
  }
  if (state === 'empty') return <LTBlankSlate {...empty} />
  return null
}

// Platform shell (patterns/platform-sidebar.md, patterns/topbar.md) behind
// the Shell flag (spec §3.2), and the dashed prototype bar (spec §11), which
// is not part of the design. Nav icons are lucide names verified in 1.58.0
// and chosen by intent: platform-sidebar.md names no icons, so they are
// placeholders, as in the earlier prototypes.
import React, { useCallback, useRef, useState } from 'react'
import {
  House, Bot, SquareTerminal, ClipboardList, TestTubes, Monitor, Smartphone, Workflow, ScanEye, Zap, ChartColumn,
  Accessibility, Globe, Ellipsis, Settings, CircleQuestionMark, KeyRound, ChevronRight, Bell, Scale, RotateCcw,
} from 'lucide-react'
import { LTTooltip, LTIconButton, LTButton, LTAvatar, LTBreadcrumbs, cx } from './lt.jsx'
import { LTSegmentedControl, LTSelect, useToast } from './overlays.jsx'
import { useStore } from './store.jsx'
import { PEOPLE, VIEWERS } from './data.js'

const PRIMARY_NAV = [
  ['home', 'Home', House], ['kaneai', 'KaneAI', Bot, true], ['kane-cli', 'Kane CLI', SquareTerminal],
  ['test-manager', 'Test Manager', ClipboardList, true], ['agent-testing', 'Agent Testing', TestTubes],
  ['real-time', 'Real Time', Monitor, true], ['real-device', 'Real Device', Smartphone, true],
  ['automation', 'Automation', Workflow, true], ['smartui', 'SmartUI', ScanEye],
  ['hyperexecute', 'HyperExecute', Zap, true], ['insights', 'Insights', ChartColumn, true],
  ['accessibility', 'Accessibility', Accessibility, true], ['web-scanner', 'Web Scanner', Globe, true],
  ['more-tools', 'More Tools', Ellipsis, true], ['settings', 'Settings', Settings, true],
]
const SECONDARY_NAV = [['help', 'Help', CircleQuestionMark, true], ['credentials', 'Credentials', KeyRound, true], ['quick-actions', 'Quick Actions', Zap, true]]

function NavItem({ item: [, label, Icon, sub] }) {
  return (
    <li>
      <a className="navitem" href="#nav" onClick={e => e.preventDefault()}>
        <Icon size={16} aria-hidden="true" className="navitem-icon" />
        <span className="navitem-label">{label}</span>
        {sub && <ChevronRight size={16} aria-hidden="true" className="navitem-caret" />}
      </a>
    </li>
  )
}

/**
 * The 56px rail expands on hover, or from the brand mark by keyboard, into a
 * 320px panel that overlays the page (platform-sidebar.md §1). The panel's 15
 * destinations hold no Rook entry, so none is active (gap G7). Collapsed, the
 * rail shows one Agent Assurance icon, Scale, a placeholder [TO FILL].
 */
export function PlatformSidebar() {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrap = useRef(null)
  const brand = useRef(null)
  const open = hover || pinned
  const close = useCallback(() => { setPinned(false); setHover(false) }, [])
  return (
    <>
      <div className="rail-slot" />
      <div ref={wrap} className={cx('rail', open && 'open')}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onKeyDown={e => { if (e.key === 'Escape' && open) { close(); brand.current?.focus() } }}
        onBlurCapture={e => { if (!wrap.current?.contains(e.relatedTarget)) setPinned(false) }}>
        <div className="rail-corner">
          <button ref={brand} type="button" className="rail-brand" aria-expanded={open}
            aria-label="TestMu AI, open platform navigation"
            onFocus={() => setPinned(true)} onClick={() => setPinned(v => !v)}>
            <span className="rail-mark" aria-hidden="true">T</span>
          </button>
        </div>
        {open ? (
          <>
            <div className="rail-word"><strong>TestMu AI</strong><em>Formerly LambdaTest</em></div>
            <nav className="rail-nav" aria-label="Products">
              <ul>{PRIMARY_NAV.map(i => <NavItem key={i[0]} item={i} />)}</ul>
            </nav>
            <hr className="rail-div" />
            <nav className="rail-secondary" aria-label="Support">
              <ul>{SECONDARY_NAV.map(i => <NavItem key={i[0]} item={i} />)}</ul>
            </nav>
            <button type="button" className="lt-btn lt-btn--orange lt-btn--large rail-upgrade">Upgrade Now</button>
          </>
        ) : (
          <div className="rail-icons">
            <LTTooltip text="Agent Assurance" direction="right">
              <a className="rail-icon active" href="#/p/web-app/agents" aria-label="Agent Assurance" aria-current="page">
                <Scale size={16} aria-hidden="true" />
              </a>
            </LTTooltip>
          </div>
        )}
      </div>
    </>
  )
}

const STATES = [
  { value: 'blocked', label: 'Blocked' },
  { value: 'meets', label: 'Meets policy' },
  { value: 'no-policy', label: 'Awaiting a policy' },
  { value: 'incomplete', label: 'Incomplete run' },
  { value: 'shared', label: 'Awaiting a shared run' },
  { value: 'empty', label: 'Empty organization' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
]

/** The dashed prototype bar: not part of the design (spec §11). */
function PrototypeBar() {
  const st = useStore()
  return (
    <div className="proto-bar" role="group" aria-label="Prototype controls, outside the design">
      <span className="proto-bar__label">Prototype</span>
      <LTSelect leadingText="State" options={STATES} value={st.proto} onChange={v => st.set({ proto: v })}
        inputAriaLabel="Prototype state" anchorButtonSize="small" width={220} />
      <LTSegmentedControl ariaLabel="Shell" variant="small" selectedValue={st.shell}
        options={[{ value: 'platform', label: 'Platform' }, { value: 'standalone', label: 'Standalone' }]}
        onChange={v => st.set({ shell: v })} />
      <LTSelect leadingText="Viewer" anchorButtonSize="small" width={300} value={st.viewer} inputAriaLabel="Viewer"
        options={VIEWERS.map(id => ({ value: id, label: PEOPLE[id].role, description: PEOPLE[id].name }))}
        customButtonText={PEOPLE[st.viewer].role}
        onChange={v => st.set({ viewer: v })} />
      <LTIconButton icon={RotateCcw} ariaLabel="Reset the prototype" variant="invisible" size="small" onClick={st.reset} />
    </div>
  )
}

/**
 * Top bar. Left: the breadcrumb, every crumb a link, the current one bold
 * with aria-current (spec C15). Right: the bell, the avatar and Upgrade Now,
 * constant across products (topbar.md §2); no quota module, since topbar.md
 * names none for Rook (gap G6).
 */
export function TopBar({ crumbs }) {
  const st = useStore()
  const toast = useToast()
  const me = PEOPLE[st.viewer]
  return (
    <header className="topbar">
      <LTBreadcrumbs items={crumbs} className="topbar-crumbs" />
      <PrototypeBar />
      <div className="topbar-right">
        <LTIconButton icon={Bell} ariaLabel="Notifications" variant="outline"
          onClick={() => toast('Notifications open here. Which Rook events notify is an open question.')} />
        <LTAvatar initials={me.initials} name={me.name} size={32} />
        <LTButton variant="orange" size="medium" label="Upgrade Now" onClick={() => toast('Plans and pricing open here.')} />
      </div>
    </header>
  )
}

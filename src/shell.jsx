// Platform shell (patterns/platform-sidebar.md, patterns/topbar.md) behind
// the Shell flag (spec §3.2). The dashed prototype bar was removed from the
// top bar on 16 Nov 2026 (Rajat; spec §11). Nav icons are lucide names verified in 1.58.0
// and chosen by intent: platform-sidebar.md names no icons, so they are
// placeholders, as in the earlier prototypes.
import React, { useCallback, useRef, useState } from 'react'
import {
  House, Bot, SquareTerminal, ClipboardList, TestTubes, Monitor, Smartphone, Workflow, ScanEye, Zap, ChartColumn,
  Accessibility, Globe, Ellipsis, Settings, CircleQuestionMark, KeyRound, ChevronRight, Bell, Scale,
} from 'lucide-react'
import { LTTooltip, LTIconButton, LTButton, LTAvatar, LTBreadcrumbs, cx } from './lt.jsx'
import { useToast } from './overlays.jsx'
import { useStore } from './store.jsx'
import { PEOPLE } from './data.js'

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
      <div className="topbar-right">
        <LTIconButton icon={Bell} ariaLabel="Notifications" variant="outline"
          onClick={() => toast('Notifications open here. Which Rook events notify is an open question.')} />
        <LTAvatar initials={me.initials} name={me.name} size={32} />
        <LTButton variant="orange" size="medium" label="Upgrade Now" onClick={() => toast('Plans and pricing open here.')} />
      </div>
    </header>
  )
}

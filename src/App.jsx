// The app: shell, routes (spec §3.3) and the agent frame, the header and
// six tabs shared by the agent's pages.
import React, { useEffect, useMemo } from 'react'
import { Announcer, LTCounterLabel, LTBlankSlate, LTLink } from './lt.jsx'
import { ToastProvider, LTUnderlineNav } from './overlays.jsx'
import { StoreProvider, useStore } from './store.jsx'
import { HandoffProvider } from './handoff.jsx'
import { PlatformSidebar, TopBar } from './shell.jsx'
import { useRoute, href } from './router.js'
import { RUN, SCENARIO, OTHER_AGENTS } from './data.js'
import { runsFor, triageItems } from './model.js'
import { ProjectsPage } from './pages/projects.jsx'
import { AgentsPage } from './pages/agents.jsx'
import { OverviewPage } from './pages/overview.jsx'
import { RunsPage, RunPage } from './pages/runs.jsx'
import { ResultPage } from './pages/result.jsx'
import { TriagePage } from './pages/triage.jsx'
import { ComparePage } from './pages/compare.jsx'
import { CoveragePage } from './pages/coverage.jsx'
import { SecurityPage } from './pages/security.jsx'
import { SetupPage } from './pages/setup.jsx'
import { PolicyPage } from './pages/policy.jsx'

const TAB_LABEL = { overview: 'Overview', runs: 'Runs', triage: 'Triage', coverage: 'Coverage', security: 'Security', setup: 'Setup', compare: 'Run Comparison' }
export const AGENT_NAME = { 'refund-desk': 'Refund Desk', ...Object.fromEntries(OTHER_AGENTS.map(a => [a.id, a.name])) }

/** Untriaged failed and Unable to Verify criteria on the current version. */
export function useUntriaged() {
  const st = useStore()
  return useMemo(() => {
    const v12 = runsFor(st.proto).filter(r => r.version === 'v12')
    return triageItems(v12, st.triage).filter(i => !i.disposition?.disposition).length
  }, [st.proto, st.triage])
}

/** Header and tabs shared by the agent's pages (spec §3.3). */
export function AgentFrame({ route, actions, children, current }) {
  const untriaged = useUntriaged()
  const tab = current ?? route.page
  const navs = ['overview', 'runs', 'triage', 'coverage', 'security', 'setup'].map(id => ({
    id, label: TAB_LABEL[id], href: href.tab(id), counter: id === 'triage' && untriaged ? untriaged : null,
  }))
  return (
    <div className="page-col">
      <header className="agent-head">
        <div className="agent-head__title">
          <h1 className="h-title">Refund Desk</h1>
          <span className="mono-muted">refund-desk</span>
        </div>
        {actions && <div className="agent-head__actions">{actions}</div>}
      </header>
      <LTUnderlineNav ariaLabel="Agent" navs={navs} current={tab === 'compare' || tab === 'run' ? 'runs' : tab} />
      <div className="agent-body">{children}</div>
    </div>
  )
}

function crumbsFor(route) {
  const c = [{ label: 'Projects', href: href.projects() }]
  if (route.page === 'projects') { c[0].current = true; return c }
  c.push({ label: 'Web app', href: href.agents() })
  if (route.page === 'agents') { c.push({ label: 'Agents', href: href.agents(), current: true }); return c }
  if (route.page === 'policy') { c.push({ label: 'Release Policy', href: href.policy(), current: true }); return c }
  const agent = route.agent ?? 'refund-desk'
  c.push({ label: AGENT_NAME[agent] ?? agent, href: href.tab('overview', {}, agent) })
  if (route.page === 'run' || route.page === 'result') {
    c.push({ label: 'Runs', href: href.tab('runs') })
    const run = RUN[route.run]
    c.push({ label: run?.name ?? route.run, href: href.run(route.run), current: route.page === 'run' })
    if (route.page === 'result') c.push({ label: SCENARIO[route.scenario]?.title ?? route.scenario, href: href.result(route.run, route.scenario), current: true })
    return c
  }
  c.push({ label: TAB_LABEL[route.page] ?? 'Page', href: href.tab(route.page), current: true })
  return c
}

function OtherAgent({ route }) {
  return (
    <div className="page-col">
      <header className="agent-head"><div className="agent-head__title"><h1 className="h-title">{AGENT_NAME[route.agent]}</h1><span className="mono-muted">{route.agent}</span></div></header>
      <LTBlankSlate heading="The prototype's journeys run on Refund Desk"
        description="Its row on Agents is Rook sample data. Its pages are outside this prototype."
        primaryAction={<LTLink href={href.tab('overview')}>Open Refund Desk</LTLink>} />
    </div>
  )
}

function Routes() {
  const route = useRoute()
  const st = useStore()
  useEffect(() => {
    const t = { projects: 'Projects', agents: 'Agents', policy: 'Release Policy', run: 'Run', result: 'Scenario Result' }[route.page] ?? TAB_LABEL[route.page] ?? 'Rook'
    document.title = `${t} · Rook decision surface · Prototype`
    window.scrollTo(0, 0)
  }, [route.page, route.run, route.scenario])
  const otherAgent = route.agent && route.agent !== 'refund-desk'
  let page
  if (route.page === 'projects') page = <ProjectsPage />
  else if (route.page === 'agents') page = <AgentsPage />
  else if (route.page === 'policy') page = <PolicyPage />
  else if (st.proto === 'empty') page = <ProjectsPage />
  else if (otherAgent) page = <OtherAgent route={route} />
  else if (route.page === 'overview') page = <OverviewPage route={route} />
  else if (route.page === 'runs') page = <RunsPage route={route} />
  else if (route.page === 'run') page = <RunPage route={route} />
  else if (route.page === 'result') page = <ResultPage route={route} />
  else if (route.page === 'triage') page = <TriagePage route={route} />
  else if (route.page === 'compare') page = <ComparePage route={route} />
  else if (route.page === 'coverage') page = <CoveragePage route={route} />
  else if (route.page === 'security') page = <SecurityPage route={route} />
  else if (route.page === 'setup') page = <SetupPage route={route} />
  else page = <div className="page-col"><LTBlankSlate heading="This page is outside the prototype" primaryAction={<LTLink href={href.tab('overview')}>Open Overview</LTLink>} /></div>
  return (
    <div className={`app app--${st.shell}`}>
      {st.shell === 'platform' && <PlatformSidebar />}
      <div className="main">
        <TopBar crumbs={st.proto === 'empty' && !['projects', 'agents'].includes(route.page) ? crumbsFor({ page: 'projects' }) : crumbsFor(route)} />
        <main className="content" id="main">{page}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HandoffProvider>
          <Announcer />
          <Routes />
        </HandoffProvider>
      </ToastProvider>
    </StoreProvider>
  )
}

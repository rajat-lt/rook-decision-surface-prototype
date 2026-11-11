// Projects (exists, CHANGELOG 0.1.18; patterns/project-listing.md frame).
// The empty organization shows the product's Get started view, as the web UI
// doc describes it: install command, documentation link, Schedule Demo and
// Upgrade Now.
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LTButton, LTLink, LTInputBox, LTCounterLabel, LTAvatar, LTBlankSlate, LTCodeBlock, LTCopyToClipboard } from '../lt.jsx'
import { LTActionMenu, useToast } from '../overlays.jsx'
import { useStore } from '../store.jsx'
import { PROJECT, PEOPLE, OTHER_AGENTS } from '../data.js'
import { PanelState } from '../verdict.jsx'
import { href } from '../router.js'

export function ProjectsPage() {
  const st = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState('')
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  if (st.proto === 'empty') return <GetStarted onStub={toast} />
  const rows = [PROJECT].filter(p => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!owner || p.creator === owner))
  const creator = PEOPLE[PROJECT.creator]
  return (
    <div className="page-col">
      <div className="page-head">
        <h1 className="h-title">Projects</h1>
        <LTCounterLabel count={rows.length} />
      </div>
      <div className="filters">
        <LTInputBox value={q} onChange={setQ} placeholder="Search projects" ariaLabel="Search projects" extraStyle={{ flex: 1 }} />
        <LTActionMenu customAnchor={<LTButton variant="outline" size="medium" label="Owners" counter={owner ? 1 : undefined} trailingIcon={ChevronDown} />}
          ariaLabel="Owners" selectionVariant="single" activeId={owner} width={300}
          options={[{ value: '', label: 'Every owner' }, ...Object.values(PEOPLE).map(p => ({ value: p.id, label: p.name }))]}
          onSelect={o => setOwner(o.value)} />
      </div>
      {panel ? <PanelState state={panel} object="the project list" rows={3} lead /> : !rows.length ? (
        <LTBlankSlate heading="0 matching projects" description="Change or clear the search and filters to see more projects." />
      ) : (
        <ul className="rows">
          {rows.map(p => (
            <li key={p.id} className="row">
              <div className="row__main">
                <LTLink href={href.agents(p.id)} className="row__title">{p.name}</LTLink>
                <p className="row__meta"><span>{OTHER_AGENTS.length + 1} agents</span><span className="meta-dot" aria-hidden="true">·</span><span>{p.runs} runs</span></p>
              </div>
              <LTAvatar initials={creator.initials} name={`Created by ${creator.name}`} size={24} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GetStarted({ onStub }) {
  // Rook's README, Install (npm). Homebrew and the shell installer are listed there too.
  const cmd = 'npm install -g @testmuai/rook@latest'
  return (
    <div className="page-col">
      <div className="getstarted">
        <p className="caption">Agent Assurance · Rook</p>
        <h1 className="h-title">Get Started</h1>
        <p className="body">Rook tests agents that act. It runs scenarios against a staging agent from your terminal, and the results land here for your team.</p>
        <LTCodeBlock title="Install" headerActions={<LTCopyToClipboard textToCopy={cmd} copyAriaLabel="Copy install command" copiedAriaLabel="Install command copied" dark size="small" />}>
          <pre className="code-pre">{cmd}</pre>
        </LTCodeBlock>
        <div className="getstarted__actions">
          <LTLink href="https://www.testmuai.com/support/docs/rook-installation/" target="_blank" rel="noopener">Read the Installation Guide</LTLink>
          <LTButton variant="outline" size="medium" label="Schedule Demo" onClick={() => onStub('Demo scheduling opens here.')} />
          <LTButton variant="orange" size="medium" label="Upgrade Now" onClick={() => onStub('Plans and pricing open here.')} />
          <LTLink href="https://github.com/LambdaTest/rook" target="_blank" rel="noopener">Open Rook on GitHub</LTLink>
        </div>
      </div>
    </div>
  )
}

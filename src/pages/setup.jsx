// Setup (brief §7.9, spec §4.9): what can this setup observe, and how is it
// configured? Profiles with their hook phases (the timeline exists), an
// evidence capability view [proposed], tools, versions with the call graph,
// and the context, spec and findings that live in Summary today.
import React, { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cx, LTButton, LTTag, LTLink, LTInlineMessage } from '../lt.jsx'
import { LTDrawer } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore } from '../store.jsx'
import { useHandoff, HANDOFF } from '../handoff.jsx'
import { PROFILES, TOOLS, VERSIONS } from '../data.js'
import { gatingRun, details } from '../model.js'
import { ToolName, PanelState } from '../verdict.jsx'
import { CodeFile } from './result.jsx'
import { profileYaml } from '../files.js'
import { SAMPLE_FILES } from '../sample-files.js'
import { href } from '../router.js'
import { absDate, plural } from '../format.js'

const PHASES = ['prepare', 'open', 'execute', 'close', 'collect']

export function SetupPage({ route }) {
  const st = useStore()
  const handoff = useHandoff()
  const [drawer, setDrawer] = useState(null)
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null
  const run = gatingRun('v12', st.proto)
  const ds = run ? details(run) : []
  const blockedBy = {
    calls: ds.flatMap(d => (d.trace?.calls?.some(c => c.noArgs) ? d.criteria.filter(c => c.status === 'Unable to Verify') : [])).length,
    usage: ds.flatMap(d => (d.scenarioDef.category === 'token_economy' ? d.criteria.filter(c => c.status === 'Unable to Verify') : [])).length,
    multi: ds.filter(d => d.unrunnable).reduce((n, d) => n + d.criteria.length, 0),
  }
  const prof = PROFILES.staging
  const caps = [
    { id: 'calls', label: 'Tool calls', provided: prof.capabilities.calls ? 'Provided, with arguments missing on some calls' : 'Missing', ok: prof.capabilities.calls, blocked: blockedBy.calls,
      add: () => HANDOFF.profileFix("returns the agent's tool calls as calls[] with their arguments", 'Return tool call arguments') },
    { id: 'usage', label: 'Token usage', provided: prof.capabilities.usage ? 'Provided' : 'Missing', ok: prof.capabilities.usage, blocked: blockedBy.usage,
      add: () => HANDOFF.profileFix("reports the target's token usage, when the target provides it", 'Report token usage') },
    { id: 'multi', label: 'Multi-turn', provided: prof.capabilities.multi_turn ? 'Provided' : 'Missing a conversation handle', ok: prof.capabilities.multi_turn, blocked: blockedBy.multi,
      add: () => HANDOFF.profileFix('returns a conversation handle, so multi-turn scenarios can run', 'Return a conversation handle') },
    { id: 'collect', label: 'Delayed evidence (collect)', provided: prof.hooks.collect ? 'Provided' : 'Missing', ok: !!prof.hooks.collect, blocked: 0 },
    { id: 'mcp', label: 'MCP verifiers', provided: 'billing and crm, approved [mock]', ok: true, blocked: 0, add: () => HANDOFF.mcp('billing') },
  ]
  return (
    <AgentFrame route={route}>
      <section className="panel" aria-labelledby="prof-h">
        <div className="panel__head"><h2 id="prof-h" className="sec-h">Profiles</h2><span className="caption">How Rook reaches the agent. Authored and tested in the terminal.</span></div>
        {panel ? <PanelState state={panel} object="the profiles" rows={4} lead /> : (
          <div className="profiles">
            {Object.values(PROFILES).map(p => {
              const n = PHASES.filter(ph => p.hooks[ph]).length
              return (
                <div key={p.id} className="profile">
                  <div className="profile__head">
                    <span className="mono-strong">{p.name}</span>
                    {p.current && <LTTag text="current" variant="blueAccent" />}
                    <span className="caption">{n} of 5 phases · concurrency {p.concurrency} · command <code className="mono-inline">{p.command}</code></span>
                    <LTButton variant="invisible" size="small" label="View profile.yaml" onClick={() => setDrawer({ kind: 'profile', id: p.id })} />
                  </div>
                  <ol className="phases" aria-label={`${p.name} hook phases`}>
                    {PHASES.map((ph, i) => (
                      <li key={ph} className={cx('phase', !p.hooks[ph] && 'is-undefined')}>
                        <span className="phase__name">{ph}</span>
                        <span className="phase__state">{p.hooks[ph] ? <code className="mono-inline">{p.hooks[ph]}</code> : 'Not defined'}</span>
                        {i < PHASES.length - 1 && <ArrowRight size={12} aria-hidden="true" className="phase__arrow" />}
                      </li>
                    ))}
                    <li className="phase phase--rook"><span className="phase__name">judge</span><span className="phase__state">Rook</span></li>
                  </ol>
                  <p className="caption">Capabilities observed: calls {String(p.capabilities.calls)} · usage {String(p.capabilities.usage)} · multi_turn {String(p.capabilities.multi_turn)} · environment {p.env.map(e => <code key={e} className="mono-inline">{e}</code>)}</p>
                </div>
              )
            })}
          </div>
        )}
        <p className="caption">Not defined is the product's wording for an optional hook the profile leaves out. Hook script paths show as text: their files are outside this prototype.</p>
      </section>

      <section className="panel" aria-labelledby="cap-h">
        <div className="panel__head"><h2 id="cap-h" className="sec-h">Evidence capability</h2><span className="tag-proposed">[proposed] · staging, the current profile</span></div>
        {panel ? <PanelState state={panel} object="the evidence capability" rows={5} /> : (
          <table className="lt-table caps">
            <caption className="vh">What the staging profile observes</caption>
            <thead><tr><th scope="col">Evidence</th><th scope="col">Provided</th><th scope="col">Criteria blocked</th><th scope="col">How to add it</th></tr></thead>
            <tbody>
              {caps.map(c => (
                <tr key={c.id}>
                  <th scope="row">{c.label}</th>
                  <td className={cx(!c.ok && 'cap-missing')}>{c.provided}</td>
                  <td>{c.blocked ? <LTLink href={href.tab('coverage', { focus: 'gaps' })}>{plural(c.blocked, 'criterion', 'criteria')}</LTLink> : <span className="muted">0</span>}</td>
                  <td>{c.add && (c.blocked > 0 || c.id === 'mcp') ? <LTButton variant="outline" size="small" label="Next Step" onClick={() => handoff(c.add())} /> : <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" aria-labelledby="tools-h">
        <div className="panel__head"><h2 id="tools-h" className="sec-h">Tools</h2><span className="caption">{Object.keys(TOOLS).length} tools · {Object.values(TOOLS).filter(t => t.access === 'read').length} read · {Object.values(TOOLS).filter(t => t.access === 'write').length} write. Treat unknown access as able to write.</span></div>
        <ul className="tools">
          {Object.values(TOOLS).map(t => (
            <li key={t.name} className="tools__row"><ToolName tool={t.name} /><span className="body">{t.does}</span></li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="ver-h">
        <div className="panel__head"><h2 id="ver-h" className="sec-h">Versions</h2></div>
        <ul className="versions">
          {VERSIONS.map(v => (
            <li key={v.id} className="versions__row">
              <span className="mono-strong">{v.id}</span>
              {v.current && <LTTag text="current" variant="blueAccent" />}
              <span className="caption">{v.features} features · {v.scenarios} scenarios · synced {absDate(v.synced)}</span>
              <span className="versions__actions">
                <LTButton variant="invisible" size="small" label="View Full Spec" onClick={() => setDrawer({ kind: 'spec', v: v.id })} />
                <LTButton variant="invisible" size="small" label="View Call Graph" onClick={() => setDrawer({ kind: 'graph', v: v.id })} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="ctx-h">
        <div className="panel__head">
          <h2 id="ctx-h" className="sec-h">Context</h2>
          <LTButton variant="invisible" size="small" label="View Findings" onClick={() => setDrawer({ kind: 'findings' })} />
        </div>
        <p className="caption">Source materials explore read for v12. A checkpoint digest identifies these files. Check the deployed agent separately.</p>
        <ul className="ctx">
          {Object.keys(SAMPLE_FILES).concat(['mcp/billing-server.mjs', 'mcp/crm-server.mjs']).map(f => (
            <li key={f}>{SAMPLE_FILES[f] ? <LTButton variant="invisible" size="small" label={f} onClick={() => setDrawer({ kind: 'file', f })} /> : <code className="mono-inline">{f}</code>}</li>
          ))}
        </ul>
      </section>

      <LTDrawer isOpen={!!drawer} onClose={() => setDrawer(null)} width={640}
        title={drawer?.kind === 'profile' ? `${drawer.id} · profile.yaml` : drawer?.kind === 'spec' ? `Full spec · ${drawer.v}` : drawer?.kind === 'graph' ? `Call graph · ${drawer.v}` : drawer?.kind === 'findings' ? 'Findings' : drawer?.f}
        subTitle={drawer?.kind === 'graph' ? 'What the agent can call, from its definition. Scenario results show what it did call.' : drawer?.kind === 'spec' ? 'The agent definition saved for this version' : undefined}>
        {drawer?.kind === 'profile' && <CodeFile name="profile.yaml" text={profileYaml(drawer.id)} />}
        {drawer?.kind === 'spec' && <CodeFile name=".claude/agents/refund-desk.md" text={SAMPLE_FILES['.claude/agents/refund-desk.md']} />}
        {drawer?.kind === 'file' && <CodeFile name={drawer.f} text={SAMPLE_FILES[drawer.f]} />}
        {drawer?.kind === 'graph' && <CallGraph />}
        {drawer?.kind === 'findings' && (
          <div className="state-card">
            <p className="baseline__h">No findings recorded</p>
            <p className="body muted">The product's own wording. Read an empty findings record as a gap to check.</p>
          </div>
        )}
      </LTDrawer>
    </AgentFrame>
  )
}

/* The declared relationships discovery records (web UI doc): an edge means
   the agent can call it, not that a scenario did. */
function CallGraph() {
  const node = (label, kind, children) => (
    <li className="graph__node">
      <span className="graph__label"><span className="mono-strong">{label}</span> <span className="caption">{kind}</span></span>
      {children && <ul className="graph">{children}</ul>}
    </li>
  )
  return (
    <ul className="graph graph--root">
      {node('refund-desk', 'agent', <>
        {node('order-lookup', 'subagent · read-only')}
        {node('refund-policy', 'skill')}
        {node('billing', 'MCP server', Object.values(TOOLS).filter(t => t.server === 'billing').map(t => <li key={t.name} className="graph__node"><ToolName tool={t.name} server={false} /></li>))}
        {node('crm', 'MCP server', Object.values(TOOLS).filter(t => t.server === 'crm').map(t => <li key={t.name} className="graph__node"><ToolName tool={t.name} server={false} /></li>))}
        {node('Read · Grep · Bash', 'built-in tools')}
      </>)}
    </ul>
  )
}

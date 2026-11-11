// Triage (brief §7.5, spec §4.5) [proposed]: what is still unexplained, and
// who owns it? Failed, Unable to Verify and compromised criteria across runs,
// grouped by cluster, tool or feature. A disposition never changes a verdict.
import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cx, LTButton, LTCheckbox, LTLink, LTBlankSlate, LTCounterLabel } from '../lt.jsx'
import { LTSegmentedControl, LTActionMenu, useToast } from '../overlays.jsx'
import { AgentFrame } from '../App.jsx'
import { useStore, nowMs } from '../store.jsx'
import { PEOPLE, DISPOSITIONS, FEATURE, NOW } from '../data.js'
import { runsFor } from '../model.js'
import { triageItems } from '../model.js'
import { VerdictLabel, ToolName, PanelState, Person } from '../verdict.jsx'
import { href } from '../router.js'
import { relTime, plural } from '../format.js'

const SCOPES = [{ value: 'version', label: 'This version' }, { value: 'week', label: 'Last 7 days' }]
const GROUPS = [{ value: 'cluster', label: 'Cluster' }, { value: 'tool', label: 'Tool' }, { value: 'feature', label: 'Feature' }]

export function TriagePage({ route }) {
  const st = useStore()
  const toast = useToast()
  const [scope, setScope] = useState('version')
  const [group, setGroup] = useState('cluster')
  const [verdict, setVerdict] = useState('all')
  const [sel, setSel] = useState(() => new Set())
  const [open, setOpen] = useState(() => new Set())
  const runs = runsFor(st.proto).filter(r => (scope === 'version' ? r.version === 'v12' : NOW - Date.parse(r.created) <= 7 * 86400e3))
  const all = useMemo(() => triageItems(runs, st.triage), [runs, st.triage])
  const items = all.filter(i => verdict === 'all' || i.criterion.status === verdict)
  const untriaged = all.filter(i => !i.disposition?.disposition)
  const panel = st.proto === 'loading' ? 'loading' : st.proto === 'error' ? 'error' : null

  const groups = useMemo(() => {
    const m = new Map()
    for (const i of items) {
      const k = group === 'cluster' ? (i.cluster ? `${i.cluster.id} · ${i.run.name} · ${i.cluster.why}` : `Outside the clusters · ${i.run.name}`)
        : group === 'tool' ? (i.criterion.tool ?? 'Criteria about the reply') : `${i.detail.scenarioDef.feature} · ${FEATURE[i.detail.scenarioDef.feature].name}`
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(i)
    }
    return [...m.entries()]
  }, [items, group])

  const allOn = items.length > 0 && items.every(i => sel.has(i.key))
  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const bulk = (patch, said) => {
    const keys = [...sel]
    keys.forEach(k => st.setTriage(k, patch))
    toast(`${plural(keys.length, 'criterion', 'criteria')} ${said}.`)
    setSel(new Set())
  }
  const anchor = label => <LTButton variant="outline" size="small" label={label} trailingIcon={ChevronDown} inactive={!sel.size} />

  return (
    <AgentFrame route={route}>
      <div className="page-head">
        <h2 className="sec-h">Triage <LTCounterLabel count={untriaged.length} /></h2>
        <span className="caption">{untriaged.length} untriaged of {plural(all.length, 'failed or unverifiable criterion', 'failed or unverifiable criteria')}</span>
      </div>
      <div className="filters">
        <div className="filters__group">
          <LTSegmentedControl ariaLabel="Scope" variant="small" selectedValue={scope} onChange={v => { setScope(v); setSel(new Set()) }} options={SCOPES} />
          <LTSegmentedControl ariaLabel="Verdict" variant="small" selectedValue={verdict} onChange={v => { setVerdict(v); setSel(new Set()) }}
            options={[{ value: 'all', label: `All (${all.length})` }, { value: 'Fail', label: `Fail (${all.filter(i => i.criterion.status === 'Fail').length})` }, { value: 'Unable to Verify', label: `Unable to Verify (${all.filter(i => i.criterion.status === 'Unable to Verify').length})` }]} />
          <span className="field-label">Group by</span>
          <LTSegmentedControl ariaLabel="Group by" variant="small" selectedValue={group} onChange={setGroup} options={GROUPS} />
        </div>
      </div>
      <p className="caption">{scope === 'version' ? 'Every run on v12' : 'Runs from the last 7 days'}: {runs.map(r => r.name).join(', ') || '0 runs'}. A disposition sits beside the verdict and leaves it as Rook judged it.</p>

      {panel ? <PanelState state={panel} object="the triage queue" rows={6} lead /> : !items.length && all.length ? (
        <p className="body muted">0 criteria with this verdict.</p>
      ) : !items.length ? (
        <LTBlankSlate heading="Every failure on v12 has an owner" description="New failures from the next run land here." />
      ) : (
        <>
          {!untriaged.length && (
            <div className="state-card"><p className="baseline__h">Every failure on v12 has an owner</p><p className="body muted">New failures from the next run land here.</p></div>
          )}
          <div className="bulk" role="toolbar" aria-label="Bulk triage">
            <LTCheckbox checked={allOn} indeterminate={!allOn && sel.size > 0} ariaLabel="Select every criterion"
              onChange={() => setSel(allOn ? new Set() : new Set(items.map(i => i.key)))} />
            <span className="caption">{sel.size ? `${sel.size} selected` : 'Select criteria to assign or set a disposition'}</span>
            <LTActionMenu customAnchor={anchor('Assign')} ariaLabel="Assign to" width={300}
              options={Object.values(PEOPLE).map(p => ({ value: p.id, label: p.name, description: p.role }))}
              onSelect={o => sel.size && bulk({ owner: o.value }, `assigned to ${PEOPLE[o.value].name}`)} />
            <LTActionMenu customAnchor={anchor('Set Disposition')} ariaLabel="Set disposition" width={240}
              options={DISPOSITIONS.map(d => ({ value: d, label: d }))}
              onSelect={o => sel.size && bulk({ disposition: o.value }, `set to ${o.value}`)} />
          </div>
          {groups.map(([k, list]) => (
            <section key={k} className="tgroup" aria-label={k}>
              <h3 className="tgroup__h">
                {group === 'tool' && list[0].criterion.tool ? <ToolName tool={list[0].criterion.tool} /> : <span>{k}</span>}
                <LTCounterLabel count={list.length} />
              </h3>
              <table className="lt-table tq">
                <caption className="vh">{k}</caption>
                <colgroup><col style={{ width: 40 }} /><col /><col style={{ width: 104 }} /><col style={{ width: 152 }} /><col style={{ width: 200 }} /><col style={{ width: 128 }} /><col style={{ width: 200 }} /><col style={{ width: 72 }} /></colgroup>
                <thead><tr>
                  <th scope="col"><span className="vh">Select</span></th><th scope="col">Criterion</th><th scope="col">Scenario</th><th scope="col">Verdict</th>
                  <th scope="col">Cause</th><th scope="col">Disposition</th><th scope="col">Owner</th><th scope="col">Age</th>
                </tr></thead>
                <tbody>
                  {list.map(i => {
                    const exp = open.has(i.key)
                    return (
                      <tr key={i.key} className={cx(sel.has(i.key) && 'is-selected')}>
                        <td><LTCheckbox checked={sel.has(i.key)} ariaLabel={`Select ${i.detail.scenario} ${i.criterion.criterion_id}`} onChange={() => toggle(i.key)} /></td>
                        <td className="tq__crit">
                          <button type="button" className="tq__toggle" aria-expanded={exp} onClick={() => setOpen(s => { const n = new Set(s); n.has(i.key) ? n.delete(i.key) : n.add(i.key); return n })}>
                            {exp ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                            <span className="mono-strong">{i.criterion.criterion_id}</span>
                            <span className={cx('tq__statement', exp && 'is-open')}>{i.criterion.criterion}</span>
                          </button>
                          {exp && <p className="caption tq__detail">Achieved: {i.criterion.achieved}</p>}
                        </td>
                        <td><LTLink href={href.result(i.run.id, i.detail.scenario, { filter: i.criterion.status === 'Fail' ? 'fail' : 'uv' })} className="mono-link">{i.detail.scenario}</LTLink><br /><span className="caption">{i.run.name}</span></td>
                        <td><VerdictLabel verdict={i.criterion.status} size="small" /></td>
                        <td className="caption">{i.cause}</td>
                        <td>{i.disposition?.disposition ? <span>{i.disposition.disposition}</span> : <span className="triage-state">Untriaged</span>}</td>
                        <td><Person id={i.disposition?.owner} size={20} /></td>
                        <td className="caption">{relTime(i.run.created, nowMs()).replace(' ago', '')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </AgentFrame>
  )
}

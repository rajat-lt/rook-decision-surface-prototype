// Record Decision (brief §7.10, spec §4.10) [proposed]: ship, hold, or ship
// with named gaps. The record sits beside the verdicts and never changes one
// (spec D8). Its CTA names the outcome (text guide §3 Buttons).
import React, { useEffect, useState } from 'react'
import { LTButton, LTRadioGroup, LTTextarea, LTTag, LTInlineMessage } from '../lt.jsx'
import { LTModal, useToast } from '../overlays.jsx'
import { useStore } from '../store.jsx'
import { KIND, triageKey } from '../model.js'

export function RecordDecision({ isOpen, onClose, version, standing }) {
  const st = useStore()
  const toast = useToast()
  const [outcome, setOutcome] = useState('Hold')
  const [notes, setNotes] = useState({})
  const [tried, setTried] = useState(false)
  const list = standing.blockers.filter(b => b.kind !== 'coverage')
  useEffect(() => {
    if (!isOpen) return
    // An Accepted risk disposition carries its note in (journeys doc J2 step 4).
    const pre = {}
    for (const b of list) {
      if (!b.criterion || !standing.run) continue
      const t = st.triage[triageKey(standing.run.id, b.detail.scenario, b.criterion.criterion_id)]
      if (t?.disposition === 'Accepted risk' && t.note) pre[b.id] = t.note
    }
    setNotes(pre); setTried(false); setOutcome(list.length ? 'Hold' : 'Ship')
  }, [isOpen])

  const named = outcome === 'Ship with named gaps'
  const missing = named ? list.filter(b => !notes[b.id]?.trim()) : []
  const cta = outcome === 'Ship with named gaps' ? `Record Ship with ${list.length} ${list.length === 1 ? 'Gap' : 'Gaps'}` : `Record ${outcome}`
  const submit = () => {
    setTried(true)
    if (missing.length) return
    st.recordDecision(version, { outcome, gaps: named ? list.map(b => ({ id: b.id, note: notes[b.id] })) : [] })
    toast(`${outcome} recorded for ${version}.`)
    onClose()
  }
  const options = [
    { value: 'Hold', label: 'Hold', caption: `${version} waits until the blockers clear.` },
    { value: 'Ship', label: 'Ship', caption: list.length ? `Ships with every blocker below unaddressed.` : `${version} meets the policy.` },
    ...(list.length ? [{ value: 'Ship with named gaps', label: 'Ship with named gaps', caption: 'Each blocker needs a note that says why it is acceptable.' }] : []),
  ]
  return (
    <LTModal isOpen={isOpen} onClose={onClose} title={`Record a decision for ${version}?`} extraStyle={{ width: 640 }} keepOnBackdrop
      renderFooter={() => (
        <>
          <LTButton variant="outline" size="medium" label="Keep Reviewing" onClick={onClose} />
          <LTButton variant="primary" size="medium" label={cta} onClick={submit} />
        </>
      )}>
      <div className="decide">
        <p className="decide__standing">
          <span className="muted">Standing against policy</span>
          <LTTag text={standing.label} variant={standing.kind === 'meets' ? 'success' : standing.kind === 'blocked' || standing.kind === 'incomplete' ? 'danger' : 'secondary'} labelStyle="filled" />
        </p>
        <LTRadioGroup label="Decision" value={outcome} onChange={setOutcome} options={options} groupName="decision" required ariaRequired />
        {named && (
          <div className="decide__gaps">
            <p className="sec-h">Name each gap</p>
            {list.map(b => (
              <div key={b.id} className="decide__gap">
                <p className="decide__gap-h"><LTTag text={KIND[b.kind].label} variant={KIND[b.kind].tone === 'danger' ? 'danger' : KIND[b.kind].tone === 'attention' ? 'attention' : 'secondary'} /> <strong>{b.detail?.scenario ?? b.feature?.id ?? 'Run'}</strong> <span className="muted">{b.criterion?.criterion ?? b.text ?? b.feature?.name}</span></p>
                <LTTextarea label={`Why ${b.detail?.scenario ?? b.feature?.id ?? 'this'} is acceptable`} rows={2} required value={notes[b.id] ?? ''}
                  onChange={v => setNotes(n => ({ ...n, [b.id]: v }))}
                  validationStatus={tried && !notes[b.id]?.trim() ? 'error' : 'default'}
                  validationMessage="Enter why this gap is acceptable." />
              </div>
            ))}
          </div>
        )}
        {outcome === 'Ship' && list.length > 0 && (
          <LTInlineMessage variant="warning">Ship records {list.length} blockers as unaddressed. Ship with named gaps keeps a note on each.</LTInlineMessage>
        )}
        <p className="body decide__consequence">Verdicts stay as Rook judged them. Everyone on this project sees this decision.</p>
      </div>
    </LTModal>
  )
}

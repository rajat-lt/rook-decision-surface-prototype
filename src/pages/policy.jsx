// Release policy (brief §7.11, spec §4.11) [proposed]: the rules a version
// must meet. Strict mirrors the docs' release gate; Permissive mirrors the
// skill's general CI recipe. A gate people can read replaces a score they
// must trust. The policy is per project here (open question 11).
import React, { useMemo, useState } from 'react'
import { LTButton, LTCheckbox, LTInlineMessage, LTLink } from '../lt.jsx'
import { LTSegmentedControl, LTSelect } from '../overlays.jsx'
import { useStore } from '../store.jsx'
import { PRESETS, STRICT, POLICY_NAME, standing } from '../model.js'
import { verdictLine } from './overview.jsx'
import { href } from '../router.js'

const RULES = [
  { key: 'required', label: 'Required scenarios', caption: 'Which selected scenarios the policy judges.',
    options: [['all', 'Every selected scenario'], ['functional', 'Functional only'], ['adversarial', 'Adversarial only'], ['non_functional', 'Non-functional only']] },
  { key: 'failedAllowed', label: 'Failed criteria allowed', caption: 'A failed criterion is an observed defect.', options: [[0, '0'], [1, '1'], [2, '2']] },
  { key: 'uvAllowed', label: 'Where Unable to Verify is allowed', caption: 'Blocking on it keeps the verdict as Unable to Verify.',
    options: [['none', 'Nowhere'], ['read', 'Outside write tools'], ['any', 'Anywhere']] },
  { key: 'unrunnableAllowed', label: 'Where unrunnable is allowed', caption: 'An unrunnable scenario counts toward the assurance gap. [proposed addition]',
    options: [['none', 'Nowhere'], ['any', 'Anywhere']] },
  { key: 'compromisedAllowed', label: 'Compromised attacks allowed', caption: 'A grounded partial compromise counts as Fail.', options: [[0, '0'], [1, '1']] },
  { key: 'minVerification', label: 'Minimum verification coverage', caption: 'Criteria verified out of criteria on executed scenarios.',
    options: [[null, 'Any'], [80, '80%'], [90, '90%'], [95, '95%'], [100, '100%']] },
  { key: 'minBehaviour', label: 'Minimum behaviour coverage', caption: 'Features with an executed scenario out of features discovered.',
    options: [[null, 'Any'], [50, '50%'], [67, '67%'], [80, '80%'], [100, '100%']] },
]
const same = (a, b) => Object.keys(STRICT).filter(k => k !== 'preset').every(k => a[k] === b[k])
const presetOf = p => (same(p, PRESETS.strict) ? 'strict' : same(p, PRESETS.permissive) ? 'permissive' : 'custom')

export function PolicyPage() {
  const st = useStore()
  const [draft, setDraft] = useState(st.policy)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(st.policy)
  const set = patch => { const next = { ...draft, ...patch }; setDraft({ ...next, preset: presetOf(next) }); setSaved(false) }
  const preview = useMemo(() => standing('v12', st.proto === 'no-policy' ? 'blocked' : st.proto, draft), [draft, st.proto])
  const strict = useMemo(() => standing('v12', st.proto === 'no-policy' ? 'blocked' : st.proto, PRESETS.strict), [st.proto])
  const perm = useMemo(() => standing('v12', st.proto === 'no-policy' ? 'blocked' : st.proto, PRESETS.permissive), [st.proto])
  return (
    <div className="page-col">
      <div className="page-head">
        <h1 className="h-title">Release Policy</h1>
        <span className="tag-proposed">[proposed] · Web app, every agent</span>
      </div>
      {st.proto === 'no-policy' && (
        <LTInlineMessage variant="info">The prototype state Awaiting a policy hides the saved policy from Overview and Agents. Pick another state in the prototype bar to apply it.</LTInlineMessage>
      )}
      <section className="panel policy" aria-labelledby="preset-h">
        <div className="panel__head">
          <h2 id="preset-h" className="sec-h">Preset</h2>
          <LTSegmentedControl ariaLabel="Preset" selectedValue={draft.preset}
            options={[{ value: 'strict', label: 'Strict' }, { value: 'permissive', label: 'Permissive' }, { value: 'custom', label: 'Custom' }]}
            onChange={v => { if (v !== 'custom') { setDraft({ ...PRESETS[v] }); setSaved(false) } else setDraft({ ...draft, preset: 'custom' }) }} />
        </div>
        <p className="caption">
          {draft.preset === 'strict' && 'The docs\' release gate: every selected scenario passes, and missing evidence, Unable to Verify, incomplete work or compromised results block.'}
          {draft.preset === 'permissive' && 'The skill\'s general CI recipe: Fail, incomplete work and compromised results block. Unable to Verify and unrunnable gaps are reported without blocking.'}
          {draft.preset === 'custom' && 'Your own rules. Changing any rule below switches the preset to Custom.'}
        </p>
        <dl className="rules">
          {RULES.map(r => (
            <div key={r.key} className="rule">
              <dt><span className="rule__label">{r.label}</span><span className="caption">{r.caption}</span></dt>
              <dd>
                <LTSelect inputAriaLabel={r.label} value={String(draft[r.key])} width={260}
                  options={r.options.map(([v, l]) => ({ value: String(v), label: l }))}
                  onChange={v => set({ [r.key]: v === 'null' ? null : /^\d+$/.test(v) ? Number(v) : v })} />
              </dd>
            </div>
          ))}
          <div className="rule">
            <dt><span className="rule__label">Run must be complete</span><span className="caption">Halted or unjudged work, or a planned scenario left unrun, blocks sign-off.</span></dt>
            <dd><LTCheckbox label="The gating run finished every phase" checked={draft.mustBeComplete} onChange={v => set({ mustBeComplete: v })} /></dd>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="pv-h">
        <div className="panel__head"><h2 id="pv-h" className="sec-h">What this policy does to v12</h2></div>
        <p className="body"><strong>{verdictLine('v12', preview)}</strong>{preview.blockers.length ? `: ${preview.blockers.map(b => b.id).join(', ')}` : ''}.</p>
        <p className="caption">Strict: {strict.label}. Permissive: {perm.label}. <LTLink href={href.tab('overview')}>Open Overview</LTLink></p>
      </section>

      <div className="policy__foot">
        <p className="caption">Your CI gate reads its own script. Change both together.</p>
        {saved && !dirty && <LTInlineMessage variant="success" size="small">{POLICY_NAME[st.policy.preset]} policy saved.</LTInlineMessage>}
        {dirty && <LTButton variant="outline" size="medium" label="Discard Changes" onClick={() => setDraft(st.policy)} />}
        <LTButton variant="primary" size="medium" label="Save Policy" onClick={() => { st.set({ policy: draft }); setSaved(true) }} />
      </div>
    </div>
  )
}

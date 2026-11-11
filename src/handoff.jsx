// The hand-off drawer (spec §4.12) and its command catalogue. Every command
// is the docs' or the skill's exact syntax; `<…>` values are filled from the
// page. Prompts follow the docs' style ("Use the rook skill to …"), where
// "Do not" is waived because they instruct an agent (spec C4).
import React, { createContext, useCallback, useContext, useState } from 'react'
import { LTButton, LTCodeBlock, LTCopyToClipboard, LTInlineMessage } from './lt.jsx'
import { LTDrawer } from './overlays.jsx'
import { ToolName } from './verdict.jsx'
import { SCENARIO, TOOLS, WRITE_TOOLS, PROFILES } from './data.js'
import { copyText } from './clipboard.js'
import { announce } from './lt.jsx'

const P = 'web-app'
const A = 'refund-desk'
const PRE = [`rook project use ${P}`, `rook agent use ${A}`]

/** Write tools a set of scenarios exercises: their call expectations and criteria. */
export function writeToolsFor(ids) {
  const set = new Set()
  for (const id of ids) {
    const s = SCENARIO[id]
    for (const c of s.calls ?? []) if (TOOLS[c.tool]?.access === 'write') set.add(c.tool)
    for (const c of s.criteria) if (c.tool && TOOLS[c.tool]?.access === 'write') set.add(c.tool)
  }
  // Any live call can reach every write tool the agent has; list those named first.
  for (const t of WRITE_TOOLS) set.add(t)
  return [...set]
}

/* ---------- the catalogue ---------- */
export const HANDOFF = {
  rerun: (ids, name = `rerun-${ids[0].toLowerCase()}`) => ({
    action: ids.length > 1 ? 'Rerun the selected scenarios' : `Rerun ${ids[0]}`,
    what: `Runs ${ids.join(', ')} again against the live agent through the staging profile, one at a time, as a new shared run named ${name}.`,
    credits: true, live: true, writeTools: writeToolsFor(ids), profile: 'staging', target: 'refund-desk on staging',
    commands: [...PRE, `rook run --only ${ids.join(',')} --profile staging --concurrency 1 --name ${name}`],
    prompt: `Use the rook skill to rerun ${ids.join(' and ')} against the staging profile with concurrency 1, named ${name}. Show the plan and credits first. Do not run paid operations until I confirm.`,
    after: `A new run named ${name} appears under Runs once it syncs. Open it to see the new verdicts, then compare it with this one.`,
  }),
  profileFix: (whatMissing, reason) => ({
    action: reason ?? 'Fix what the profile returns',
    what: 'Diagnoses the staging profile against the agent and repairs its script, then tests it with one harmless goal and records the result upstream.',
    credits: true, live: true, writeTools: WRITE_TOOLS, liveNote: 'The test goal asks for a reply only.', profile: 'staging', target: 'refund-desk on staging',
    commands: [...PRE, `rook profile fix staging --what "${whatMissing}"`, 'rook profile test staging --goal "Say hello and nothing else."', 'rook sync'],
    prompt: `Use the rook skill to fix the staging profile so it ${whatMissing}. Show me the script diff and the credits first, test it with a goal that asks for a reply only, then sync. Do not change any scenario's criteria.`,
    after: 'Setup shows the profile\'s new capabilities. Rerun the affected scenarios to turn their Unable to Verify into a verdict.',
  }),
  finishRun: run => ({
    action: 'Finish the run with collect and judge',
    what: `Continues ${run.name} in place: collects the evidence that landed after the agent replied, then judges every scenario.`,
    credits: true, live: false, liveNote: 'The collect hook reads evidence; the agent itself is not called again.', writeTools: [], profile: run.profile, target: 'the same run',
    commands: [...PRE, `rook run --run ${run.id} --phases collect,judge`],
    prompt: `Use the rook skill to continue run ${run.id} with only the collect and judge phases. Show the credits first. Do not start a new run.`,
    after: 'The same run gains its verdicts here, and Overview judges the version again.',
  }),
  resume: run => ({
    action: 'Carry the interrupted run forward',
    what: `Creates a new run from ${run.name} and carries its compatible completed work forward.`,
    warning: 'The target may already have changed state: an interrupted call can have moved money even with no response recorded.',
    credits: true, live: true, writeTools: WRITE_TOOLS, profile: run.profile, target: 'refund-desk on staging',
    commands: [...PRE, `rook run --resume ${run.id}`],
    prompt: `Use the rook skill to resume run ${run.id} as a new run. Before anything runs, check whether the interrupted scenarios already changed the target's state, and show the plan and credits. Do not run paid operations until I confirm.`,
    after: 'A new run appears under Runs with the carried work marked.',
  }),
  runsSync: () => ({
    action: 'Retry the uploads',
    what: 'Uploads every finished normal run that is still waiting on this machine.',
    credits: false, live: false, writeTools: [], profile: '–', target: 'Rook cloud',
    commands: [...PRE, 'rook runs sync'],
    prompt: 'Use the rook skill to retry outstanding run uploads with rook runs sync, and tell me which runs it recorded.',
    after: 'The runs appear under Runs, and Overview judges the version on them.',
  }),
  generate: ({ categories = [], total, focus }) => ({
    action: 'Generate scenarios for the gaps',
    what: `Writes up to ${total} new scenarios${categories.length ? ` in ${categories.join(', ')}` : ''}, focused on the selection. Nothing runs against the agent.`,
    credits: true, live: false, writeTools: [], profile: '–', target: 'local scenario files',
    commands: [...PRE, `rook generate${categories.length ? ` --category ${categories.join(',')}` : ''} --total ${total} -- "${focus}"`, 'rook scenarios list', 'rook sync'],
    prompt: `Use the rook skill to generate up to ${total} scenarios${categories.length ? ` in the ${categories.join(', ')} categories` : ''}, focused on: ${focus}. Show the plan and credits first, then let me review the new scenario files before you sync. Do not run them.`,
    after: 'The new scenarios appear in Coverage as awaiting their first run, once you sync.',
  }),
  mcp: server => ({
    action: `Approve and enable the ${server} verifier`,
    what: `Trusts the ${server} MCP server that explore found in .mcp.json, after you have read what it runs, so read-only checks can use it.`,
    credits: false, live: false, writeTools: [], profile: '–', target: `the ${server} MCP server`,
    commands: [...PRE, `rook mcp get ${server}`, `rook mcp approve ${server} --origin discovered`, `rook mcp enable ${server}`],
    prompt: `Use the rook skill to show me what the ${server} MCP server runs, then approve and enable it once I confirm.`,
    after: 'Setup shows the verifier as approved; rerun the scenarios whose checks need it.',
  }),
  rca: run => ({
    action: 'Run root-cause analysis',
    what: `Investigates each failure cluster in ${run.name} and writes a cause, a remedy and the files involved. The remedy is a hypothesis, not a verified fix.`,
    credits: true, live: false, liveNote: 'It reads the run\'s records and the source, read-only.', writeTools: [], profile: run.profile, target: 'the run\'s records',
    commands: [...PRE, `rook report ${run.id} --rca`],
    prompt: `Use the rook skill to run root-cause analysis on run ${run.id}. Show the credits first; RCA cost depends on the number of clusters. Do not apply any remedy.`,
    after: 'Each cluster on the run page gains its cause, remedy and files.',
  }),
  editExpectation: id => ({
    action: `Edit ${id}'s expectation`,
    what: `Changes the criterion in ${id}'s scenario file, then records the new definition upstream. Earlier runs keep their own snapshot.`,
    warning: 'Change the expectation only when it is wrong. Weakening a business rule to pass hides a real failure.',
    credits: false, live: false, writeTools: [], profile: '–', target: 'local scenario files',
    commands: [`# Find the project directory by its ID: <project-id> or <project-slug>--<project-id>`, `$EDITOR .testmuai/rook/projects/<project-dir>/agents/${A}/scenarios/${id}.yaml`, ...PRE, 'rook scenarios list', 'rook sync'],
    prompt: `Use the rook skill to find ${id}'s scenario file by the project ID, show me its acceptance criteria, and propose the change I describe. Do not weaken a business rule. After I approve the edit, run rook scenarios list and rook sync.`,
    after: `Comparison shows ${id} as redefined on its next run, so the change never reads as a regression.`,
  }),
  bug: ({ runUrl, scenario, criterion, excerpt }) => ({
    action: 'Report the agent defect',
    what: 'Copies a bug report with what an engineer needs to reproduce it. Rerun the scenario once the agent is fixed.',
    credits: true, live: true, liveNote: 'The rerun does, after the fix. Copying the report does neither.', writeTools: writeToolsFor([scenario]),
    profile: 'staging', target: 'refund-desk on staging',
    bugReport: [`Run: ${runUrl}`, `Scenario: ${scenario}`, `Criterion: ${criterion.criterion_id} · ${criterion.criterion}`, `Expected: ${criterion.expected}`, `Achieved: ${criterion.achieved}`, `Evidence: ${excerpt}`].join('\n'),
    commands: [...PRE, `rook run --only ${scenario} --profile staging --concurrency 1 --name rerun-${scenario.toLowerCase()}`],
    commandsLabel: 'After the fix, run in the terminal',
    prompt: `Use the rook skill to rerun ${scenario} against the staging profile with concurrency 1 once the fix is merged. Show the plan and credits first. Do not run paid operations until I confirm.`,
    after: `The rerun's verdict for ${scenario} shows here; Comparison marks it newly fixed if it passes.`,
  }),
  acceptRisk: () => ({
    action: 'Carry the accepted risk into sign-off',
    what: 'Nothing runs. The note you wrote travels with this criterion into Record Decision, where the release can ship with this gap named.',
    credits: false, live: false, writeTools: [], profile: '–', target: '–', commands: null,
    after: 'Record Decision lists this gap with your note under Ship with named gaps.',
  }),
  firstSharedRun: version => ({
    action: `Make the first shared run on ${version}`,
    what: 'Records the agent upstream, then runs the release suite as a normal run so the team can see it.',
    credits: true, live: true, writeTools: WRITE_TOOLS, profile: 'staging', target: 'refund-desk on staging',
    commands: [...PRE, 'rook sync', 'rook run --profile staging --concurrency 1 --name release-gate'],
    prompt: 'Use the rook skill to sync refund-desk and run the reviewed suite against the staging profile with concurrency 1, named release-gate. Show the plan and credits first. Do not run paid operations until I confirm.',
    after: 'The run appears under Runs once it syncs, and Overview judges the version on it.',
  }),
  setupAgent: (agent, labels) => ({
    action: `Set up ${agent}`,
    what: 'Takes the agent from discovered to its first shared run, one command per step.',
    credits: true, live: true, writeTools: [], liveNote: 'Profile add and profile test call the agent.', profile: 'to be created', target: agent,
    steps: [
      labels.includes('discovered only') && { label: 'Confirm it runs on its own', cmd: `rook agent use ${agent}`, note: 'A discovered subagent is not automatically an independently runnable target.' },
      labels.includes('no-profile') && { label: 'Create and test a profile', cmd: 'rook profile add staging --command \'claude -p "{{goal}}"\'', note: 'Spends credits and calls the agent.' },
      labels.includes('no-profile') && { label: 'Test it with a reply-only goal', cmd: 'rook profile test staging --goal "Say hello and nothing else."' },
      labels.includes('no-scenarios') && { label: 'Generate and review scenarios', cmd: 'rook generate', note: 'Spends credits. Review the scenario files before you sync.' },
      { label: 'Record it upstream', cmd: 'rook sync' },
      { label: 'Run it once, shared', cmd: 'rook run --profile staging --concurrency 1 --name release-gate', note: 'Spends credits and calls the agent.' },
    ].filter(Boolean),
    commands: null,
    prompt: `Use the rook skill to set up ${agent}: create and test a staging profile, generate scenarios for me to review, sync, then plan a first run. Show the credits before each paid step. Do not run anything against the agent until I confirm.`,
    after: 'The agent\'s readiness labels clear one by one, and its first run appears under Runs.',
  }),
}

/* ---------- the drawer ---------- */
const Ctx = createContext(() => {})
export const useHandoff = () => useContext(Ctx)

export function HandoffProvider({ children }) {
  const [h, setH] = useState(null)
  const open = useCallback(x => setH(x), [])
  return (
    <Ctx.Provider value={open}>
      {children}
      <HandoffDrawer h={h} onClose={() => setH(null)} />
    </Ctx.Provider>
  )
}

const yesNo = b => (b ? 'Yes' : 'No')

function HandoffDrawer({ h, onClose }) {
  const moneyTool = h?.writeTools?.find(t => TOOLS[t]?.moneyMoving)
  const cmdText = h?.commands?.join('\n')
  return (
    <LTDrawer isOpen={!!h} onClose={onClose} width={640} title={h ? `Next step: ${h.action}` : ''}
      footerContent={<LTButton variant="outline" size="medium" label="Close" onClick={onClose} />}>
      {h && (
        <div className="handoff">
          <section className="handoff__sec">
            <h3 className="sec-h">What this does</h3>
            <p className="body">{h.what}</p>
            {h.warning && <LTInlineMessage variant="warning">{h.warning}</LTInlineMessage>}
          </section>

          <section className="handoff__sec">
            <h3 className="sec-h">Before you run it</h3>
            <dl className="facts">
              <dt>Spends credits</dt><dd>{yesNo(h.credits)}{h.credits && <span className="muted"> · the amount is shown in the plan before anything runs</span>}</dd>
              <dt>Calls the live agent</dt><dd>{yesNo(h.live)}{h.liveNote && <span className="muted"> · {h.liveNote}</span>}</dd>
              <dt>Write tools in scope</dt>
              <dd>{h.writeTools?.length ? <span className="tool-list">{h.writeTools.map(t => <ToolName key={t} tool={t} />)}</span> : '0 write tools'}</dd>
              <dt>Profile and target</dt><dd>{h.profile === '–' ? h.target : `${h.profile} · ${h.target}`}</dd>
            </dl>
            {h.live && moneyTool && (
              <LTInlineMessage variant="warning">{moneyTool} moves real money on staging, and every change stays.</LTInlineMessage>
            )}
          </section>

          {h.bugReport && (
            <section className="handoff__sec">
              <h3 className="sec-h">Bug report</h3>
              <LTCodeBlock title="Report text" headerActions={
                <LTCopyToClipboard textToCopy={h.bugReport} copyAriaLabel="Copy bug report" copiedAriaLabel="Bug report copied" dark size="small" />
              }><pre className="code-pre">{h.bugReport}</pre></LTCodeBlock>
              <LTButton variant="outline" size="medium" label="Copy Bug Report" className="handoff__copy"
                onClick={async () => { await copyText(h.bugReport); announce('Bug report copied') }} />
            </section>
          )}

          {h.steps && (
            <section className="handoff__sec">
              <h3 className="sec-h">Run in the terminal, one step at a time</h3>
              <ol className="checklist">
                {h.steps.map((st, i) => (
                  <li key={i} className="checklist__item">
                    <p className="checklist__label">{st.label}</p>
                    <LTCodeBlock headerActions={<LTCopyToClipboard textToCopy={st.cmd} copyAriaLabel={`Copy step ${i + 1}`} copiedAriaLabel="Command copied" dark size="small" />}>
                      <pre className="code-pre">{st.cmd}</pre>
                    </LTCodeBlock>
                    {st.note && <p className="caption">{st.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {h.commands && (
            <section className="handoff__sec">
              <h3 className="sec-h">{h.commandsLabel ?? 'Run in the terminal'}</h3>
              <LTCodeBlock title="Terminal" headerActions={
                <LTCopyToClipboard textToCopy={cmdText} copyAriaLabel="Copy commands" copiedAriaLabel="Commands copied" dark size="small" />
              }><pre className="code-pre">{h.commands.map((c, i) => <span key={i} className={c.startsWith('#') ? 'tok-comment' : undefined}>{c}{'\n'}</span>)}</pre></LTCodeBlock>
            </section>
          )}

          {h.prompt && (
            <section className="handoff__sec">
              <h3 className="sec-h">Or ask your coding agent</h3>
              <LTCodeBlock title="Prompt" headerActions={
                <LTCopyToClipboard textToCopy={h.prompt} copyAriaLabel="Copy prompt" copiedAriaLabel="Prompt copied" dark size="small" />
              }><pre className="code-pre">{h.prompt}</pre></LTCodeBlock>
            </section>
          )}

          <section className="handoff__sec">
            <h3 className="sec-h">After it finishes</h3>
            <p className="body">{h.after}</p>
          </section>
        </div>
      )}
    </LTDrawer>
  )
}

/** The profile's name and its YAML, for "Pinned Profile" drawers. */
export const profileFor = id => PROFILES[id]

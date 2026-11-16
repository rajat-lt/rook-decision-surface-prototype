# Rook decision surface prototype

A working prototype of Rook's hosted web UI (rook.lambdatest.com) redesigned as a **decision surface**: QA engineers, QA leads and engineering leaders make release decisions in the browser, and every next step hands off to the terminal with the exact `rook` command, its coding-agent prompt, and its side effects stated first. **The terminal acts, the browser decides.** Built from design-context with mock data only.

- **Live:** https://rajat-lt.github.io/rook-decision-surface-prototype/
- **Spec:** [`rook-decision-surface.md`](rook-decision-surface.md) (house format: brief, sources, structure, behaviour and states, mock data, conflicts C1 to C49, gaps G1 to G12, decisions D1 to D27, copy finalists, open questions, ship checklist)
- **Scope cut (16 Nov 2026):** [`../rook-ux/rook-prototype-scope-cut.md`](../rook-ux/rook-prototype-scope-cut.md) removed run comparison, Security, the release policy and Record Decision. The removed parts stay described below, each marked.
- **Inputs:** the build brief and the journeys doc (*Rook: primary UX journeys and rationale*, Nov 11, 2026)

Nothing here runs the agent, edits a scenario or profile, writes a local file or grants a permission. Triage dispositions are `[proposed]`: they wait on the journeys doc's open question 1.

*Removed 16 Nov 2026 (Rajat: scope cut).* Earlier wording: Decision records (triage dispositions, the release policy and sign-offs) are `[proposed]`: they wait on the journeys doc's open question 1.

## Try it

Start at **Agent Overview** (`#/p/web-app/a/refund-desk/overview`): the version's readiness in words, its proof ledger and the ranked blockers. The agent has five tabs: Overview, Runs, Coverage, Triage and Setup (that order from Rajat's v2 list). A run opens on its first scenario.

*Removed 16 Nov 2026 (Rajat: scope cut).* Earlier wording: Start at **Agent Overview** (`#/p/web-app/a/refund-desk/overview`): the version's call in words, its proof ledger, the ranked blockers, what changed since v11, the trend and the decision record.

The dashed **Prototype** bar in the top bar is not part of the design:

- **State:** With blockers (default), Clear, Incomplete run, Awaiting a shared run, Empty organization, Loading, Error. *Removed 16 Nov 2026 (Rajat: scope cut).* Earlier states: Blocked (default), Meets policy, Awaiting a policy, Incomplete run, Awaiting a shared run, Empty organization, Loading, Error.
- **Shell:** Platform (the LambdaTest rail and top bar) or Standalone (no rail), journeys doc question 10.
- **Viewer:** QA engineer (Ritika Sharma), QA lead (Gabbar Singh), Engineering leader (Oppenheimer). It changes only the avatar and who a disposition is attributed to; Rook documents no roles. (Earlier: "or decision", removed 16 Nov 2026 with Record Decision.)
- **Reset** (↺) clears your triage. It lives in this browser only, under the storage key `rook-decision-surface:v2`. *Removed 16 Nov 2026 (Rajat: scope cut).* Earlier wording: Reset (↺) clears your triage, decisions and policy. They live in this browser only.

### A five-minute walkthrough

1. **J1 Release readiness.** Overview reads *v12 has 1 failed, 2 unverifiable, and 1 unrunnable scenario, and 2 untested features*, with 6 blockers ranked by risk. Open the first blocker's **View Evidence**. (Earlier: *4 items block v12*, replaced 16 Nov 2026 by the scope cut.)
2. **J2 Triage.** On SC-004, the red banner says why it failed; **Overview** shows `issue_refund` called for $249 before any email was given, while *What the agent said* claims it confirmed the email. On **Acceptance criteria**, set a **Reason** and **Assigned to** on C2 (or for every open criterion from the header), then **Confirm** for the hand-off; the bug button copies a bug report. *Replaced 16 Nov 2026 (Rajat: v2 changes).* Earlier: Set a **Disposition**, then **Next Step** for the hand-off.
3. **J3 Close the gap.** SC-009 is Unable to Verify: its amber banner says the hook recorded `issue_refund` without its arguments. The banner's **Next Step** composes `rook profile fix staging --what "…"`. Coverage's **Gap breakdown** groups every gap by cause.
4. **J4 Regression check.** *Removed 16 Nov 2026 (Rajat: scope cut).* Earlier wording: **Compare Runs**: SC-004 newly failing, SC-006 newly fixed, SC-008 flaky, SC-005 redefined and left out of the regression buckets.
5. **J5 Plan coverage.** Coverage lists F-002 and F-003 first; select them and **Generate Scenarios**.
6. **Decide.** *Removed 16 Nov 2026 (Rajat: scope cut).* Earlier wording: Change the policy to Permissive (Agents → **Release Policy**) and watch Overview become *1 item blocks v12*; then **Record Decision**.

## v1 (Nov 11, 2026)

| Brief item | Priority | What to look at |
|---|---|---|
| §7.2 Agent Overview | P0 | Verdict line and standing, pinned context, proof ledger (fractions, never a bare %), blockers ranked by risk with write badges and triage state, Since v11, trend, decision record. Version switcher: v11 shows the compromised SC-006 |
| §7.4 Scenario result | P0 | *Replaced 16 Nov 2026 (Rajat: v2 changes), see the v2 section.* 400px scenario pane; why card (*Why it failed*, *Why it couldn't be verified*, *Why it was compromised*); goal; observed calls before the agent's claim; criteria filter opening on Fail; criterion cards; triage footer; evidence drawer (Request, Response, Verdict, Artefacts) |
| §8.4 Hand-off drawer | P0 | Every **Next Step**: what it does, credits, live calls, write tools, profile and target, command, prompt, after |
| §7.3 Run detail | P1 | *Removed 16 Nov 2026 (Rajat: v2 changes): a run opens on its first scenario; its header moved there.* Pinned header, **View Plan** (`run.yaml`), pinned versus current profile, run ledger, Failure clusters analysis, failures by tool, scenario table, unrunnable and skipped |
| §7.5 Triage | P1 | Scope, verdict and group-by switches, multi-select **Assign** and **Set Disposition** |
| §7.6 Run comparison | P1 | *Removed 16 Nov 2026 (Rajat: scope cut).* Base and head pickers, the guard, six buckets, criterion-level before and after; try smoke against release-gate on v12 for the guard banner |
| §7.7 Coverage | P1 | Feature by class matrix, Never Run, Unrunnable, Excluded, Stale, gap breakdown, **Generate Scenarios** |
| §7.1 Agents | P2 | *Replaced 16 Nov 2026 (Rajat: v2 changes): rows with a meta line, see the v2 section.* Outcome mark, standing, verification fraction, open triage, last-run bar with counts on hover, Status and Profile filters, readiness labels with **Set Up Agent** |
| §7.8 Security | P2 | *Removed 16 Nov 2026 (Rajat: scope cut).* Rook's nine categories by outcome; framework lenses wait for a mapping (spec C30) |
| §7.9 Setup | P2 | Hook phase timeline, evidence capability, tools, versions with call graph and full spec, context and findings |
| §7.10 Record Decision | P2 | *Removed 16 Nov 2026 (Rajat: scope cut).* Hold, Ship, Ship with named gaps, each gap needing a note |
| §7.11 Release policy | P2 | *Removed 16 Nov 2026 (Rajat: scope cut).* Strict, Permissive, Custom; rules; live preview against v12 |

## v2 scope cut (16 Nov 2026)

Rajat cut four things from Rook v1 (brief: `rook-ux/rook-prototype-scope-cut.md`; build brief v0.3.1 is the source of truth):

- **Run and version comparison:** the comparison page, its six buckets, Since v11, the trend and every Compare link.
- **Security:** the tab and page, the attack reach tiles and the attack words Defended and Unverified.
- **Release policy:** the page and route, the presets, the standing labels and the run's Gate policy fact.
- **Record Decision:** the modal, the Overview button, the decision record card and the seeded decisions.

What changed in their place: Overview's readiness reads as facts with one default blocker ranking (6 blockers on v12), the ledger has 3 tiles, Agents shows **Open blockers**, and the run ledger's third tile is Behaviour coverage. Adversarial scenarios, the `compromised` flag, all five dispositions and the version switcher stay. Old links to `…/security`, `…/compare` and `…/settings/release-policy` land on *This page is outside the prototype*.

## v2 changes (16 Nov 2026)

Rajat's list, on top of the scope cut (spec §1.4, conflicts C37 to C49):

| Where | What changed |
|---|---|
| Projects | The row's meta adds `Updated 1 day ago` |
| Agents | Rows instead of a table: the outcome mark, the name with its open-blockers tag, a meta line (version, features, scenarios, runs, last run date and time, verification, untriaged), the last run's bar on the right. The local ID is gone |
| Agent tabs | Overview, Runs, Coverage, Triage, Setup |
| Runs | Rows with the run status before the name, a meta line with date and time (no credits), the results bar on the right; search, Status, Version and Started by filters; the two captions removed |
| Run detail | Removed. A run opens on its first scenario |
| Scenario page | Modelled on Test Manager's Test Instances listing: the run's header and summary card on top, the run's scenarios in the left pane, then the scenario's meta, a banner (red when it failed), and **Overview**, **Acceptance criteria** and **Evidence** tabs. Evidence sits on the page. Every criterion is expanded. Open criteria carry **Reason**, **Assigned to**, a bug button and **Confirm** (primary); the header sets Reason and Assigned to for all of them at once. The Note field is gone |
| Code blocks | Light by default |

## Run it

```bash
npm install
npm run dev
```

The dev server runs on port 5186 (`strictPort`; 5185, the brief's port, is taken, spec C14). `npm run build` writes `dist/`; `npm run preview` serves it on 5187. `npm run check` asserts the mock data's story (spec §5.6). `npm run tokens` regenerates `src/tokens.css` from design-context's `data/tokens.json` on `main` (the sibling `../design-context` checkout, or `DESIGN_CONTEXT=/path`).

## How it is built from design-context

- **Tokens:** `src/tokens.css`, generated by `scripts/tokens.mjs` (copied from kane-playground, PROTO-1): 125 tokens from design-context `main` at `6cfb737`, each naming its token path.
- **Components:** look-alikes of `@lambdatestincprivate/lt-components` (private) under their real names: `src/lt.jsx` and `src/overlays.jsx` from the automation-details prototype (it carries the drawer, code block, modal and copy button the hand-off needs), plus LTInlineMessage, LTProgressBar, LTCheckbox, LTRadioGroup and LTFormControl from project-listing-revamp, and new LTSelect and LTBreadcrumbs. Undocumented props are listed in spec §7.1 (PROTO-5).
- **Composites with no LT component:** verdict label, proof ledger tile, results bar, pinned context line, tool access badge (`src/verdict.jsx`, spec §3.5).
- **Patterns:** `platform-sidebar.md`, `topbar.md`, `project-listing.md`, `test-entity-listing.md`, `hyperexecute-job-details.md`, `automation-details.md`, `modal.md`.
- **Icons:** lucide-react 1.58.0, 45 names on Nov 11, 44 from Nov 16 (`ShieldCheck` and `ShieldQuestionMark` left with the Defended and Unverified words; `Bug` came in for the bug buttons, checked in the installed package), every one checked in the installed package. The Nov 11 list: Accessibility, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Bell, Bot, ChartColumn, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDashed, CircleQuestionMark, CircleSlash, CircleX, ClipboardList, Copy, Ellipsis, FileText, Globe, House, Info, KeyRound, Link, LoaderCircle, Minus, Monitor, RotateCcw, Scale, ScanEye, Search, Settings, ShieldAlert, ShieldCheck, ShieldQuestionMark, Smartphone, SquareTerminal, TestTubes, TriangleAlert, Workflow, Wrench, X, Zap. (The brief's `CircleHelp` and `ShieldQuestion` are deprecated aliases of `CircleQuestionMark` and `ShieldQuestionMark`, spec C21.)
- **Copy:** `ux-text-guidelines.md`; the brief's draft strings went through `/text` (spec §9). Product words that break the no-negation rule stay as written (spec C2).
- **Mock data:** people and the project from `mock-data.md`; the agent, its tools, orders, policy and pressure lines from Rook's public `refund-desk` sample; every file field from the samples' real `verdict.yaml`, `request.json`, `response.json`, `hooks.json` and `run.yaml`. Numbers are placeholders kept consistent.
- **Rook facts:** github.com/LambdaTest/rook at `b2d59ae` (README, CHANGELOG 0.1.0 to 0.1.18, samples, the coding-agent skill) and the TestMu AI docs, read Nov 11, 2026 (spec §2).

## Files

| File | What it holds |
|---|---|
| `src/data.js` | People, project, tools, versions, profiles, features, scenarios, traces, runs and seeded triage (seeded decisions and attack gaps removed 16 Nov 2026) |
| `src/model.js` | Totals, coverage, the blockers in one default ranking, readiness, triage queue, prototype states (attack reach, the release policy and comparison buckets removed 16 Nov 2026) |
| `src/files.js` | `request.json`, `response.json`, `hooks.json`, `verdict.yaml`, `snapshot.yaml`, `run.yaml`, `profile.yaml` built from the data |
| `src/handoff.jsx` | The hand-off drawer and its command catalogue |
| `src/verdict.jsx` | The composites |
| `src/pages/*.jsx` | One file per screen; `runs.jsx` holds the runs list only from 16 Nov 2026, and `result.jsx` the run header and the scenario page (`decision.jsx`, the Record Decision modal, and `compare.jsx`, `security.jsx` and `policy.jsx` removed 16 Nov 2026) |
| `src/shell.jsx`, `src/App.jsx` | Rail, top bar, prototype bar, routes, agent frame |
| `src/lt.jsx`, `src/overlays.jsx` | LT component look-alikes |
| `src/sample-files.js` | Verbatim copies of the sample's agent files, shown in Setup |
| `scripts/check-data.mjs` | The story assertions |

## Deploy

GitHub Pages serves the `gh-pages` branch. From a fresh `npx vite build` of `main`: `touch dist/.nojekyll`, commit `dist/` to `gh-pages` and push it.

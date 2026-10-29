# Task: Make Council setup, recipients and activity understandable

- Status: implementation complete; qualification and delivery continued in [the next increment](2026-10-29-council-next-increment.md) and [PR #44](https://github.com/Luis85/coforge/pull/44).
- Journey: BRIEF.md Council entry journey and configurable workflows.

## Why

Council intake requires an unnecessary team selection, hides setup under advanced
tools and does not show who receives a question or ongoing activity.

## Traceability

Owner request dated 2026-10-29. No imported req-* or vi-* obligations apply;
design/traceability.json contains no requirements.

## Acceptance

- Council subpages use the shared visible page-tab navigation.
- Choose an enabled Council from the active project without selecting a team.
  Show named CoWorkers, roles, providers and rounds before saving.
- Unavailable membership blocks intake with a useful recovery action.
- Setup explains and links its prerequisites; drafts survive page changes.
- Activity distinguishes queued, running, paused, human waiting and attention,
  and links to durable run evidence without starting work.
- Workflow setup has Ask Council. It waits for published answers, retains the
  child identity and makes attributed Markdown available to later steps.
- Reload, uncertain admission, cancellation and changed requests never replay
  external work or accept a stale result.

## Plan

1. Behavioural tests for selection, recipients, navigation and workflow waiting.
2. Reuse shared navigation, catalogue and Council execution boundaries.
3. UI quality, gallery review, pinned Obsidian smoke and focused native checks.
4. Full verify:project and self-review with real evidence.

## Evidence

Initial browser audit: reports/council-review/01-before-intake.png,
02-before-setup.png and 03-before-activity.png (synthetic preview).

- Focused experience/editor/execution/admission tests: 4 files, 13 passed.
- Admission and safety recheck: 2 files, 9 passed. Publication adapter recheck: 1 passed;
  unpublished and simulated contributions cannot become a live workflow answer.
- UI quality: 8 passed. Council intake/board assessment: 4 passed; corrected round
  navigation rerun: 2 passed. Gallery: 40 captures, no failures.
- Pinned native journey including saved Ask Council configuration: 1 passed.
- Latest smoke: status passed, plugin errors []; two Obsidian-core command-list
  callback errors in the reused sandbox. An earlier clean smoke had hostErrorCount 0.
- verify:artifacts passed build and prototype embedding (1 passed); generated UI
  effects report the expected skip because this project declares no visual definitions.
- Initial verify:project hit the product-test wrapper's 600-second process timeout;
  its other four gates passed.
- check --timeout 1200000: 4 gates passed, 1 failed. Full suite: 279 files passed,
  1 failed; 995 tests passed, 1 timed out and 6 pre-existing skips. The unchanged
  10,000-note intake scale test exceeded its 60-second budget.
- The isolated scale-test recheck passed unchanged in 45.35s. This is separate
  evidence; it does not make the failed full gate green. Require a clean full gate
  before merge. The final recovery stability suite also passed (8 tests).
- Logs are under reports/council-review/; screenshots are ignored QA evidence.

## Product review

The streamer needs to choose advisers, understand what they receive, submit a
reviewed question and follow progress without understanding execution internals.
The existing explicit review, private Markdown and durable run evidence are strong
foundations. The problems were discovery and visibility, plus a missing workflow
action that waits for advice.

| Perspective | Finding and change | Evidence |
| --- | --- | --- |
| User goal | Asking advice required choosing an administrative team first. Council selection now resolves the team internally. | Before intake screenshot; direct-selection behavioural test. |
| Information architecture | One primary button and a closed advanced disclosure concealed all other tasks. Every subpage now uses the existing shared page-tab navigation. | Before intake/setup screenshots; navigation and draft test. |
| Onboarding | Setup relied on knowledge of CoWorkers, teams and councils. A three-step guide explains each prerequisite and its existing action. Execution designation no longer interrupts definition setup. | Before setup screenshot; after setup browser capture and native intake journey. |
| Trust and privacy | Intake did not show its audience. A named roster now shows actual round participants, roles, provider/model or explicit simulation, plus the discussion order. Final preflight still captures exact revisions. | Light/dark intake captures; disabled-team regression. |
| Interaction | Saving, admission and execution are different actions. Those boundaries remain explicit; tab changes preserve the question and never create a run. | UI behavioural tests and native saved-note/reload assertions. |
| Activity | Detailed progress was hidden in Run monitor. Every Council tab now has project activity counts, execution state, named active responders, last-activity time and an inspection action. | History captures; runtime subscription projection. |
| Workflow usefulness | Nudge agent finishes on admission. Ask Council is a distinct step that waits for complete published answers and produces attributed Markdown for later steps. | Workflow editor and execution tests; native setup extension. |
| Reliability | Unknown admission is held for explicit acknowledgement. A confirmed child survives reload; cancellation targets the original child. Missing, failed, stale and oversized answers do not advance or replay work. | Workflow safety regression suite; source review. |
| Accessibility | Use native labelled fields, page navigation, visible focus and a polite activity region. Both themes and narrow leaves are checked with axe and overflow assertions. Full assistive-technology certification is outside this review. | UI-quality and Council browser suites. |
| Cost and permissions | Providers and simulation are visible before submission. Council execution retains inherited limits, native launch policy, private cost evidence and final human code review. No live provider was invoked for QA. | Recipient capture, existing admission integration tests and source review. |
| Performance | Poll only requests with an active Council step. Ordinary workflow ticks retain their existing state-copy cost rather than copying the entire backlog once per request. | Self-review correction in the workflow engine; source review. |
| Maintainability | Reuse the existing navigation, catalogue compiler and execution kernel. Selection, activity and workflow handoff each have separate typed modules; canonical definitions and stable IDs remain compatible. | Diff/self-review and project gates. |

### Journey health

1. Entry and intake — improved: visible tabs and one Council choice.
2. Setup — improved: explicit prerequisites and existing management actions.
3. Recipient review — improved: named participants and planned rounds before save.
4. Submission and activity — improved: reviewed admission remains separate from execution.
5. Workflow authoring — added: Ask Council waits and supplies a Markdown result.
6. Recovery — covered by failure tests; billable provider and external-process recovery remain unexercised here.

### Captured walkthrough

1. **Entry / intake — needed improvement.** Saving and submission were visibly
   separate, but team selection added an unnecessary prerequisite and the audience
   was absent. [Before intake](../../reports/council-review/01-before-intake.png).
2. **Setup — needed improvement.** The advanced disclosure concealed definitions;
   available controls did not explain the order of prerequisites. The setup guide
   now gives that order without requiring an execution desktop for editing.
   [Before setup](../../reports/council-review/02-before-setup.png),
   [final setup](../../reports/council-review/04-after-setup.png).
3. **Activity — needed improvement.** Dedicated recovery tools were useful but
   required navigating away from the question. Project activity now stays visible
   across Council tabs. [Before monitor](../../reports/council-review/03-before-activity.png).
4. **Recipients — improved.** Council selection resolves the owning team and names
   each participating specialist with its provider or simulation label.

![Final Council recipient preview](../../reports/council-review/05-after-recipients.png)

5. **Workflow action — added and verified.** The pinned native-host capture shows
   the saved Ask Council step and selected recipients. Execution safety and later
   result binding are covered by behavioural tests, without a billable invocation.
   Native capture: `reports/obsidian/cases/coforge-council-ask--saves-a-question-runs-explicit-mixed-order-simulation-retains-history-and-attributes-every-attempt/council-advice-mixed-order-and-costs.png`.
6. **Recovery — verified by tests.** Unknown, missing, cancelled, stale and oversized
   outcomes hold the parent; this is a source/test finding, not a screenshot claim.

### Limits

The first browser audit uses the labelled synthetic example; native evidence uses
only the contained pinned Obsidian sandbox. The general gallery covers the studio
and settings entry surfaces; Council-specific captures cover intake, review,
history and round editing at wide/narrow sizes in both themes. Source-level policy
findings are identified separately from visual observations. Later workflow steps
use the existing Markdown result contract (16000 characters); larger Council
reports stay complete in the child run and hold the parent with an explanation.

## Untested scope

Live billable providers are excluded from verification.

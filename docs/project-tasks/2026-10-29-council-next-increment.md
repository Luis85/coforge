# Task: Deliver a coherent Council workspace and reliable workflow handoff

- Status: implementation and polish complete; final qualification/merge record: [PR #44](https://github.com/Luis85/coforge/pull/44).
- Owner request: a researched IA review, subagent implementation, end-to-end qualification,
  final improvement pass, and a pull request merged only after green checks.
- Scope: The Council, its relationship to CoWorkers and request workflow setup, and
  the concrete qualification defect exposed by the previous increment.
- Baseline: prior Council changes retained in commit `d2cfb40`; no prior work is discarded.
- Traceability: BRIEF.md Council journeys and configurable workflows. The imported
  traceability files contain no req-* or vi-* obligations for these changes.

## Product outcome

The streamer can prepare advisers, ask a question, understand its audience and context,
follow work, and read attributed answers without learning execution internals. Automation
and storage remain available with explicit scopes and execution/recovery boundaries.
The request workflow can wait for advice without losing provenance or replaying work.

## Research and review

These are primary-source design patterns, applied to the actual product rather than
treated as user research. Current-run visual captures are required before accepting
visual findings; source and reliability findings are identified separately.

- [GOV.UK tabs](https://design-system.service.gov.uk/components/tabs/) and
  [Carbon tabs](https://www.carbondesignsystem.com/building-blocks/core/components/tabs/guidelines):
  use clear, short categories within one context; avoid many wrapped peer choices.
  Application: separate frequent Council tasks from setup and automation.
- [W3C APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): a tab widget has a complete
  selection, panel and keyboard contract. Application: retain the existing labelled
  page-navigation semantics rather than add incomplete ARIA roles to asynchronous pages.
- [GOV.UK task lists](https://design-system.service.gov.uk/components/task-list/): readiness
  needs truthful statuses and useful actions; ordered prerequisites should remain clear.
  Application: show observed blockers rather than permanent generic instructions or a
  heavy wizard. A saved definition is not proof of provider readiness.
- [Carbon empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states):
  explain the particular state and provide a constructive next action.
- [GOV.UK check answers](https://design-system.service.gov.uk/patterns/check-answers/):
  preserve inputs and make correction possible before the final action. Application:
  retain separate save, review, submission and execution boundaries.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  expose meaningful changes without moving focus or unnecessarily interrupting reading.
  Application: announce concise progress, with extended detail and timestamps outside
  the live announcement.

## IA contract

Keep The Council as one main destination. Keep the ten existing internal CouncilPage
IDs, canonical note types and draft buffers. Derive the owning task family from the
selected page so existing CTAs continue to work.

| Primary task | Secondary pages and stable IDs | Scope |
| --- | --- | --- |
| Ask | New question (`ask`), Existing note (`submit`) | Selected project; direct Council choice |
| Activity | Runs & answers (`monitor`), Team messages (`messages`) | Explicit project/all-project run scope; project team messages |
| Setup | Councils & roster (`definitions`), Storage folders (`folders`) | Project definitions; explicitly vault-wide folders; link to CoWorkers |
| Automation | Watched inboxes (`inboxes`), Schedules (`scheduler`), Event triggers (`events`), Proposal workflows (`workflows`) | Existing project automation and permission gates |

Opening The Council still starts on Ask. Navigation never saves a draft or starts work.
Request development workflows remain under Project settings → Agent workflow. Council
proposal workflows retain their distinct analytical purpose and v2 execution kernel.

## Increment A — IA, setup, activity and answers

- Owner: `ia_review` subagent. Parent owns shared documentation and final integration.
- Implement the four task families and visible secondary navigation, with clear labels.
- Replace the permanent setup essay with observed configuration readiness and direct
  prerequisite actions. Distinguish configuration, provider/runtime and executor states.
- Make task-history scope explicit while retaining discoverability across projects.
- Make activity inspection select the counted project/run and clear conflicting filters.
- Separate true newest project activity from the run prioritized for attention.
- Lead completed tasks with Read answers, human task title, captured Council and
  attributed published contributions. Keep technical references/recovery available.
- Keep routine execution administration in Activity; Ask retains the controls needed
  to complete its first-use/reviewed-submission journey without hidden side effects.
- Keep live announcements short and avoid timestamp-driven interruption.

Acceptance: all ten destinations and direct CTAs resolve to the right family; question,
definition and folder drafts survive navigation; empty/disabled/invalid/configured
states give truthful next actions; stale filters cannot hide the selected run; an older
active run cannot masquerade as newest activity; completed answers remain attributed.

Tests: focused Vue behaviour tests, updated central browser navigation helpers and
Council journeys; keyboard/axe and wide/narrow light/dark captures; pinned host journey.

## Increment B — workflow provenance and recovery

- Owner: `workflow_review` subagent. Own workflow application/domain/adapter files,
  workflow fields/composables and workflow tests; coordinate shared Council navigation.
- Distinguish host-confirmed pre-write preparation failures from uncertain admission.
- Retain confirmed receipt/run/source identities if persistence or cancellation fails.
- Persist the parent's stop boundary before awaiting external cancellation, preventing
  result consumption or later-step dispatch while stop is in progress.
- Capture/check the selected Council/team/CoWorkers and project-context identity at
  a documented boundary so later edits cannot silently reinterpret a started workflow.
- Expose live-execution readiness and unsupported simulation references before use.
- For this explicit Council action, offer all/selected/none context modes; retain the
  meaning of existing saved steps and never silently rewrite old notes.
- Preserve inspection links for completed, failed, cancelled and historical children.
- Make oversized-report recovery actionable while preserving complete canonical answers.
- Document the compatibility bridge to the existing Council v2 kernel; preserve legacy
  AI/manual/nudge semantics and explicit definition/version boundaries.

Acceptance: preparation errors can be repaired without duplicate-risk acknowledgement;
unknown outcomes still require it. Receipt-save failure retains the child. A deferred
cancel cannot race a handoff. Definition/prompt edits cannot silently retarget a run.
Exact context modes and child inspection survive save/reload/history. Rechecking an
unchanged held result does not churn durable revisions. No truncation or fabricated answer.

Tests: failing-first contract and orchestration tests with deferred ports/write failures;
editor tests; native setup/reload/cancellation evidence without billable providers.

## Increment C — qualification reliability

- Owner: `qualification` subagent. Own the in-memory Obsidian kit's seed metadata
  batching and its focused framework/product regressions.
- Confirmed defect: 10,000 seeded notes cause 50,005,000 metadata link-map visits
  because silent seed rebuilds all links per note. This precedes Council assertions.
- Batch only silent seed metadata parsing and rebuild links once at completion.
- Preserve immediately available seeded caches/forward/unresolved links, silent events,
  ordinary asynchronous writes, and every assertion and limit of the 10,000-note test.
- Keep the repository's test isolation, thresholds and CI gates unchanged.

Acceptance: the unchanged scale test passes reliably; new regressions prove exact seed
and normal-write semantics. No global toolchain modifications. Local version differences
are recorded; canonical CI uses the pinned Node/npm.

## Orchestration and integration

1. Capture a fresh baseline; complete the source/research audit and record decisions.
2. Dispatch A/B/C with separate file ownership. Each writes failing behavioural tests,
   implements its increment, runs only focused checks and reports real output.
3. Parent reviews each diff, integrates current main without discarding either change,
   reconciles BRIEF/design/view contracts and regenerates the view catalogue.
4. Conduct an independent subagent closeout review across the other lanes. Address
   concrete findings in one improvement/polishing batch, followed by confirmation.
5. Run one coordinated heavy local qualification sequence: check/verify:project,
   UI quality, gallery inspection, Council browser journeys, native journey and smoke.
   A longer local orchestration deadline may be used; assertions and test budgets stay.
6. Fill the PR template with exact output and untested scope. Open and attach a draft
   PR, label it `e2e`, and require pinned CI `check`, `ui`, and `real-obsidian` to pass
   on the exact final head. Resolve actionable review findings, mark ready and merge.
7. Verify the merge and report the delivered increment, PR, evidence and remaining limits.

## Boundaries

No new product family, personal vault access, billable provider calls, global installs,
automatic permission changes, releases or game/vault Git operations. No weakening gates,
accepting screenshot baselines, or treating an isolated pass as a green full suite.
Existing Markdown bytes, stable IDs, privacy, finite limits and final human code review
remain authoritative. Only the designated open desktop executes Council work.

## Evidence and closeout

Current-run baseline captured and inspected from the labelled synthetic example:
reports/council-next/01-before-navigation.png (ten peer destinations wrap at 1265px),
02-before-setup.png (permanent generic guidance despite a configured Council), and
03-before-activity.png (project summary followed by all-project/raw-ID filters).
Source/behavioural tests establish the scope/timestamp defects that empty screenshots
alone cannot prove.

Increment C: seed/scale product checks passed (2 files, 3 tests; unchanged10k case 464ms).
After the CRLF closeout, product CRLF/seed/scale checks passed (3 files, 7 tests; scale 538ms),
and focused kit metadata/vault checks passed (2 files, 11 tests). Product regressions
passed zero-warning ESLint. The four CRLF regressions were observed failing first.
Seed batching is committed as b7ae9b0; CRLF fidelity as 43f1681. No assertion, case size,
60-second test budget or test isolation setting changed.

Increment A source/behaviour handoff: broader Council suite 10 files / 26 passed;
IA/entry/readiness/drafts 4 files / 13 passed; lifecycle/scope/entry/readiness 5 files /
13 passed; deferred catalogue outcome matrix 3 passed. Three test-only Vue Test Utils
`get().exists()` type errors were corrected to `find().exists()`; focused entry/navigation
recheck passed (2 files / 5 tests). Existing route IDs and all draft/execution gates remain.

Increment B source/behaviour handoff: final workflow batch 8 files / 36 passed; core
reliability/legacy batch 4 files / 29 passed. Failure injection covers repeated receipt
writes, unknown cancellation marker writes, stop races, reload and metadata-only
acknowledgement after pending/completed code review. Independent subagent review
confirmed all previously reported source findings resolved before integrated visual QA.

The view catalogue initially had 95 authored contracts; navigation coverage validates and
the focused catalogue suite passed (1 file / 11 tests).

### Integrated visual/flow closeout batch

Accepted current-run captures: `10-integrated-navigation.png` shows the four primary
tasks; `11-integrated-setup.png` shows configured readiness consuming a full screen;
`12-integrated-answers.png` shows readable attributed answers; `13-integrated-run-controls.png`
shows run filters/controls below the long reader and the remaining raw-ID row title.

The single polish batch keeps compact configured readiness actions, reveals the editor
after explicit selection, gives the answer reader a return-to-runs path, keeps selected
active-run operations reachable before long answers, and finishes human row titles and
empty-state terminology. Unconfigured/loading/error guidance, scope and guards remain.

The first automated matrix is not accepted as qualification: one failure screenshot
served an older interface from another worktree on the hardcoded port. An optional
validated `COFORGE_E2E_PORT` now isolates local servers while keeping the default, all
assertions, workers, retries and time limits unchanged (commit 633823f; config sanity
4 valid/default and 12 invalid cases passed). The confirmation matrix uses a distinct
free loopback port. A separate 30-second long-journey timeout occurred during its fifth
Axe capture; phase visual cases will retain all themes, widths, tags and assertions
without weakening the timeout or the complete functional journey.

Remaining integrated/native results and CI/merge evidence for the final commit will
be recorded here. No failed or isolated run is reported as a green full gate.


### Final qualification in progress

Isolated browser confirmation: 36 passed in 9.4 minutes; typecheck and source lint
passed; design detector returned an empty finding list. Final native Council run:
3 files / 3 passed, including first-use setup and confirmed clean teardown. Native
identity/cleanup product checks: 14 passed; shutdown/lifecycle framework checks: 21 passed.

Integrated main through Service Design #43, preserving OBS/Twitch and Service Design
features, protected folder ownership and initialization. Combined catalogue: 108
contracts with valid navigation coverage. The interrupted pre-integration local check
is not counted; the full gate is restarted on the combined source.

### Final source closeout

Independent IA and workflow reviews resolved all actionable source findings.
Canonical request category/kind/Request Object and viewer attribution/text/time now
remain in Council context even with no earlier results; internal viewer IDs and
derived outputs stay excluded. The regression failed first, then 3 files / 28 tests
passed with zero-warning scoped ESLint. Final navigation-copy and Loading/Unavailable
contract corrections leave 108 valid view contracts. No design or gate weakening.

Combined-runtime smoke: status passed, errors [], hostErrorCount 0, pluginConsole [].
Fresh ui:gallery: 40 captures, zero capture failures; reviewed across themes/widths.
The pinned CI canonical verify:project and root installation passed on 8af7ccc.
Final exact-head check/ui/real-obsidian logs and merge outcome are retained on PR #44.
The PR remains gated on all three succeeding; source is frozen except qualification fixes.

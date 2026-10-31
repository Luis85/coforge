# Task: Restore workspace preferences and reuse workflow configuration

- Status: done (implementation and local qualification; GitHub delivery tracked in PR)
- Journey: Private studio layout, project workflow configuration and request execution.

## Why

Panel choices reset after reopening, startup automation cannot be configured,
saved CoWorkers/workflows cannot be reused conveniently in request workflows,
and per-feature execution is mixed into project configuration. Settings footers
also leave a visible strip of underlying content below their action surface.

## Traceability

Owner requests recorded in BRIEF.md (2026-10-31). No req-* or vi-* obligations
are declared in the current traceability files. Existing acceptance and host
contracts remain; no fabricated requirement IDs or TODO tests count as passing.

## Acceptance

1. Navigation/chat panel choices restore independently from localStorage, including
   explicit expanded chat at narrow widths. Defaults remain responsive and storage
   errors never break controls. No project writes or provider dispatch.
2. Each project explicitly saves Play/Paused startup behavior. Legacy projects
   start paused. Saving/copying does not immediately execute work, and recovery,
   permissions, human checkpoints and final review remain authoritative.
3. AI steps choose a CoWorker or manual profile. New runs resolve and capture the
   selected saved CoWorker; queued/active runs retain their exact profile/context.
   Missing/disabled definitions fail without fallback or extra capabilities.
4. Other projects' saved request workflows can become independent editable drafts;
   source notes/runs remain unchanged and project-scoped references need repair.
5. Request details own run execution/history; project workflow settings retains
   Step attempts, controls, configuration and Herdr administration.
   Its confirmed flat tab order is Idea Board Workflow → Step attempts →
   Timing & limits → Answer / output templates → Herdr, with shared pending
   workflow drafts across definition/timing panes and independent template saves.
6. Project/native settings footers are opaque and flush with the visible content
   bottom, above any host status bar, at supported pane sizes/themes.
7. Kanban context-menu Stop workflow returns the card to Inbox and persists an
   operator-only hold across reload/Play/triggered/API starts. Context-menu Restart
   workflow alone releases it and begins a new first-step run. Late results cannot
   move a held card; prior history, partial changes and explicit review/recovery
   remain available and authoritative.
8. Notifications throughout the plugin have a consistent icon/body/action layout,
   severity and accessible announcements. The feature attention notice has no
   expanded icon column; long messages and controls wrap without clipping.

## Implementation and review plan

- Agent 1: failing panel-persistence tests, localStorage helper, store wiring and
  real-host reload proof; then request run-history relocation with root oversight.
- Agent 2: startup preference, independent cross-project workflow-copy flow and
  durable Kanban Stop/Restart with preserved-work review.
- Agent 3: captured CoWorker assignment and manual configuration alternative.
- Root: owner decisions, integration contracts, footer geometry reproduction/fix,
  comprehensive improvement/polishing plan, test scheduling and release oversight.

When initial implementation is complete, record a separate comprehensive review
plan, delegate its increments, execute them end to end, and close with a bounded
polishing pass before the frozen-source full gate and GitHub qualification.

The core changes now have focused behavioral proof. The execution and closeout
plan is [the improvement and polishing plan](2026-10-31-workflow-polishing-plan.md).

## Qualification

Failing behavioral assertions first; focused tests per increment. Then typecheck,
lint, full product gate/build/embedding, UI quality and reviewed gallery, contained
Obsidian specs/reload, self-review and final head GitHub product/browser/host/security
checks. No personal-vault launch, billable provider test or live OBS/Twitch mutation.

## Evidence

Implementation and the delegated polishing increments are complete. Focused
product, browser and native evidence, independent review findings, first-failing
regressions and their repairs are recorded in the linked polishing plan.
UI quality passes all eight cases; the generated gallery has forty reviewed
captures. The whole native run passed 49/51 cases, and its two identified failures
were repaired and passed on a fresh candidate with their original assertions
retained and strengthened. The complete project gate and GitHub qualification
are tracked by the PR's final-head checks before merge.

Final local verify:project passed all five check stages (871.4s): 1536 product
tests passed, zero failed, six existing Windows/platform skips. Release build
and the embedding test passed. Contained Obsidian 1.14.4 smoke/reload passed with
errors [], hostErrorCount 0 and pluginConsole []. No vendor model was invoked.

Evidence stays under reports/ (including separate initial full-native and final
targeted reports); no screenshots were accepted as baselines. Live public-board
exports are unrelated local changes and remain outside this increment/its commits.

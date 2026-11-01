# Task: Show polishing progress on request cards

- Status: in progress
- Journey: Improve & polish a card's current result, with explicit human review.

## Why

A polishing pass can run in the background while its Kanban card still looks
unchanged. The board must make this work and its next review action visible.

## Traceability

Owner request recorded in BRIEF.md. The accepted scaffold's requirement and
interaction arrays are empty; no req-* or vi-* identifiers are invented.

## Acceptance

- Cards show an independent, labelled polishing state from saved auxiliary runs.
- Queued and running work are distinguishable; stopped/failed or uncertain work
  never claims to be running. A completed pending result advertises human review.
- Apply/Discard clears the indicator for that settled pass; history remains.
- A polishing job never replaces the primary workflow hint or changes its bucket,
  cursor, attempts or artifacts. Reload retains the saved state.
- Text and icons work in both themes and narrow cards; motion respects reduced
  motion. Navigation and observation never start a provider.
- Polishing uses the shared scheduler, worker and result/cost recording path.
  Replayed admission or results do not duplicate work or accounting. AI Costs
  includes genuine polishing usage and costs once under the correct project.
- Inbox's extra Add control and wrapping column labels/descriptions do not
  misalign the start of cards or empty states across board columns.

## Implementation and improvement plan

1. Subagent: add failing state/render tests, then implement a focused projection
   and a compact indicator using the existing card tokens and icon system.
2. Subagent: exercise rendered state transitions and narrow/wide layouts with
   synthetic browser fixtures. Independent subagent reviews lifecycle edge cases.
3. Subagent: prove shared execution and idempotency with engine-backed tests and
   verify polishing costs reach the existing AI Costs projection exactly once.
   Reproduce the reported Inbox alignment with browser geometry assertions and
   fix the shared row layout without clipping configurable column text.
4. Root: integrate findings, check layout/accessibility and run required project,
   UI gallery and contained Obsidian gates. Apply one bounded polishing pass.
5. Self-review and record actual results; qualify the PR before merging.

## Scope

Card feedback and shared-system/accounting correctness. No live provider
execution, user-run mutation, worker restart or installation into the live vault
during the user's test pass. Preserve existing authorization and review gates.

## Evidence

- State/render TDD began with six failing assertions. Focused state, rendered card
  and existing Design tests passed: 3 files / 16 tests. Typecheck and scoped ESLint
  passed; final source lint passed for 2,094 files.
- Shared execution/accounting: 4 files / 14 tests passed. Real WorkflowEngine,
  StudioStore and AICostService prove unpaid preview isolation, concurrent-confirm
  idempotency, automatic provider cost/usage recording, retained failure charges,
  and Claude/Codex background reconciliation across reload without duplicate
  launches, artifacts or cost rows. The existing backend already met these
  invariants; no parallel execution or accounting pipeline was introduced.
- Browser presentation: 2 cases passed (1.1m), light at 360px and dark at 1440px.
  All four visible execution/review states pass full-board Axe checks. Main
  history/bucket, Apply/Discard, reduced motion, 150% zoom, wrapped text and
  contained footer controls are covered.
- Inbox alignment reproduced as 15px drift before shared rows; final geometry
  asserts heading hints and content tops within 1px across all five columns.
  Visual review caught a separate 48.7px card overflow at 150% zoom. Bounding the
  section's inner grid track and its card list fixes it without clipping text.
- Real Obsidian 1.14.4: contained smoke passed with errors: [] and pluginConsole:
  []; final card presentation spec passed (1 file / 1 test, 26.07s), including
  both themes, every polishing state, card/column/footer bounds and Axe.
- Native qualification initially caught primary-button and avatar contrast
  failures. Board-scoped theme-aware button colors and readable avatar text
  resolved them; no accessibility rule or assertion was weakened.
- Final test:ui-quality: 8 passed (49.4s). Final ui:gallery: 40 captures, zero
  failures; representative light/wide and dark/narrow gallery views reviewed.
  Targeted board evidence was separately reviewed from browser and native captures
  under reports/polishing-card-feedback/ and reports/obsidian/cases/.
- Impeccable mechanical scan returned []; no dependency changes or image baseline
  updates. Its context loader reported legacy product metadata and no selected
  visual-build path; repairing design metadata is separate from this refinement.
- Full verify:project is running; record its final output before PR closeout.

## Untested scope

No paid provider execution, live user workflow mutation, multi-day soak or live
plugin reload. Provider telemetry is supplied through controlled ports; unknown
Codex USD remains unavailable while genuine usage is recorded. Native evidence
uses the pinned contained Obsidian host, not the user's running installation.

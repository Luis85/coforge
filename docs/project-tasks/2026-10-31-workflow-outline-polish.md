# Task: Make the bucket and step outline readable in Obsidian

- Status: done (implementation/local qualification; final PR checks and merge recorded on GitHub)
- Journey: configure Idea board buckets and their ordered steps.
- Traceability: owner screenshot/follow-up; the requirement/interaction scaffold has no entries.

## Problem and direction

The owner's native screenshot shows step numbers/names centered far from their
bucket headings, excessive vertical separation, weak nesting and a truncated
outline. The component needs a compact, consistently left-aligned hierarchy,
clear selection/actions and readable bucket metadata in the actual host.

Keep the saved process, stable identities, explicit save/recovery and execution
behavior. Refine this component within the native Obsidian visual system.

## Acceptance and implementation plan

1. Reproduce the screenshot as a real-Obsidian layout test with eight steps.
   Assert the actual left edges of number/name relative to the row, compact row
   geometry, no overflow, accessible controls and reachable scrolling/tools.
2. Use deliberate bucket headers with inline role/count context, tighter nested
   steps, consistent local indentation and selected actions aligned with content.
   Scope host-button layout resets to this outline so native styles cannot center
   or stretch its rows. Preserve names, accessible descriptions and existing controls.
3. Inspect light/dark and wide/narrow native captures together, repair concrete
   defects, then confirm. Run focused editor/long-list/browser regressions, UI
   quality/gallery, contained host smoke and the complete release gate.
4. Self-review, record real evidence and deliver through the established green-PR
   workflow. Coordinate the shared local install with the durable-build session.

## Evidence

- Real-Obsidian RED: eight-step fixture failed its number-inset assertion before
  the grid reset. The earlier checks verified text alignment but missed actual
  content positions under native button styling.
- Final native layout test: **1 passed (18.05s)**, covering light/dark at 1360px
  and 760px. Checks actual number/title insets, compact rows, ordinary bucket
  labels, one-line selected toolbar, keyboard return focus, no overflow, footer
  clearance and zero Axe WCAG A/AA findings. Four native panel captures reviewed.
- Native verification found a footer-binding timing issue; measurement now binds
  after the form footer mounts. Its observer/listener cleanup and wrapped-footer
  resizing are covered by a focused DOM test. Explicit Step list navigation brings
  the outline back to the top of the visible pane.
- `npm run verify:project`: **5 passed, 0 failed, 0 skipped in 1221.8s**; **1,580
  product tests passed**, zero failures/TODOs, six existing platform skips. Build
  and embedding passed. UI effects explicitly skip without visual definitions.
- After the final footer/viewport changes: **7 focused product tests passed**,
  including the new observer test; final typecheck and targeted zero-warning
  ESLint passed. Full GitHub qualification includes the newly added test.
- Final bucket/long-list browser regressions: **7 passed (1.7m)**. UI quality:
  **8 passed (1.1m)**. Gallery: **40 captures, failures []**, reviewed together
  with the native panel matrix. Screenshots remain ignored evidence.
- Final contained `dev:obsidian -- --json`: **status passed**, `errors: []`,
  `hostErrorCount: 0`, `pluginConsole: []`. Pinned Obsidian 1.14.4.
- Final Impeccable scan: **[]**. Token check passed (968 observed / 133 reviewed).
  Diff/line-limit/architecture/draft/privacy self-review passed. No baseline,
  accessibility rule or numeric threshold was weakened.
- Evidence: ignored `reports/workflow-buckets/outline-*`, `reports/ui-gallery/`,
  `reports/obsidian/` and `.obsidian-sandbox/logs/`. The durable-build session is
  isolated and the shared live install stays unchanged until this polish qualifies.
- Initial Linux native CI: 52/53 passed; the new density assertion caught an
  output label wrapping under Linux font metrics. Row typography and border resets
  are now explicit in the scoped native grid. The 68px density limit, alignment,
  overflow and accessibility assertions remain unchanged. Fresh local native
  matrix: **1 passed (17.74s)**; final-head Linux qualification follows on the PR.
- Full browser CI initially passed 229/231; the existing move/duplicate journeys
  caught the sticky size container collapsing its child layout after a reorder.
  Removed size containment in favor of natural header wrapping and clamped page
  scroll measurements to the visible viewport. The unchanged configuration,
  bucket, long-list and template journeys now pass locally: **14 passed (2.3m)**.
  The final native matrix also passed: **1 passed (15.77s)**. Original 68px row,
  alignment, toolbar, footer and Axe assertions remain intact.

## Untested scope

No billable provider, personal vault or live external service mutation was used.
Local Node/npm remain 24.20.0/11.21.1; GitHub uses the repository pins. Workflow
execution/persistence and mobile/alternate host versions are outside this polish.

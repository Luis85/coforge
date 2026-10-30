# Task: Design specification before Build

- Status: in progress (subagent improvement, qualification and PR merge)
- Journey: request → screen → score → plan → design → build → review in BRIEF.md.

## Acceptance

The standard workflow runs a distinct read-only AI Design step after Plan. Its
Markdown specification is retained and required alongside the plan by Build.
Design failure or missing/invalidated output holds Build and preserves prior work.
Saved custom workflows and captured runs retain their definitions. A Design preset
is available for explicit custom workflow edits. Planned requests appear in a
Design column before In progress in private and public boards; the public
projection excludes the private specification and execution instructions.

## Traceability

Owner decision, 2026-10-30, recorded in BRIEF.md. No imported req-* or vi-* IDs apply
(design/traceability.json has no requirements). Behavioral tests:
design-workflow.test.ts and design-board-ui.test.ts under the product test suite.

## Plan and evidence

1. Observed three failing behavioral assertions: no Design step/column and Build
   proceeded without attempting Design.
2. Extend the existing workflow contract/presets and board projections; retain
   existing execution, persistence and review gates.
3. Run product gates, UI quality/gallery, contained Obsidian smoke and self-review.

## Untested scope

Real model calls are outside automated qualification. Existing custom workflows
adopt Design only through an explicit editor save. Local Node 24.20.0 and npm
11.21.1 differ from the repository pins 24.21.0 and 11.19.1. No lifecycle or host
API changes were made, so the broader test:obsidian suite was not run.

## Initial increment evidence (before follow-through)

- `npm run verify:project`: exit 0, including `npm run check` and artifact checks.
  `check: ok`; `Summary 5 passed, 0 failed, 0 skipped in 566.8s`.
  Product report: 1,344 tests passed, 6 existing skips, zero failures. Production
  build passed; prototype embedding: 1 passed. The existing `test:ui-effects`
  command explicitly skips because no visual definitions are declared.
- The first complete full gate exposed three fixtures assuming four steps. Updated
  their expected inputs/order/counts without weakening validation. Targeted rerun:
  3 files, 5 passed, including real Git worktree tools that deny writes during both
  Plan and Design. The full rerun above then passed.
- Latest Design tests: 2 files, 6 passed; the subsequent stopped-run label regression
  also passed (1 file, 5 tests). Covers persistence, private export exclusion,
  required specification, failure holds, preset and maximum-length custom prompts.
- `npm run test:ui-quality`: 8 passed. Affected workflow editor and board spacing
  journeys: 5 passed. Design board accessibility/layout journey: 2 passed, with
  1920px/720px panes in light and dark themes.
- `npm run ui:gallery`: 40 captures, zero failures; reviewed gallery captures and
  target-specific `reports/design-step/board-{light,dark}-{1920,720}.png` evidence.
- `npm run -s dev:obsidian -- --allow-download --json`, then the provisioned smoke
  without downloads: `status: passed`, `errors: []`, `hostErrorCount: 0`,
  `pluginConsole: []`; Obsidian 1.14.4, launcher 3.2.1. Reviewed screenshot, dev log
  and debug report; contained host shut down cleanly. No personal vault was opened.
- Mechanical UI detector: `[]`. Scoped ESLint: exit 0, zero warnings. Task-scoped
  `git diff --check`: clean; pre-existing public export edits remain untouched.
- Self-review completed and `.github/pull_request_template.md` filled with evidence.
  No generated traceability changes, screenshot baselines, pushes or deployments.

## Optional design-tool upkeep

Impeccable reported older PRODUCT.md metadata and an unset visual build preference.
Its optional `init` workflow can refresh the metadata; a future design pass can
choose code-first or comp-first. No tooling metadata was changed for this task.

## Subagent improvement and polishing follow-through

Owner authorization: 2026-10-30, review/improve with subagents, push, open a PR,
bring all required checks to green, then merge. Work is on
`codex/kanban-design-step`; the two pre-existing CoForge/Public data edits stay out
of the commit.

Independent reviews cover workflow/contracts/providers, UI/UX/accessibility and
release qualification. Concrete findings and the planned corrections:

1. A later generic Markdown or Council report could replace the specification
   supplied to Build. Add a separate Design semantic output while keeping its
   bounded Markdown payload. Preserve saved generic Markdown definitions and
   captured runs. Require the typed Design artifact so invalidation cannot be
   hidden by a generic report; retain read-only provider permissions.
2. Design preset adoption appended after Build and could omit Design from explicit
   Build inputs. Insert it before an eligible Build and bind the specification in
   the editor draft, preserving existing IDs, order, prior inputs and explicit save.
3. The request drawer did not expose the specification. Add a private Plan & Design
   reader/copy action using only current valid artifacts; exclude invalidated,
   altered and older-request artifacts.
4. Simulation produced only generic notes. Give it an honestly illustrative
   specification grounded in the captured request/plan, without claims of repository
   inspection or executed tests.
5. Qualify actual persistence, reload, drawer reading and Build input binding in a
   contained native Design workflow test. Exercise all six input roles and bounded
   provider output/retry paths. Run complete e2e-labelled GitHub jobs (check, ui,
   real-obsidian) on the exact PR head before an exact-head guarded merge.

Follow-through source is frozen after independent closeout. The optional-context
edge found during review is corrected by keeping selected inputs required while
including other earlier results only when present. Native persistence/reload/body
and exact Build binding: 1 passed. Drawer browser confirmation: 2 passed in both
themes with 1280/360px captures and WCAG scans. UI quality: 8 passed. View catalogue:
111 valid/current. Final integrated local and GitHub qualification and PR link: pending.

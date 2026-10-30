## Summary

Add Design between Plan and Build in the standard request workflow and Kanban.
Design retains a private, bounded Markdown specification with read-only project
access. Build requires the plan and the semantic Design result, so a later Council
or Markdown report cannot replace the specification. Invalidated Design holds Build.

Adopting the Design preset inserts it before the first Build with an earlier Plan
and binds its required result in the editor draft. Existing required inputs and
optional earlier context are preserved; optional host captures remain optional.
Saved custom workflows and captured runs retain their definitions and explicit-save
boundaries. Build keeps isolated worktree access and mandatory streamer review.

The private Plan & Design drawer reads/copies only current, successful, intact
specifications and links to workflow evidence. Simulation produces an explicitly
illustrative plan-grounded specification. Polish improves narrow heading wrapping
and the Demo label contrast, with no new public/private data exposure.

## Requirements and traceability

- Owner Design step decision and subagent follow-through authorization, 2026-10-30,
  recorded in BRIEF.md and docs/project-tasks/2026-10-30-kanban-design-step.md.
- No imported req-* or vi-* obligation applies; generated traceability stays unchanged.
- Independent workflow, UI and release reviews completed. Final closeout found no
  production blockers after correcting optional-context adoption.

## Validation

- Core workflow/provider/MCP/v2 batch: 9 files / 34 passed; latest Design regressions
  9 passed. Optional prior-results regressions: 4 files / 34 passed, including absent
  and present host captures, required Design invalidation and reload compatibility.
- UI/editor/drawer tests: 5 files / 17 passed; omitted/empty adoption cases: 4 passed.
- Scoped typecheck and ESLint: exit 0; zero lint warnings.
- npm run test:ui-quality: 8 passed, both themes, reflow and keyboard focus.
- Focused Design drawer browser journey: 2 passed, Simulation through Design,
  private reading, narrow/wide containment and WCAG scans in light and dark.
- npm run check:views: 111 views, valid navigation coverage, current sitemap.
- npm run verify:project: final integrated run in progress; no pass claimed yet.
- Full GitHub check/ui/real-obsidian qualification will run with the e2e label.

## UI evidence

- Drawer captures inspected: reports/design-step/specification-{light,dark}-{1280,360}.png.
- Board captures: reports/design-step/board-{light,dark}-{1920,720}.png.
- Fresh npm run ui:gallery: in progress. No screenshot baselines changed or accepted.
- Mechanical detector over follow-through UI targets: [].

## Obsidian evidence

- npm run test:obsidian -- coforge-design-workflow: 1 passed in 41.4s. The case saves
  the definition, reloads, runs Simulation through Design, reads the private drawer,
  reloads again and verifies exact Design retention, original body bytes and Build
  input artifact IDs. Build remains awaiting human review.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; Obsidian 1.14.4 / launcher 3.2.1, contained sandbox only.
- Evidence: reports/obsidian/cases/ and .obsidian-sandbox/logs/; host teardown confirmed.

## Untested scope

No billable Claude/Herdr invocation or personal vault was used. Native provider
profiles and bounded output/retry paths use synthetic transport fixtures; real
Git worktree/file tools are covered separately. Local Node 24.20.0/npm 11.21.1 differ
from pins 24.21.0/11.19.1; GitHub qualification uses the pins. The two pre-existing
CoForge/Public data-file edits are excluded from this PR. No game/vault publication
or automatic acceptance of a generated game increment is part of this change.

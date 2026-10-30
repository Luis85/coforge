# Task: Choose visible feature groups per project

- Status: implemented; full shared-tree qualification failed during concurrent edits
- Journey in BRIEF.md: project-specific workspace configuration (2026-10-30 decision).

## Why

Projects that do not need streaming should not carry stream navigation and panels.
The owner chose presentation preferences while shared services keep running.

## Traceability

- No requirement or interaction IDs are declared in design/traceability.json.
- Acceptance: project-feature-groups.test.ts and project-feature-groups-ui.test.ts.

## Acceptance

- Explicitly save Build & Improve, Stream, Community and Insights visibility per
  canonical project note. Missing preferences retain all groups; an empty selection
  is valid. Project switcher and settings remain reachable.
- Switching/reloading restores each project's selection. Hidden Stream removes
  the board chat, chat toggle, stream profile and live dock without losing drafts.
- Hidden destinations resolve to an enabled destination or settings; existing
  unsaved-setting guards remain authoritative.
- Invalid input, stale saves and failed writes do not change committed choices.
- Selecting groups does not stop shared services, delete data or dispatch work.

## Plan

1. Failing service, note and rendered UI assertions.
2. Validated project-note preference, settings draft and shell projection.
3. Full project, UI quality/gallery and contained Obsidian verification; self-review.

## Evidence

- TDD red: 2 files / 4 failed for missing controls and unsupported featureGroups.
- Feature service tests: 3 passed; rendered UI: 2 passed. Invalid input, stale
  configuration, failed writes and an active run completing after hiding all
  groups are covered.
- Typecheck and scoped ESLint: exit 0. Full check typecheck, source lint, ESLint
  and maker types passed.
- Final current-tree focused batch: 4 files / 13 passed (19.60s). Final typecheck
  retry encountered four concurrent schedule-music.test.ts errors: missing
  removed adapter, enabled/music properties and an implicit parameter type.
- npm run test:ui-quality: 8 passed (55.5s).
- Targeted browser journey: 2 passed (39.9s), both themes, keyboard, explicit
  save, 1280/480px widths and WCAG scans. Reviewed captures under
  reports/project-feature-groups/; labels/help wrap without overflow.
- npm run ui:gallery: 40 captures, failures []; representative light/wide and
  dark/narrow captures reviewed. Impeccable detector: [].
- npm run test:obsidian -- coforge-project-features: 1 passed (9.90s), canonical
  note reload, unknown frontmatter and exact body preservation. Teardown complete.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []. Dev session ended (complete).
- npm run check:views: 111 views documented, valid coverage, current sitemap.
- npm run verify:project -- --timeout 3600000: failed in product tests;
  349 files passed / 7 failed; 1362 tests passed / 3 failed / 6 skipped.
  Music-removal files were edited/deleted concurrently during the run, yielding
  missing test modules, INVALID_LOG_CATALOG imports and playlist/legacy schedule
  failures. Full evidence: reports/project-feature-full-gate.json.
- npm run verify:artifacts: exit 0; build complete, prototype embedding 1 passed;
  generated UI-effects skipped (no visual definitions).
- Self-review complete; .github/pull_request_template.md records real evidence.

## Untested scope

Full shared-tree qualification remains pending concurrent music removal and show
plan work. No unrelated changes or failing tests were modified. No live external
mutation, personal vault, billable provider, publication or push. Local Node/npm
are 24.20.0/11.21.1 versus pins 24.21.0/11.19.1; dependencies unchanged.

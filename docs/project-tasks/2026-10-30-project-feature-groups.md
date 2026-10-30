# Task: Choose visible feature groups per project

- Status: implemented; release qualification tracked in https://github.com/Luis85/coforge/pull/50
- Journey in BRIEF.md: project-specific workspace configuration (2026-10-30 decision).

## Why

Projects that do not need streaming should not carry stream navigation and panels.
The owner chose presentation preferences while shared services keep running.

## Traceability

No req-* or vi-* IDs are declared in design/traceability.json. Behavioural tests
are project-feature-groups.test.ts and project-feature-groups-ui.test.ts, with
browser and real-host journeys.

## Acceptance

- Save Build & Improve, Stream, Community and Insights visibility per canonical
  project note. Missing preferences show all groups; an empty selection is valid.
- Project settings and the switcher remain reachable. Hidden destinations resolve
  to an available area, preserving unsaved-setting guards.
- Switching/reloading restores the selection. Hiding Stream removes board chat,
  its toggle, stream profile and live dock while preserving chat drafts.
- Invalid input, stale saves and failed writes keep committed choices unchanged.
- Workspace selection never stops shared services or active agent work.
- Existing project IDs, unrelated frontmatter and exact Markdown body are preserved.

## Evidence

- TDD red: 2 files / 4 failed for missing controls and unsupported featureGroups.
- Focused service/UI/privacy/navigation tests: 4 files / 13 passed.
- Fresh isolated browser/UI-quality batch: 10 passed (1.7m), both themes,
  narrow/wide layouts, keyboard controls and WCAG scans.
- Fresh contained Obsidian test: 1 passed (11.72s), canonical-note reload and
  exact human note preservation. Teardown stopped the host and removed scratch.
- Fresh dev:obsidian -- --json --port 9236: status passed, errors [],
  hostErrorCount 0, pluginConsole []; pinned Obsidian 1.14.4 / launcher 3.2.1.
- check:views: 111 views documented; navigation coverage valid; sitemap current.
- Scope review and git diff --check passed. No generated traceability, dependency
  versions, checks, thresholds or screenshot baselines were changed.
- Runtime candidate: 89bcea51fe6e5812b2c0e949b78fa3d77a54b097. Full local
  verify:project and final-head GitHub check/ui/real-obsidian results are recorded
  in PR #50 before merge. The e2e label enables complete browser and host suites.

## Scope and limitations

The release branch is isolated from concurrent music/OBS work in the original
checkout. No personal vault, live Twitch/OBS mutation or billable provider was
used. Local Node/npm are 24.20.0/11.21.1; GitHub uses pins 24.21.0/11.19.1.
Shared runtime configuration remains authoritative; these are visibility choices.

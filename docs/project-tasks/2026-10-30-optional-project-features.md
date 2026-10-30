# Task: Select individual optional project features

- Status: implemented; full qualification and final-head evidence tracked in the pull request
- Journey: project workspace configuration in BRIEF.md, 2026-10-30.
- Traceability: no req-* or vi-* IDs are declared in design/traceability.json.

## Inventory and boundary

| Group | Optional features |
| --- | --- |
| Build & Improve | Idea board, The Council, CoWorkers, Service Design, Agent workflow |
| Stream | Stream studio, Alerts, Schedule, Stream chat, Twitch operations |
| Community | Community, Viewers, Economy, Community settings |
| Insights | Statistics, AI costs, Finances, Operations |

These 18 standalone destinations can be hidden independently. Internal tabs,
editors and providers stay part of their owning feature: for example Herdr and
output templates belong to Agent workflow; scenes/show plans belong to Stream
studio. Project settings, the switcher, integration setup and retained-work
recovery stay available. Shared and vault data keep their actual scope.

## Acceptance

- Select individual features beneath the existing four group controls, with
  descriptions and honest selected counts. Group hiding retains child choices.
- Persist validated choices in canonical project frontmatter. Missing choices
  show existing features; [] is valid. Preserve note identity, unknown properties
  and exact human body bytes. Failed/stale saves retain the draft.
- Navigation, settings subpages, chat/live panels and feature launch shortcuts
  follow the saved project choices. Settings and the switcher remain reachable
  with no features selected; safe fallback preserves dirty configuration guards.
- No selection stops shared services, changes public projections, deletes data
  or reconfigures/reruns captured work. Cancellation and final human review remain.

## Plan

1. Failing service and rendered acceptance tests, including each optional route.
2. Typed feature catalogue, canonical preference, draft/editor and UI projections.
3. Browser themes/reflow/keyboard, contained Obsidian reload and full qualification.
4. Self-review and real evidence; follow the authorized PR/check/merge workflow.

## Evidence

- TDD red: 21 failed / 1 passed. Missing individual controls and rejected features
  input fail for the intended behavior. A separate shortcut regression failed
  before hiding Council/workflow launch actions.
- Initial green: 4 files / 28 passed. The added dirty-workflow regression passed
  in a later 2-file / 7-test batch; unsaved workflow UI remains mounted until resolved.
- Browser/UI-quality batch: 10 passed (1.3m), light/dark, 1280/480px feature
  catalogue, keyboard group toggle, exact saved choices, reflow and WCAG scans.
  Extended child-keyboard assertion is included in final-head CI.
- Real Obsidian: 1 passed (9.69s), Service Design and group preferences survive
  reload, unrelated frontmatter and exact human Markdown body bytes remain.
- Dev loop: status passed, errors [], hostErrorCount 0, pluginConsole [];
  Obsidian 1.14.4 / launcher 3.2.1. Contained host teardown completed.
- After current-main integration: browser/UI quality 10 passed (1.4m); real host
  1 passed (9.43s); docs:views reports 108 views with valid coverage/current sitemap.
- Full CI exposed an invalid Community settings binding. Added direct Economy
  shortcut visibility coverage and corrected the composable binding. Latest
  catalogue/UI/operator regression batch: 4 files / 34 passed; standalone typecheck
  exit 0. Fallback order also has a failing-then-passing regression.
- Impeccable detector: []. Reviewed light/wide and dark/narrow catalogue captures;
  descriptions wrap, counts remain visible, disabled child choices stay readable.
- Full local check uses the supported --timeout 3600000 orchestration budget;
  individual test limits and all quality gates are unchanged. Final local, artifact
  and GitHub check/ui/real-obsidian results are recorded in the PR before merge.

## Untested scope

No personal vault, live Twitch/OBS mutation, billable provider or public-site
publication. Preferences do not alter runtime permissions or public projections.
Local Node/npm are 24.20.0/11.21.1; CI uses pins 24.21.0/11.19.1.

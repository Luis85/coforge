# Task: Make every request-detail tab clear and usable

- Status: done
- Journey in `BRIEF.md`: request → workflow → implementation → mandatory review.

## Why

The owner asked for an equal overhaul of all seven tabs, with a subagent-driven review and a dedicated improvement and polishing pass. Current tabs hide their purpose, split related tasks and compete with secondary evidence.

## Traceability

- `design/traceability.json` declares no requirement keys or pending interactions. This task implements the owner's UI request; no invented req/vi IDs.
- Existing request workflow, increment review, session and cost acceptance contracts remain authoritative.

## Acceptance

- All seven sections keep stable internal destinations and clearly explain their purpose.
- A consistent workspace provides compact request identity, visible navigation, readable evidence and reachable actions in wide and narrow/short panes.
- Overview leads with the request; workflow leads with execution; Increment leads with changes and verification; Activity makes captured conversations discoverable.
- Navigation never starts work, loses unsaved Overview drafts or reuses another tab's scroll position. Read-only sections keep their boundaries.
- Final review stays explicit in Increment; other sections route to that task. Errors, provenance, unknown costs and recovery evidence remain available.

## Plan

1. Capture every current tab; independent IA and accessibility subagents review source and screenshots.
2. Add focused behavioral regressions for navigation, drafts, focus and narrow layouts; implement within product components/composables/styles.
3. Run check, UI quality/gallery, targeted journeys, Obsidian verification and verify:project. Independent finishing review, one correction batch and qualification.

## Out of scope

Provider dispatch semantics, canonical notes, cost accounting, workflow permissions and public projections.

## Evidence

- `node bin/app status`: status ok; dependencies installed; 0 acceptance obligations pending.
- Before screenshots: `reports/request-panel/before/01-overview.png` through `07-activity.png` (current synthetic preview; AI costs ledger unavailable in preview).
- Initial `npm run build:clickdummy`: refused existing output (`PROTOTYPE_OUTPUT_EXISTS`); dedicated loopback review server rebuilt with explicit `--replace` successfully.
- Independent IA and accessibility reviews informed all seven sections; a fresh finishing reviewer found one material defect (review-note errors above the evidence). A test first failed for the missing local alert; the correction was recaptured and scored resolved.
- Focused product batch: 4 files / 23 tests passed. The correction browser batch: 7 passed, including all sections across both themes and 1280×900, 480×600 and 360×600 panes, plus local validation visibility.
- Earlier browser qualification: 14 passed, including existing Design, AI costs, workflow navigation and layout journeys. All 14 desktop section/theme axe scans had zero violations.
- `npm run test:ui-quality`: 8 passed (3.1m). `npm run ui:gallery`: 40 captures; index and contact sheet reviewed. Gallery states are synthetic; bounded detail evidence is in `reports/request-panel/after/`.
- `npm run typecheck`: final-source exit 0. View catalogue: 112 views documented; navigation coverage valid; sitemap current. Mechanical design detector: `[]`.
- Contained smoke: `npm run -s dev:obsidian -- --json --port 9338`: passed, `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`; pinned Obsidian 1.14.4 / launcher 3.2.1; screenshot/log/debug report inspected.
- Native qualification: `npm run test:obsidian -- coforge-workflow-detail-navigation coforge-increment-review coforge-card-sessions coforge-request-cost-failure`: 4 files / 4 tests passed (144.44s), including clean teardown. Earlier cleanup timeouts and the fixture tab-order expectation are recorded in the logs. No timeout, assertion or host guard was weakened.
- Final-source contained smoke repeated successfully with `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`. Final-source typecheck and the ESLint correction passed; draft/validation regression repeated: 2 passed.
- Final narrow-spacing confirmation: 9 browser checks passed; additional native Request Object test passed with its existing 8px gap assertion retained. Retained Sessions/cost product tests: 2 files / 8 passed.
- `npm run verify:project`: failed. Its initial lint result captured the later-fixed unused KeepAlive import. Its product-test step timed out at 1,800 seconds, reporting native resource-materialization (90-second) and MCP discovery (5-second) failures in unchanged paths. Full repository qualification is incomplete; an isolated failure rerun is being recorded.
- `npm run verify:artifacts`: passed separately, including the production build and 1 embedding test. The repository explicitly skips UI-effect checks because no visual definitions are declared.
- The isolated native materialization/MCP rerun passed: 2 files / 11 tests (369.72s). Doctor found the system Node 24.20.0 differed from `.nvmrc` (24.21.0); npm was also newer than packageManager's exact 11.19.1. Portable pinned Node/npm were fetched from their official distribution/registry, verified against SHA-256 / SHA-512 integrity, and kept under ignored `reports/request-panel/toolchain/`. No global installation or dependency/lockfile change. Doctor passes on Node 24.21.0 / npm 11.19.1.
- Pinned-toolchain `npm run verify:project` exited 1: typecheck, source lint, zero-warning ESLint and maker types passed; the product step hit its 1,800-second limit. Its partial output reports 10 failures across unchanged native materialization, durable-worker client/read/recovery, background-retry boundary and MCP-command test paths. Summary: 4 gates passed, 1 failed, 0 skipped in 2566.1s. Exact output: `reports/request-panel/verify-qualified.log`. No test-result cache, assertion, isolation or timeout change.
- Final focused UI batch on pinned Node/npm: 6 files / 31 tests passed (21.47s). Final pinned `npm run verify:artifacts`: production build and 1 embedding test passed; the explicit no-visual-definitions UI-effect skip remains labelled.
- Temporary review browser and loopback server stopped. Evidence/build files remain ignored. No publishing or remote Git mutation requested.

## Untested scope

The UI implementation, independent polish review and full repository qualification are complete. The follow-up [worker/recovery repair](2026-11-01-worker-recovery-verification.md) resolved the original blockers and the later aggregate provider timeout. Final `npm run verify:project` exited 0: all five gates, the production build and embedding test passed; 568 product files, 2294 tests passed, zero failures and six existing Windows-inapplicable skips. Current output: `reports/verification-repair/verify-project-final.log`.

Live providers, real billing and the remaining native suites are outside this validation. The final repair also passed 3 targeted host lifecycle/MCP tests, a clean smoke test, 8 UI-quality checks and a reviewed 40-capture gallery.

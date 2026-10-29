# Task: Create and operate a complete OBS studio from CoForge

- Status: implemented; final qualification and merge evidence are tracked in
  [PR #40](https://github.com/Luis85/coforge/pull/40).
- Journey in BRIEF.md: OBS overhaul, one PC and a fresh blank OBS installation.
- Owner authorization: all three increments, subagent implementation, E2E,
  improvement/polishing, pull request and merge when required checks are green.

## Why

The streamer needs to prepare and run the show from CoForge. Current stream and
scene controls leave audio, source authoring, layouts, recording and show execution
in OBS, interrupting the community-development workflow.

## Traceability

- Owner requirement: docs/requirements/OBS Studio Integration.md (pbl-id 6).
- design/traceability.json has no imported req-* or vi-* obligations; no generated
  implementation status is claimed. Product acceptance tests live under
  src/plugin/tests/project/coforge; native journeys under tooling/tests/obsidian.

## Acceptance

- Fresh setup previews supported starter scenes/sources, audio and output settings;
  explicit apply persists intent before effects, preserves unrelated OBS content,
  reports partial results and never starts a broadcast.
- Source/device, transform/layer, audio/filter, studio preview/transition,
  recording/replay and virtual-camera controls use connected capabilities and
  current identities. Unsupported controls explain their limits.
- Program/preview screenshots show their observation time and sampled nature;
  disconnected or stale data never appears current. Private controls are not a
  public display source.
- Show definitions survive reload. Manual cues retain per-step outcomes; opted-in
  event automation pauses on reload and skips missed events. Unknown or partially
  committed effects block replay until reviewed recovery.
- Existing stream/scene controls share admission and recovery with new controls.
  Secrets and raw OBS settings never enter diagnostics or public projections.
- Public displays composes approved public requests, accepted work, recognition,
  now-playing metadata and fixed reviewed Council excerpts into an exact OBS Text
  target after captured preview/confirmation. Show cues can refresh saved mappings;
  revoked content cannot publish, owned text clearing preserves external edits,
  and unresolved external copies are explicit rather than silently claimed revoked.
- Wide/narrow and light/dark native-theme views remain accessible; interaction,
  recovery, persistence and host lifecycle tests provide real evidence.

## Plan

1. Three subagents implement typed native controls, application setup/show services
   and the focused studio UI, with failing behavioral tests before implementation.
2. Integrate shared admission, persistence, runtime start/disposal, private/public
   boundaries and persistent stream status.
3. Qualify protocol/product tests, UI-quality/gallery and contained Obsidian
   journeys. Independently review reliability/privacy/UX and fix/polish findings.
4. Update component contracts and operator documentation. Run full verification,
   open an E2E-labelled PR, reconcile current main, qualify CI and merge when green.

## Boundaries

No public broadcast or real account write during agent QA. The installed OBS
server must be bootstrapped once; OS permissions/vendor device dialogs are guided
exceptions. A smooth audiovisual transport is not fabricated from screenshots.
No universal third-party plugin editor, global installation or personal vault access.

## Evidence

- Initial node bin/app status: ok; dependencies missing; 0 pending obligations.
- npm ci: 691 packages installed; audit found 0 vulnerabilities.
- Toolchain provisioning: no official win32-x64 Node 24.21.0 build found; local
  Node 24.20.0/npm 11.19.0 differ from the pins. Pinned Chromium r1248 is ready.
- Application regression suites: 25 tests passed across four files.
- Native adapter/overlay regression suites: 35 tests passed; the additional public
  text/control-character suite passed 17 tests. Final audio suites passed 12 tests,
  including milliseconds, dedicated-page refresh, disconnection and preserved drafts.
- Focused UI suites: three files, six tests passed before the final audio regressions.
- Contained Obsidian: production case passed in 23.28s; reviewed-overlay case passed
  in 38.808s with no plugin errors and clean teardown. Both use a real loopback
  simulated OBS server, never a public broadcast.
- Connected visual review: 18 desktop/light/dark/narrow captures, all reviewed;
  final maximum horizontal overflow is 0px. Fixed a 234px narrow text-preview
  overflow without changing the assertion or baseline.
- `npm run test:ui-quality`: initial eight checks passed. Later local attempts
  hit the unchanged 120-second web-server startup limit under Windows load; final
  complete browser/accessibility qualification is mandatory in PR #40 CI.
- `npm run ui:gallery`: 40 captures in `reports/ui-gallery/`; representative studio
  captures reviewed alongside the connected host evidence.
- Owned host shutdown/lifecycle/dev-session tests: 21 passed. Shutdown now ends
  the tracked host tree before closing CDP, waits for inherited pipe closure and
  retains all scratch/PID guards; no cleanup retry budget was increased.
- `node tooling/quality/lint-source.mjs`: passed after the public-text guard fix.
  Source-size/locale checks and view-catalogue navigation coverage passed.
- Impeccable mechanical detector: `[]`, exit 0. No screenshot baselines changed.
- Local full `verify:project` attempts encountered the unchanged 600-second
  ESLint/product-test limits under Windows resource contention. Typecheck, lint
  and maker-types passed in the last local full attempt; final pinned CI, including
  the complete product tests, artifact build, browser and native suites, is the
  qualification authority linked above. Intermediate red tests were fixed and
  rerun as focused regressions; local timeouts are not reported as passing.

## Untested scope

Live OBS hardware, real stream-service credentials and public broadcast outcomes
require streamer-operated acceptance; fake-server/native-host QA will be identified.

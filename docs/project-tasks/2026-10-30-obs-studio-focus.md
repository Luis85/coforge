# Task: Focus Stream studio on stream, scene and show operation

- Status: implemented; release qualification is recorded in the pull request checks
- Journey in BRIEF.md: OBS scope correction and Show plans; owner authorized
  removal of obsolete UI, push, PR, qualification and merge when green.

## Why

CoForge duplicates OBS preview, audio and device/output setup work. The operator
needs stream controls, scene management and a reliable show rundown instead.

## Traceability

- docs/requirements/OBS Studio Integration.md (pbl-id 6).
- design/traceability.json declares no imported req-* or vi-* obligations.
- Includes the earlier Show plan polish described in
  2026-10-30-show-plan-polish.md. That file's preliminary evidence came from the
  shared checkout; final isolated-checkout and PR evidence is recorded here.

## Acceptance

- Broadcast and Show plan are the first two tabs. Connection/readiness, Scenes,
  public displays and history remain; obsolete audio/source-layout tabs disappear.
- The live page has explicit stream controls and observed health/audience, with
  no program/preview monitors, mixer, Studio Mode or standalone output controls.
- Setup keeps connection/authentication and go-live/BRB assignments. Device,
  source-property, audio and output configuration remain in OBS.
- Removed views do not fetch screenshots or audio meter samples. Read-only
  production inspection still enables existing Show cues and public text mappings.
- Show drafts, private notes, canonical definitions and finite saved action kinds
  keep their existing behavior, including explicit execution/recovery and no replay.
- Scene CRUD, switching, membership/order/visibility, public mapping policy and
  quick BRB/resume remain covered by behavioral and contained-host tests.

## Plan

1. UI subagent writes regression assertions and removes obsolete surfaces/helpers.
2. Host subagent adapts real-Obsidian and browser journeys to retained workflows.
3. Independent subagent reviews runtime boundaries and full-gate environment.
4. Root integrates documentation, self-reviews, runs required checks, reviews
   screenshots, pushes an isolated branch, labels the PR for E2E, fixes CI and
   merges only the qualified head.

## Out of scope

Deleting stored OBS/show data or native action contracts; real broadcasts or
account mutations; unrelated project-feature visibility and local-music changes.

## Evidence

- Clean managed worktree at origin/main 066098d, branch codex/obs-stream-studio.
  Only earlier Show plan work was transferred; concurrent project/music edits
  remain outside this branch.
- npm ci: added 691 packages; audit found 0 vulnerabilities. Node 24.20.0 differs
  from the 24.21.0 pin; CI uses the pinned toolchain. No lockfile changes.
- Removed obsolete SFCs and exclusive UI helpers/styles; retained native action
  contracts, restart-review recovery, scene item IDs and explicit target refresh.
  Production context reads occur on demand, never on a timer or the live page.
- Removal/session TDD: 3 failed before implementation; 5 files / 13 passed after.
  Final notice/watch/dock regression: 2 files / 2 passed (6.61s). Meter handshake
  red 1 failed / 6 passed; final protocol/adapter/session 3 files / 17 passed.
- Final polish: duplicate metric-strip regression red 1 failed / 2 passed; green
  3 passed (5.21s). Existing live monitor retains viewers, chat and OBS health.
  Guidance names OBS explicitly. Prepared Go-live contrast initially failed all
  four variants (3.42 light, 4.25 dark); scoped primary styles fixed it.
- Final native: 3 files / 3 passed (41.16s), after 9.06s build. Production
  14.102s, Show 13.300s, public overlay 10.826s. Covers stream/scene CRUD, saved cue
  execution, privacy revocation and reload without replay; no screenshots/meter
  subscription and no repeated audio setting reads on Broadcast.
- Broadcast and Show captures reviewed at 1280/480 in light/dark. Eight variant
  WCAG scans plus on-air/draft checks have violations []; overflow 0. Broadcast
  scans include enabled Go live. Public overlay captures also have overflow 0;
  their helper does not claim an accessibility scan.
- Browser navigation/draft regression: 1 passed (49.0s test, 1.1m total).
  Final npm run test:ui-quality: 8 passed (58.7s).
- Scoped ESLint with --max-warnings 0 and git diff --check: exit 0.
  Impeccable detector on final retained components/styles: [].
- npm run ui:gallery: exit 0, 40 captures, failures []; representative light
  desktop/dark narrow captures reviewed. Source remained frozen during capture.
- Integrated published main 1c15511 before final full verification. Only the PR
  template conflicted; it retains this change's evidence. No unrelated local work
  was copied. Catalogue: 109 views; navigation valid; sitemap current.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned app 1.14.4 / launcher 3.2.1. Read screenshot, dev.log
  and debug-report.json; session ended complete.
- npm run verify:project: local exit 1 solely from the 601.2s product-test process
  timeout. Typecheck 66.2s, source lint 9.8s, ESLint 284.1s and maker types 14.8s
  passed. Summary: 4 passed, 1 failed, 0 skipped (976.1s). No assertion failure
  appeared in captured output. An isolated NODE_COMPILE_CACHE and 8GB compiler
  heap were used; no test, isolation, timeout, lint rule or threshold was changed.
- Separate npm run verify:artifacts: exit 0; production build and embedding
  1 passed / 0 failed. Generated UI-effect checks are not applicable because this
  project declares no visual definitions.
- Exact logs: .obsidian-sandbox/obs-focus-verify.log, obs-focus-artifacts.log,
  obs-focus-dev.json.log, lean-obs-native-final.log and lean-obs-ui-quality-final.log.
- Pinned canonical CI, full browser/native CI and merge status are tracked in the
  pull request. The local timeout is not reported as a full-suite pass.
- PR #52 opened with e2e enabled. Main's OBS music PR #51 merged concurrently;
  integrated be7e89a, kept the new source/Show cue contracts and removed the
  obsolete mixer. Regenerated catalogue: 108 views; valid navigation/sitemap.
  Integrated-base typecheck passed. Media regression red 1 failed, then green
  3 files / 9 passed (10.32s): hidden camera IDs cannot become playback cues;
  Media/VLC targets execute only on explicit Run, with saved exact target IDs.

## Untested scope

Real OBS hardware/audio audibility and public broadcast outcomes require operator
acceptance. Automated host tests use contained vaults and simulated OBS servers.

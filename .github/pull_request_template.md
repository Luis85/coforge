## Summary

Select visible feature groups per project in Project settings → General → Project
features. Explicit saves retain Build & Improve, Stream, Community and Insights
in canonical project frontmatter. Legacy projects keep all groups. Empty selections
are valid; settings and the project switcher remain reachable. Hidden destinations
resolve to an available workspace. Project actions say Open project when the board
is hidden.

Hiding Stream removes its navigation, board chat/toggle, stream profile and live
dock. Chat drafts survive. Shared services and agent execution keep running.
Existing draft/conflict guards and atomic note writes remain authoritative.

## Requirements and traceability

- Owner request and clarification, 2026-10-30, recorded in BRIEF.md.
- Task: docs/project-tasks/2026-10-30-project-feature-groups.md.
- No req-* or vi-* IDs are declared in the imported traceability file.
- Acceptance: project-feature-groups.test.ts and project-feature-groups-ui.test.ts,
  plus browser and real-host journeys.

## Validation

- TDD red: 2 files / 4 failed before implementation (missing controls and rejected
  featureGroups input). Initial green: 2 files / 4 passed.
- Final focused service tests: 3 passed, including invalid/stale/failed writes and
  an agent completing after all groups are hidden.
- Final focused UI tests: 2 passed, including failed-save draft retention,
  project switching, guarded navigation, empty selections and retained chat draft.
- Related privacy/navigation tests: 8 passed in the related batch.
- Initial npm run typecheck: exit 0. Final retry after concurrent edits failed
  with four errors confined to schedule-music.test.ts (missing removed adapter,
  enabled/music properties, implicit parameter type).
- Final current-tree focused batch: 4 files / 13 passed (19.60s).
- npm run verify:project -- --timeout 3600000: failed at the product suite.
  Check summary: 4 passed, 1 failed, 0 skipped in 838.8s. Typecheck, source lint,
  ESLint (zero warnings) and maker types passed. Product result: 349 files passed,
  7 failed; 1362 tests passed, 3 failed, 6 skipped. Failures overlap concurrent
  music-removal work: three deleted test modules, two INVALID_LOG_CATALOG imports,
  two playlistId assertions and one legacy schedule assertion. These files were
  edited/deleted by another task while this run was active. Details retained in
  reports/project-feature-full-gate.json. No unrelated tests or limits weakened.
- npm run verify:artifacts: exit 0; complete build, UI-effects skipped because no
  generated visual definitions, prototype embedding 1 passed.
- npm run check:views: 111 views; navigation coverage valid; sitemap current.
- Scoped git diff --check passed before concurrent source rewrites; the last
  shared-tree scan reports CRLF whitespace throughout concurrently rewritten
  BRIEF.md. Unrelated existing public HTML also has whitespace.

## UI evidence

- npm run test:ui-quality: 8 passed (55.5s).
- npx playwright test tests/e2e/journeys/project-feature-groups.spec.ts:
  2 passed (39.9s); keyboard, explicit save, light/dark, narrow/wide and WCAG scans.
- npm run ui:gallery: 40 captures, failures []; reviewed light desktop studio and
  dark narrow native settings. No baselines changed.
- Reviewed targeted captures: reports/project-feature-groups/features-light-1280.png
  and features-dark-480.png. Labels/help wrap without horizontal overflow.
- Impeccable detector over changed Vue surfaces: [].

## Obsidian evidence

- npm run test:obsidian -- coforge-project-features: 1 passed (9.90s).
  Visibility survives reload; unknown frontmatter and exact body bytes remain
  intact. Host teardown completed and scratch was removed.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; Obsidian 1.14.4 / launcher 3.2.1, contained sandbox only.
- Evidence: reports/obsidian/cases/coforge-project-features--saves-visibility-in-the-canonical-project-note-and-restores-it-after-reload/
  and .obsidian-sandbox/logs/. Dev log confirms session ended (complete).

## Untested scope

No live Twitch/OBS mutation, billable provider invocation, personal vault,
publication or deployment. Feature selection controls workspace visibility only.
No PR or push requested. Local Node 24.20.0/npm 11.21.1 differ from pins
24.21.0/11.19.1; dependencies unchanged. Pre-existing .gitignore and CoForge/Public
changes are outside this task.
Concurrent music removal and show-plan changes also appeared during verification;
their files are outside this task. Full shared-tree qualification remains pending
those changes. Focused feature, browser and host results above passed.

## Show plan follow-up (2026-10-30)

Show plan is the second Stream studio tab after Broadcast. The new ordered
rundown exposes durations, action counts and keyboard segment selection beside
the selected cue, private presenter notes and explicit Run control. Loaded-plan
identity, stale-definition guards and in-flight save handling prevent the editor
from silently running another plan or losing later edits. Invalid duration drafts
show a review state. Pending/dirty removal controls and native contrast/name
issues are resolved.

- Requirement: pbl-id 6, docs/requirements/OBS Studio Integration.md; no imported
  req-* or vi-* obligations. Owner's revised OBS scope and retained Show plans are
  recorded in BRIEF.md. This increment polishes Show plans; it does not remove
  existing OBS preview/audio panels.
- Task and detailed evidence: docs/project-tasks/2026-10-30-show-plan-polish.md.
- TDD: loaded-plan/save regressions initially 3 failed; final review regressions
  initially 3 failed / 4 passed. Final model + authoring: 2 files / 10 passed.
  New rundown test red before implementation; final focused rundown UI: 1 passed.
- Navigation: 6 passed. Operation-catalog regressions: 5 passed. Scoped ESLint,
  source lint, whitespace checks and final standalone typecheck: exit 0.
- npm run test:ui-quality: 8 passed (1.5m). npm run ui:gallery: 40 captures;
  representative studio/settings captures reviewed. No baselines changed.
- npm run test:obsidian -- coforge-show-plan: 1 passed (20.382s test, 22.48s
  total), using a loopback simulated OBS server. Exactly one scene mutation plus
  a local marker; no broadcast. Reload preserves plan/evidence without replay.
  Unsaved-draft accessibility also passes, including enabled Save and action
  reordering controls. Eight native captures reviewed across light/dark and 1280/480 widths; all four
  WCAG scans have violations [] and overflow 0. Native console empty, host stopped,
  scratch removed. Evidence: reports/obsidian/cases/coforge-show-plan--edits-and-saves-private-segments-runs-only-an-explicit-saved-cue-and-restores-the-plan-without-replay/.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned Obsidian 1.14.4 / launcher 3.2.1. Screenshot, dev.log
  and debug-report.json reviewed. Build-lock collision resolved by serial rerun.
- Impeccable detector: []. View catalogue: 110 views, sitemap current.
- First full verify:project raced concurrent file edits and captured intermediate
  failures. Final rerun also exited 1: typecheck, source lint and maker-types
  passed; ESLint reported two concurrent ScheduleMusicFields.vue prop mutations,
  subsequently fixed (targeted ESLint exit 0). Product tests timed out at 601.1s
  without assertion failures in the captured output. Summary: 3 passed, 2 failed,
  0 skipped in 1024.1s. No full product-suite pass is claimed.
- Separate npm run verify:artifacts: exit 0; 11.43s build, embedding 1 passed /
  0 failed; generated UI effects not applicable (no visual definitions).
  Logs: .obsidian-sandbox/show-plan-verification-final.log and
  .obsidian-sandbox/show-plan-artifacts-final.log.
- Untested: real OBS hardware/public broadcast, real account mutations and
  publication. Local Node 24.20.0 differs from pinned 24.21.0. No dependency
  changes, push or PR creation. Concurrent project-feature/music work preserved.

## Music replacement (2026-10-30)

Remove CoForge's local music library, playlists and player. Stream plans now select
existing OBS Media/VLC inputs for Live/BRB scenes; explicit off-air preparation adds
missing memberships disabled. Scenes and saved Show plan cues control visibility,
play/pause/stop/restart, mute and volume through the established durable OBS gates.
Existing MP3s, metadata, playlist notes, legacy plan fields and recovery ownership
remain preserved. No community plugin is installed.

Traceability: owner decisions in BRIEF.md; no req-* or vi-* IDs are declared.
Task: docs/project-tasks/2026-10-30-remove-music.md.

Evidence: focused tests 10 files / 74 passed; typecheck exit 0; UI quality 8 passed;
OBS music browser journey 2 passed; gallery 40 captures with failures [], reviewed
reports/ui-gallery/ and reports/obs-music/. Contained reload status passed with
errors [], hostErrorCount 0 and pluginConsole []. Full real-host suite: 38 passed /
2 failed; changed live-studio suite and lifecycle checks pass. Isolated project
suite: 2 passed / 1 failed at coforge-projects.obsidian.ts:89 (disabled chat send).
Full verify:project exited 1: the product test step exceeded its 600s process
budget and the new fields initially violated vue/no-mutating-props. The prop issue
is fixed; targeted ESLint exits 0, post-fix typecheck passes, 4 preparation/UI tests
pass, and both browser journeys pass (37.7s). verify:artifacts exits 0 (build and
1 prototype-embedding test; UI effects not applicable). Initial check:fast timed
out while the shared tree was being edited. Final post-fix host reload also passes with errors [] and hostErrorCount 0;
verify:artifacts rerun exits 0 (8.58s build, embedding 1 passed). check:views reports
110 documented views, valid navigation coverage and current sitemap. No full
product-suite pass is claimed after its timeout.
Scoped diff whitespace check passes. No baselines or dependencies were changed.

Untested: actual audio audibility/routing and real OBS/Twitch mutations, direct
community-plugin APIs. No push or PR requested. Concurrent project-visibility and
Show plan changes are preserved; their evidence above belongs to those tasks.

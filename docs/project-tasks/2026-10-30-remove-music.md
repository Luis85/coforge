# Task: Remove the built-in player and integrate OBS music

- Status: implemented; focused qualification passes, full-gate limitations recorded below
- Journey in BRIEF.md: OBS music integration without a built-in player, owner decision 2026-10-30.
- Traceability: design/traceability.json has no req-* or vi-* obligations.

## Acceptance

Remove the local music library, player, playlists and previews. Keep music in
stream preparation and automation through existing OBS Media/VLC sources.
Assign Live/BRB sources in plans; explicitly add missing scene memberships disabled
while off air. Show cues own explicit visibility/playback/mute/volume.
Keep OBS audio/media controls and alert audio. Existing music/playlist notes and
MP3s remain untouched. Legacy schedules load and preserve old playlist properties
on save; obsolete OBS overlays can be cleared without discarding other OBS state.
Historical music events remain readable but cannot trigger show cues.

## Plan

1. Failing navigation and legacy-plan regression assertions first.
2. Remove feature implementation and dependent controls; retain read compatibility.
3. Update component catalogue and product documentation.
4. Full project gate, UI quality/gallery, contained-host reload, self-review.

## Evidence

- TDD red: 2 failed, 8 passed; Music navigation remains and legacy plan validation fails.
- Final focused Vitest batch: 10 files passed, 74 tests passed (39.64s). Covers
  preparation, disabled RPC additions, stale identities, partial failure,
  event deduplication, protocol playback/readback, legacy plans and overlays,
  real note preservation, UI save/review and navigation/catalogue coverage.
- npm run typecheck: exit 0.
- npm run test:ui-quality: 8 passed (1.3m).
- Browser journey obs-music-preparation.spec.ts: 2 passed (37.7s), light 1280px
  and dark 480px, page-scoped WCAG scans and explicit preparation boundaries.
- npm run ui:gallery: 40 captures, failures []; reviewed studio light desktop
  and targeted music fields in light desktop and dark narrow captures.
  Evidence: reports/ui-gallery/ and reports/obs-music/.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned Obsidian 1.14.4/launcher 3.2.1. An earlier attempt
  collided with another local build lock; it was retried without deleting the lock.
- npm run test:obsidian: 38 passed, 2 failed (528.33s). The changed live-studio
  suite passed all 3 cases, including unchanged MP3/playlist bytes after reload;
  lifecycle/load/views/commands and OBS production/overlay cases passed.
- Isolated npm run test:obsidian -- coforge-projects: 2 passed, 1 failed (50.86s).
  Export evidence passes in isolation; the remaining failure is the existing
  project chat flow at line 89 waiting on a disabled Send chat message button.
- npm run check:fast: initial shared-tree run timed out in its 600s test step;
  it also sampled the schedule-clone and concurrent show-rundown UI errors during
  editing. The schedule-clone defect is fixed and its focused regression passes.
- npm run verify:project: exit 1. Typecheck, source lint and maker types passed;
  the full product test step exceeded its 600s process deadline. The run also found
  vue/no-mutating-props in the new fields; that defect was fixed by routing select
  changes through the composable. Targeted ESLint now exits 0 with zero warnings.
- After the lint fix: typecheck exit 0; preparation/UI tests 2 files / 4 passed;
  browser journeys 2 passed (37.7s), including both WCAG scans.
- npm run verify:artifacts: exit 0 (build plus prototype-embedding 1 passed;
  UI-effect generation is not applicable because no visual definitions exist).
  Final post-fix rerun also exits 0: build completed (8.58s), embedding 1 passed.
- Final post-fix dev:obsidian: status passed, errors [], hostErrorCount 0,
  pluginConsole [], reload 844ms; dev.log confirms session ended (complete).
- npm run check:views: 110 views documented; navigation coverage valid;
  sitemap current. node bin/app status: generation matches, 0 pending obligations.
- Scoped git diff --check: exit 0. Unrelated existing public HTML is excluded.

## Self-review

Removed feature-only tests with the removed implementation and replaced them with
behavioral regressions for removal, migration, preparation and OBS integration.
No dependencies, lint rules, assertion thresholds or global test timeouts changed.
The protocol test uses the same 15s per-case budget as adjacent tests because
unconfirmed native actions deliberately poll beyond Vitest's default 5s.
Domain/application code stays framework-free; effects go through existing durable
OBS workflows. Music/playlist files are never loaded or rewritten by startup.
Historical codes and legacy discriminators remain read-compatible; new local-player
publication and event dispatch are disabled. No req-* or vi-* IDs exist to update.
Concurrent project-feature and Show plan work has been preserved.

## Untested scope

Community plugin selection/installation and real OBS/Twitch mutations are outside
scope. OBS protocol behavior is tested through the loopback fixture, not audible
output or an actual OBS installation. The project chat host failure remains outside
this music change. Local Node 24.20.0/npm 11.21.1 differ from pins 24.21.0/11.19.1;
no dependencies were changed.

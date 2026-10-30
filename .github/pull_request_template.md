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

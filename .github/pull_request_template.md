## Summary

Replace CoForge's local music library, playlists and player with existing OBS
Media/VLC sources. Stream plans assign Live/BRB music; explicit off-air preparation
adds missing memberships disabled. Scenes and Show plan cues control visibility,
playback, mute and volume through existing durable OBS gates. Existing files,
playlist notes, legacy schedule properties and overlay recovery ownership survive.

Also preserve a newer chat draft when an earlier send completes. This fixes a
reproduced project-chat host failure; unchanged successful messages still clear.

## Traceability

Owner decisions in BRIEF.md. No req-* or vi-* obligations are declared. Task and
evidence: docs/project-tasks/2026-10-30-remove-music.md. PR #51 includes the already
merged project visibility base and excludes unrelated Show plan changes.

## Validation

- Focused music tests: 10 files / 74 passed; chat race: 2 passed after 2 red cases.
- Isolated full real-Obsidian suite: 31 files / 38 passed (399.48s).
- Direct music host journey after main integration: 1 passed (16.80s), including
  disabled source preparation, explicit visibility/playback and reload without replay.
- UI quality: 8 passed (1.0m); browser music journey: 2 passed (37.7s).
- Gallery: 40 captures, failures []; reviewed reports/ui-gallery/ and reports/obs-music/.
- Targeted ESLint: exit 0; check:views: 110 views, valid coverage, current sitemap.
- Contained reload: status passed; errors [], hostErrorCount 0, pluginConsole [].
- Runtime commit 09fbf8e: GitHub check/build, browser, real-Obsidian and GitGuardian
  checks all passed. The test-only journal snapshot correction passed its focused
  native rerun (1 test, 15.60s), preserving all attempt/artifact/reload assertions.
- Windows full check uses --timeout 1800000 after the serial suite exceeded the
  default process budget. Typecheck/lint/ESLint/maker types passed in that run;
  final combined results and exact-head check links are recorded in PR #51.
  The snapshot assertion avoids rereading a journal path during atomic rotation.

## Limits

No real broadcast, Twitch mutation or audio audibility/routing test. Native UI uses
pinned Obsidian and a loopback OBS fixture. No community-plugin installation or
API integration. Generated evidence is excluded from Git. GitHub uses pinned
Node/npm; local versions are 24.20.0/11.21.1. No dependencies or assertion thresholds
changed. Merge only after final local and GitHub checks are green.

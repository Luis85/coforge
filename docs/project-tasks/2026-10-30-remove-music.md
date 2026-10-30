# Task: Remove the built-in player and integrate OBS music

- Status: implemented; final qualification and merge tracked in [PR #51](https://github.com/Luis85/coforge/pull/51).
- Journey: BRIEF.md, OBS music integration without a built-in player (owner decisions, 2026-10-30).
- Traceability: design/traceability.json declares no req-* or vi-* obligations.

## Acceptance and implementation

Remove the local music library, playlists, player and preview services. Stream
plans assign existing OBS Media/VLC sources to Live/BRB scenes. Explicit off-air
preparation adds missing scene memberships disabled, preserves existing ones and
sends no playback request. Scenes and saved Show plan cues control visibility,
play/pause/stop/restart, mute and volume through existing durable OBS workflows.

Existing MP3s, metadata and playlist notes remain untouched. Legacy schedule
playlist properties survive edits alongside exact note body bytes. Old Now playing
ownership records remain clearable; retired local-player events no longer execute
show bindings. Alert audio and generic OBS audio/media controls remain available.

Qualification exposed a chat draft race: completion of an earlier send cleared a
newer message. Capture the submitted draft and clear only the same viewer/text/mode.
The regression covers both the same viewer and an edited viewer identity; unchanged
successful messages still clear normally. This resolves the project host test.

## Verification

- TDD: music navigation/legacy-plan checks failed before implementation; chat race
  regression failed 2 cases before the fix and passed 2 afterward.
- Earlier focused music batch: 10 files / 74 passed (39.64s).
- Isolated chat regression: 2 passed (4.22s); targeted ESLint exit 0, zero warnings.
- Isolated full real-Obsidian suite: 31 files / 38 passed (399.48s), including
  project chat, lifecycle, load, views, commands, OBS production and overlays.
- After integrating main's project visibility change, direct OBS music host test:
  1 passed (16.80s). It proves disabled preparation, explicit source visibility and
  playback, retained assignments after reload, no playback replay and no broadcast.
- Isolated UI quality: 8 passed (1.0m); gallery: 40 captures, failures []. Reviewed
  desktop studio and music controls in light desktop/dark narrow captures.
- Music browser journey: 2 passed (37.7s), including WCAG scans and reflow.
- Initial Windows verify:project exceeded its 600s process budget in the serial
  product suite. Typecheck, source lint, ESLint and maker types passed. The final
  combined branch runs the same check gates with --timeout 1800000; assertions and
  global test timeouts are unchanged. Final output and exact-head CI are recorded
  on PR #51 before merge.
- check:views: 110 views, valid coverage, current sitemap. Diff whitespace check
  passes. Earlier release artifact checks and contained reload passed.
- Evidence directories: reports/ui-gallery/, reports/obs-music/, reports/obsidian/
  and .obsidian-sandbox/. They are generated, reviewed and excluded from Git.

## Self-review and scope

Domain/application code stays framework-free. Writes use the existing host-owned
admission and uncertain-outcome recovery gates; operation events follow committed
writes. No raw note content, paths or provider causes are logged. No dependencies,
lint rules, coverage thresholds, baselines or existing acceptance assertions were
weakened. Retired feature-only tests were replaced with removal, migration and OBS
integration coverage. Existing note IDs, unrelated frontmatter and body bytes are
preserved. The isolated PR excludes unrelated Show plan edits and builds on the
already merged project visibility change.

No real OBS installation, audio audibility/routing, live broadcast, Twitch mutation
or community-plugin API integration is claimed. Native UI uses the pinned contained
Obsidian host and a loopback OBS protocol fixture. Local Node 24.20.0/npm 11.21.1
are below/different from the pinned 24.21.0/11.19.1 pair used by GitHub CI.

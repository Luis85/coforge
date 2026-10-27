# Task: Prepare and run a stream from CoForge

- Status: implemented; final CI verification pending
- Owner requirement: OBS Studio Integration (pbl-id 6), streamer workflow and project agent prompt.
- Generated traceability declares no requirement/vi obligations; no generated acceptance IDs are claimed.

## Acceptance

- Main content reserves no stable scrollbar gutter beside the right panel.
- The landing view exposes OBS setup, current stream/scene state, readiness and explicit Go live/Pause/Resume/Stop.
- Pause is a BRB scene switch, not recording pause or stopping the stream; Resume restores the previous scene.
- OBS authentication, request correlation, deadlines, reconnection and shutdown are owned by a host adapter.
- No stream key is read; passwords never enter notes, plugin JSON, events or logs. No public start/stop is used by agent QA.
- Start/stop/scene mutation outcomes require OBS confirmation. Unknown effects are not replayed after reconnect/restart.
- Workflow commands and observed changes emit immutable post-write events, with observer isolation.
- Project prompt is separate from description, persists in Markdown and prefixes all parent-project agent dispatches.
- Twitch title, category, tags and broadcast language can be edited; branding opens Twitch's editor.
- Protocol, failure/restart, project-note and browser/native-host tests support the implementation.

## Plan

Write failing spacing/prompt/workflow tests; add framework-free OBS contracts/controller, a scoped v5 transport
adapter and dashboard composables. Verify in headless UI and contained Obsidian CI, review and polish before merge.

## Limits

OBS must be running with its WebSocket server enabled and broadcast destination configured. Live OBS/Twitch
acceptance is streamer-operated. This increment does not install OBS, edit output credentials or pause recordings.

## Review and evidence

Reviewed application/adapter/UI boundaries, persisted recovery, exact project-note preservation, background
parent-project dispatch, secret handling, immutable operation events and teardown ownership. Fixed concurrent
start admission, stopping reconnecting output, incomplete protocol replies, scene readback uncertainty and
persisting the previous scene before BRB. No command is replayed automatically.

- `npm run verify:project`: 5 passed, 0 failed, 0 skipped; production build 1253 modules, 5.08s.
- `npm run test:e2e`: 27 passed (2.3m), including dark/light stream studio and editor, 360px reflow and board spacing.
- `npm run test:ui-quality`: 8 passed (44.5s).
- `npm run ui:gallery`: captured 40 screenshots; reviewed index and representative studio/settings captures,
  plus dedicated dark desktop/light narrow stream-studio captures in `reports/streamer-workflow/`.
- Focused final OBS protocol/workflow/dashboard regression suite: 3 files, 10 tests passed (3.73s).
- Local `dev:obsidian -- --json`: not run successfully; launcher 3.2.1 is not provisioned. Nothing downloaded.
  Native checks run in the repository's contained Obsidian CI with the PR's e2e label.
- `git diff --check`: clean. Generated traceability has no req-/vi-* declarations to update.

Live OBS output, real credentials and public Twitch writes are untested by agent QA. See
[[docs/coforge/STREAM-STUDIO]] for operator setup and explicit boundaries.

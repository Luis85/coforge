# Task: Prepare and run a stream from CoForge

- Status: implemented; final CI evidence is recorded in [PR #13](https://github.com/Luis85/coforge/pull/13)
- Owner requirement: OBS Studio Integration (pbl-id 6), streamer workflow and project agent prompt.
- Generated traceability declares no requirement/vi obligations; no generated acceptance IDs are claimed.

## Acceptance

- Main content reserves no stable scrollbar gutter beside the right panel.
- The landing view exposes OBS setup, current stream/scene state, readiness and explicit Go live/Pause/Resume/Stop.
- Open installed OBS explicitly, discover standard native installations or use a configured executable,
  reuse an existing process and wait for the local WebSocket server without broadcasting.
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

OBS must be installed with its WebSocket server enabled and broadcast destination configured. Live OBS/Twitch
acceptance is streamer-operated. This increment does not install OBS, edit output credentials or pause recordings.

## Review and evidence

Reviewed application/adapter/UI boundaries, persisted recovery, exact project-note preservation, background
parent-project dispatch, secret handling, immutable operation events and teardown ownership. Fixed concurrent
start admission, stopping reconnecting output, incomplete protocol replies, scene readback uncertainty and
persisting the previous scene before BRB. No command is replayed automatically.
The launch increment uses an injectable native host for discovery/process checks, empty argv without a shell,
the binary's working directory, a bounded server wait and cancellation before spawning on plugin disposal.
Launcher tests cover Windows/macOS/Linux discovery, existing processes, bad paths and cancellation.

- `npm run verify:project` with native launch: 5 passed, 0 failed, 0 skipped (420.8s); production build 1254 modules, 5.63s.
- `npm run check:fast` with native launch: 5 passed, 0 failed, 0 skipped (319.8s); full product suite selected.
- `npm run test:e2e` with native launch: 27 passed (3.1m), including dark/light stream studio and editor, 360px reflow and board spacing.
- `npm run test:ui-quality`: 8 passed (44.5s).
- `npm run ui:gallery`: captured 40 screenshots; reviewed index and representative studio/settings captures,
  plus dedicated dark desktop/light narrow stream-studio captures in `reports/streamer-workflow/`.
- Focused OBS launcher/protocol/workflow/dashboard suite: 4 files, 18 tests passed (7.44s), followed by cancellation
  and successful reconnect regression coverage. Reconnect workflow suite: 7 tests passed (1.24s).
  Final protocol reconnect regression: 7 tests passed (2.33s); transition events from a lost socket cannot remain stuck.
- Local `dev:obsidian -- --json`: not run successfully; launcher 3.2.1 is not provisioned. Nothing downloaded.
  Native checks passed on the pre-launch head and run again through the PR's e2e label for the final implementation.
- `git diff --check`: clean. Generated traceability has no req-/vi-* declarations to update.

Live OBS output, real credentials and public Twitch writes are untested by agent QA. See
[[docs/coforge/STREAM-STUDIO]] for operator setup and explicit boundaries.

# Live studio tools

## Monitor and scenes

Stream studio reads Twitch viewers every 15 seconds, OBS health every five seconds and observed chat
counts over a rolling 60-second window. Warm-up duration, source age and unavailable/stale readings are
shown explicitly. Bitrate uses successive OBS byte counters; dropped-output percentage is cumulative.
The private stream archive still samples once per minute. Chat counts cover messages CoForge received,
including commands; they cannot reconstruct messages missed while disconnected.

Expand **OBS scenes and sources** after connecting. Selecting a scene opens its editor without switching
program output. Create, rename, duplicate, delete and explicitly switch scenes; show/hide, reorder, add
existing sources and remove memberships. Groups remain whole items; edit capture devices, group contents,
audio properties and detailed source properties in OBS. Capabilities come from the connected server.

Copies share source objects/groups and retain transforms/crop, visibility/order, locks, blend modes and
scene transition overrides. Copying is bounded; a partial copy is preserved for inspection, never deleted
or replayed automatically. Deletion protects program/preview, nested output references, last scene and
go-live/BRB/resume assignments. Rename follows saved assignments. Confirmed membership removal may discard
an unused source in OBS. Scene deletion also removes references to that scene elsewhere.

Scene mutations and stream controls share admission and a durable intent journal. Context changes invalidate
reviewed actions. After an unknown result, refresh and inspect OBS before continuing. Operation events carry
safe action enums and correlation IDs, never scene names, passwords or raw responses.

## Music through OBS

CoForge no longer provides a local music library, playlist editor or audio player.
Existing MP3 files, metadata and playlist notes remain in the vault. Use a community
plugin for personal playback, or configure Media/VLC sources in OBS for automation.

In **Schedule**, refresh OBS music sources and assign an existing source to the Live
and/or BRB scene. Save and review the plan, then **Apply music** while OBS is off air.
New scene memberships are added disabled; existing memberships are unchanged. No
playback request is sent. A partial failure retains confirmed additions; inspect
OBS before retrying an uncertain outcome. Sources are shared across scenes.

In **Scenes**, enable a prepared source when ready. In **Show plan**, combine a
Show/hide action with **Music / media playback**, mute/unmute and volume actions.
Bind the cue to an existing stream/application event and explicitly enable event
cues for the session, or run it manually. Reload pauses event automation. OBS may
start media when its source becomes active, according to the source settings.

## Herdr

In **Agent workflow → Herdr agents**, configure the native Herdr executable and session, start that session
in Herdr and refresh. The integration follows the installed Herdr Companion 0.5.0 approach, targeting Herdr
0.9.5 CLI response shapes. A native Windows executable is required; no batch wrappers or WSL bridge.
Install/configure coding-agent tools separately. CoForge does not copy Companion data or alter its settings.

Create a workspace for the selected project's existing local directory, start Claude/Codex/Cursor/OpenCode
in an empty shell pane, and inspect or focus an agent. Interrupt confirms the selected agent and sends Ctrl+C.
Ready status and current workspace/agent identity are rechecked, including canonical project-directory matching.

Choose a screened open request and ready agent, review its exact project-prefixed prompt and explicitly send.
Delivery is not completion and does not advance screening/planning/acceptance. Agents run with their own
installed permissions; this control is separate from CoForge's restricted Claude stage runner. Inspect the
agent and changes before advancing/reviewing the request in CoForge. The full live terminal and folder worker
remain in Companion. Private `coforge-herdr.json` stores settings and bounded recovery records, not prompt text.
Pending/unknown mutations survive reload without replay; refresh, inspect the original session and acknowledge.
Closing CoForge aborts only its short-lived CLI reads, leaving Herdr's server/agents running.

Protocol references: [OBS v5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md),
[Herdr CLI](https://herdr.dev/docs/cli-reference/), [Herdr agent automation](https://herdr.dev/docs/agent-automation/).

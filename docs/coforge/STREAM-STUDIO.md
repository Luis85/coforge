# Stream studio

CoForge opens on Stream studio. Start OBS Studio, configure its broadcast destination and output,
then enable **Tools → WebSocket Server Settings**. OBS WebSocket v5 normally uses port 4455.
CoForge does not install OBS or read stream keys.

1. Enter the OBS WebSocket URL. Save its password using **Save OBS password**; this uses
   Obsidian secret storage, not a project note or plugin JSON.
2. Connect OBS, select distinct go-live and BRB scenes, and save the setup.
3. Review audio, video and output in OBS. Connect Twitch under Stream chat and select a project
   for community requests. Those integrations can be prepared independently.
4. Press **Prepare stream**, then **Go live**. Only Go live sends StartStream.
5. **Pause / BRB** changes the program scene while broadcasting continues. **Resume** restores
   the previous program scene. **Stop stream** ends broadcasting through OBS.

Connecting, auto-connecting, opening the plugin, and reconnecting never start a stream.
Disconnecting CoForge does not stop a broadcast. OBS remains usable independently.
If a response is lost after a command, CoForge holds its result as uncertain. Use **Refresh OBS state**
or reconnect to reconcile the actual state; no stream mutation is replayed automatically.
Scene collections and scene deletion can invalidate saved scenes; select and save replacements.

## Twitch channel

Expand **Twitch channel and branding** to change title, category, tags and broadcast language.
Authorize the streamer account with `channel:manage:broadcast`. Tags must be unique and contain
1–25 letters or numbers; Twitch permits at most ten. Language accepts a two-letter code or `other`.
CoForge reads the channel back after updating and reports partial/unconfirmed results for review.

The branding link opens Twitch's editor for images, banners and accent color. Edit panels on your
channel's About page. CoForge does not upload branding assets.

## Project prompt

Project settings contains **General agent prompt**, separate from the description. It is stored as
`agent-prompt` in the canonical Markdown project note. Each dispatch prefixes that prompt to the
request payload using its parent project, including background work on an unselected project.
It does not expand allowed tools or the project's workspace boundary. It is not included in process
arguments, public board data, operation metadata or logs.

## Maintenance seams

- `ObsControlPort` is the framework-free application boundary. `ObsWorkflow` owns interaction
  guards, readiness, recovery and a durable command journal. Commands are serialized before effects.
- `ObsClient` owns v5 authentication, correlation, bounded pending requests, deadlines and reconnects.
  `ObsAdapter` exposes only status, scene selection and explicit start/stop; it owns polling and cleanup.
- `useBroadcast` presents state and preserves settings drafts. The Vue view binds controls without
  owning protocol behavior. Headless preview intentionally cannot control a live broadcast.
- Requested/confirmed/rejected/uncertain operations are persisted before immutable events publish.
  OBS connection, program scene and output observations are separate events. Subscribers cannot
  change a committed effect. Operation metadata carries codes and correlation IDs, not private prompts,
  passwords, endpoints or raw server responses.

Protocol and workflow tests use fake ports/WebSocket servers. Browser tests cover layout, keyboard and
accessibility; contained Obsidian tests cover lifecycle and canonical project-note writes.
An actual public broadcast and Twitch metadata update are streamer-operated acceptance checks.

Protocol references: [OBS WebSocket v5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md),
[Twitch channel API](https://dev.twitch.tv/docs/api/reference/#modify-channel-information).

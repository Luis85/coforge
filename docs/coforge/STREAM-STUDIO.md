# Stream studio

CoForge opens on Stream studio. Install OBS Studio 28 or later, configure its broadcast destination and output,
then enable **Tools → WebSocket Server Settings** once. OBS WebSocket v5 normally uses port 4455.
CoForge does not install OBS or read stream keys. Initial WebSocket enablement,
output/device configuration and OS/vendor permissions are completed in OBS.

## Stream and show operation

Broadcast contains explicit prepare, go-live, BRB/resume and stop controls with
observed audience/health. Show plan is the second tab, followed by connection and
readiness Setup, Scenes, Music, Public displays and History.

Scenes creates, renames, duplicates, deletes and switches scenes, and manages
existing source membership, visibility and order. Selecting an editor does not
switch output. Shared source settings, devices, layouts, filters, audio tuning,
program/preview monitoring and output configuration remain in OBS. Removed
panels no longer fetch sampled screenshots or audio meter samples. Retained
cue/public-display tasks inspect current identities without broadcasting.

Show plan saves private named segments with finite explicit production actions,
notes and durations. The ordered rundown shows durations and action counts; select a
segment to review its notes/actions beside explicit Run controls. Choosing another
plan in the load picker never changes the loaded execution/removal target until
Load is pressed. Dirty or externally changed definitions must be saved/discarded
or reloaded before execution. Saving/navigation never runs a cue. Run a selected cue to
capture its definition, persist each pending step and retain confirmed/failed/
uncertain outcomes. Local moment markers are not Twitch markers, recording
chapters or replay files. Acknowledging a partial cue keeps completed effects
and never replays the captured run.

Event bindings are explicitly enabled for the current desktop session. They pause
after reload, deduplicate observed event sequences and skip unavailable/busy gaps.
Bindings do not infer private Council publication, grant agent permissions, or
start broadcasting. Public displays continue to use only their approved public
projections; private control panels and financial/agent data are not capture content.

Public displays also includes a text-overlay composer. Create a supported OBS Text
source in OBS, load public choices, select its exact target and public project, and preview
the outgoing text. Explicitly confirm the captured content before publishing and
saving its mapping. Approved mappings can be refreshed manually or used by a show
cue. Supported content includes a screened public request, accepted work, community
recognition, current music display metadata and a fixed operator-reviewed Council
excerpt. Private Council tasks and provider output are never automatically read or
published. Now-playing uses companion-note title/artist/attribution from the playing
track, excluding its path and private playback state.
To refresh now-playing text on track changes, explicitly bind its overlay cue to
the music playback/track events in Show plan and enable event cues for the session.

The composer changes shared OBS text immediately; its preview states that impact
and whether a text-file source will switch to direct text. Revoked public content
is no longer eligible for publication. Owned text is cleared when possible; a busy,
disconnected or unconfirmed OBS outcome requires explicit inspection and clearing.
OBS is an external copy: previously published text may remain visible until a clear
is confirmed, and past recordings cannot be revoked. CoForge does not overwrite a
source whose text was subsequently changed outside its owned mapping.

When navigating to another CoForge work view during a broadcast, the quick-control
strip retains BRB/resume and a return to the live desk. Lost connection displays
last-seen status and disables mutations rather than implying the stream stopped.

## First-time setup

The first visit offers **Set up your stream**. Skip it at any time and reopen it with **Guided setup**;
dismissal and completion survive plugin reloads. The guide uses the same real controls as Stream studio:

1. **Find OBS** checks standard native installations, a custom executable and whether OBS is running.
   It never launches anything. Remote addresses are checked by connecting to that server instead.
2. **Connect OBS** explains enabling WebSocket authentication, stores the password securely, and lets you
   launch/connect or verify an existing server. A saved address or password alone does not count as connected.
3. **Choose scenes** lists the connected OBS scenes. Save a go-live scene and optional distinct BRB scene.
4. **Connect Twitch** guides public-app registration, streamer/chatbot authorization, permissions and receiving
   chat. Twitch email verification/2FA and public app registration happen in its developer console. Paste only
   the public Client ID; no client secret is requested. Device authorization opens Twitch for consent.
   Automatic replies/recurring messages remain optional and off until explicitly enabled.
5. **Review & prepare** asks you to inspect the intended Twitch destination, audio and video in OBS. This is
   your confirmation, not an API inspection of private OBS output credentials. Completion requires current OBS
   status (no older than 30 seconds), valid scenes, the expected Twitch accounts/permissions/chat connection
   and your review. Losing a connection or switching the chatbot makes readiness incomplete again.

**Finish setup never goes live.** After finishing, use Prepare stream and explicitly choose Go live.
The guide can be explored out of order; incomplete steps stay visible. Browser preview explains the flow
but cannot detect tools, authorize an account, launch OBS or start a broadcast.

OBS output setup and Twitch consent are necessarily streamer-operated. Git and Claude Code are optional
for this streaming setup and are configured separately for agent development work.

## Regular stream controls

1. Enter the OBS WebSocket URL. Save its password using **Save OBS password**; this uses
   Obsidian secret storage, not a project note or plugin JSON.
2. Press **Open OBS Studio** to discover/open the installed application and wait for its local WebSocket
   server. A running OBS is reused. Standard Windows/macOS/Linux native installations are discovered;
   for portable or custom installations enter the full native executable path in OBS setup. Linux sandboxed
   packages require launching OBS manually if a native executable is unavailable. Use **Connect OBS** for
   an already running or remote server. Select distinct go-live and BRB scenes, and save the setup.
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
It does not expand allowed tools or the project's workspace boundary. Claude dispatch uses standard input.
The explicit Herdr CLI integration sends the reviewed prompt as one literal process argument, matching its
Companion workflow; it can be visible to local process-inspection tools. Neither integration includes the
prompt in public board data, operation metadata or structured logs.

## Maintenance seams

- `ObsControlPort` is the framework-free application boundary. `ObsWorkflow` owns interaction
  guards, readiness, recovery and a durable command journal. Commands are serialized before effects.
- `ObsClient` owns v5 authentication, correlation, bounded pending requests, deadlines and reconnects.
  `ObsAdapter` exposes status, scene controls and explicit start/stop; it owns polling and cleanup.
- `launchObs` owns native discovery/process admission through an injectable host boundary. It launches
  with an empty argument list, without a shell, and uses the executable directory as its working directory.
  Opening is explicit, limited to local WebSocket addresses and bounded by a 30-second server wait. Closing
  CoForge cancels its connection wait; the independently running OBS application remains open.
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

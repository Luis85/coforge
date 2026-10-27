# Stream JSON history

While CoForge is open, a plugin-owned recorder detects a live OBS output or Twitch broadcast and writes
one private JSON object per session under `CoForge/Streams/<id>.json`. Stream studio's **Stream history**
selector lists sessions; **Export stream JSON** writes a copy using the existing private export mechanism.
The viewer website never receives these histories.

An initial sample is followed by one sample per stream-minute bucket. A final snapshot retains the last
partial minute's activity when the stream is confirmed offline. Closing Obsidian cancels polling without
stopping the stream. Reopening resumes the same history and counter baseline where possible. Missed buckets
are represented by `gapSeconds`, not reconstructed observations. A late Twitch stream ID attaches to the
existing OBS session rather than creating a duplicate history.

## Object format (schemaVersion 1)

- Identity: `id`, `channelId`, `startedAt`, `twitchStreamId`, `obsStartedAt`, `endedAt`, `endReason`.
  A Twitch-identified session uses `twitch-<channel>-<stream>`; OBS-only sessions have a generated ID.
  `channel-changed`/`new-broadcast` end tracking of the previous context and do not claim a remote broadcast stopped.
- `summary`: sample count, peak/mean **observed** viewers, follower/subscriber net changes. The mean is an
  arithmetic mean of valid viewer samples, not Twitch's official average concurrency metric. Net changes can
  be negative; missing sufficient observations produce null rather than an invented zero.
- `baselineCounters`: CoForge's durable counters when this recorder first observed the session.
- `samples[]`: `at` (UTC ISO timestamp), `minute` (zero-based stream minute), `gapSeconds`, `twitch`, `obs`, `coforge`.
- `finalSnapshot`: optional final source readings/activity after confirmed offline, separate from on-air minute samples.

`twitch` contains source state, stream ID/start, concurrent viewers, current title/category/tags/language,
follower total, subscriber total and subscription points. `unavailable[]` names failed metric groups.
Subscriber points are Twitch tier points, not money or revenue. Subscriber/follower identities are discarded.

`obs` contains source state, current scene, observed output start and health readings. Health includes cumulative
output bytes, duration in milliseconds, skipped/total frames, congestion (0–1), CPU percentage, memory/disk in
OBS-reported MB, active FPS, render time in milliseconds and render/output frame counters. Derived bitrate is
kilobits per second across adjacent valid byte samples; dropped-frame percentage uses skipped/total output
frames. Unsupported/unavailable health values are null. No output credentials or stream keys are read.

`coforge` contains lifetime counters, counter deltas since session observation and since the previous sample,
registered/blocked player totals, current aggregate currency/XP/reputation/chat-presence balances, request
counts by status/project ID, and reply-queue counts. `twitch-message-observed`/`twitch-command-observed` count
deduplicated Twitch intake only; other CoForge counters may include explicit local command testing. Community
balances and backlog counts are current channel/workspace totals; stream counter deltas describe observed
activity during this recording, not activity while the plugin was closed. Chat presence is not video watch time.

## Permissions and unavailable data

Reconnect the streamer account to grant `channel:read:subscriptions` in addition to existing channel/chat/
moderation scopes. Follower totals use existing channel access; no private follower-list scope is requested.
The setup guide checks the additional subscription permission. Non-subscribable channels,
missing consent, rate limits or API failures can leave totals unavailable; recording continues with remaining
valid sources. A source outage is not recorded as zero viewers/followers/subscribers. An unknown live status
never fabricates samples or a confirmed end.

## Persistence and maintenance

`StreamRecorder` is framework-free and depends on capture/history/timer ports. Native adapters own Twitch
scope validation, bounded HTTP/WebSocket calls, and vault IO. The recorder serializes capture and uses current
channel leases. Files are atomically replaced through `.tmp`/`.bak` generations; an interrupted first index
write can recover its stream file. Invalid external JSON is not silently overwritten. The lightweight hidden
index stores summaries, not credentials or raw samples. Per-file safeguards reject over 50 MB or 100,000 samples
rather than truncating a history. No retention deletion is automatic.

Private metric files contain no raw chat, viewer IDs, note content, repository paths or credentials. Operation
events publish only after successful file writes. JSON schemas are validated at the vault boundary; observer
failures do not repeat external effects. Tests use fake clocks/providers, faulted file replacement and contained
Obsidian export. Real audience values and a live public broadcast remain streamer-operated acceptance.

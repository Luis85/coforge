---
pbl-id: 9
type: PBI
parent: "[[Twitch Integration]]"
order: 3500
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

## Accepted activity workflow (2026-10-29)

Collect supported follows, subscriptions/gifts, cheers, raids, redemptions, goals,
Hype Trains, charity and moderation facts through permission-filtered EventSub.
Deduplicate stable event IDs, retain bounded private evidence and show connection gaps.
CoForge cannot replay events missed while disconnected or closed.

Filter and acknowledge activity, optionally link an existing screened request, and
explicitly prepare announcements or shoutouts. Acknowledgement never posts to Twitch.
Events do not silently dispatch agents, widen permissions or bypass human review.

Acceptance and evidence: [[docs/project-tasks/2026-10-29-twitch-command-centre]].

## OBS Browser Source delivery (2026-10-29)

Stream → Alerts supplies a stable local URL for OBS and reusable literal text,
GIF/image, audio and video templates. The streamer fires saved alerts manually or
explicitly binds them to supported committed CoForge and Twitch activity events.
Bindings reuse permission-filtered collection, safe public variables and stable
event identities; source connection is distinct from confirmed on-air playback.
The overlay stays transparent while idle, uses bounded live queues, and never
replays missed or retained activity after reconnect/reload.

Contracts and evidence: [[docs/components/views/alerts]],
[[docs/components/views/public-alerts]],
[[docs/project-tasks/2026-10-29-alerts-polish]].

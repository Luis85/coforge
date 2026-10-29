---
id: twitch-operations-data
title: Twitch data and access
goal: Inspect dataset permissions, freshness and collection gaps.
audience: streamer
kind: panel
route: "Twitch operations / Data & access"
parent: "[[docs/components/views/twitch-operations]]"
component: src/plugin/presentation/components/coforge/TwitchOperationsData.vue
entry:
  - Open Twitch operations from Stream navigation.
actions:
  - Authorize selected dataset
  - Inspect collection gaps
  - Save retention
states:
  - Disconnected or missing permission
  - Current or stale observed data
  - Preserved draft
  - Reviewed exact target
  - Confirmed, failed or uncertain outcome
journeys:
  - broadcast
  - twitch-channel-operations
privacy: Private channel workspace; excluded from public projections and viewer exports.
order: 85050
type: Task
---

# Twitch data and access

## Purpose

Inspect dataset permissions, freshness and collection gaps.

## Entry and next action

Open Twitch operations in the Stream navigation group, then choose the relevant task.
Channel-wide state remains independent of the selected project. Navigation never sends
an external mutation. Forms preserve their drafts when an operation fails.

## States and recovery

Only authorized reads and reviewed actions are available. Read data shows collection time;
connection gaps are not reconstructed. A reviewed action captures its channel, account
and values. Unknown outcomes remain held until the operator inspects Twitch and records
that inspection; acknowledgement never replays or asserts success for the old action.

## Composition and boundaries

Uses native theme tokens, accessible labelled controls and the owning page's scroll frame.
Credentials stay in secret storage. Reports, retained activity and private request links
never enter public projections. OBS production controls belong to Stream studio.


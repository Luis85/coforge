---
id: twitch-operations
title: Twitch operations
goal: Manage the Twitch channel without leaving CoForge.
audience: streamer
kind: page
route: "studio.view = twitch-operations"
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/TwitchOperationsView.vue
entry:
  - Open Twitch operations from Stream navigation.
actions:
  - Choose task
  - Authorize capability
  - Review and confirm action
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
coverage:
  group: studio
  key: twitch-operations
order: 85050
type: Task
---

# Twitch operations

## Purpose

Manage the Twitch channel without leaving CoForge.

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


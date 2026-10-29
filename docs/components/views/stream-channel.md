---
id: stream-channel
title: Chat
goal: Respond to viewers through the connected Twitch channel.
audience: streamer
kind: subpage
route: studio.streamTool = channel
parent: "[[docs/components/views/stream]]"
component: src/plugin/presentation/components/coforge/ChatPanel.vue
entry:
  - Open Stream chat, then choose Chat.
actions:
  - Send chat
  - Enable explicit local test
  - Moderate message
  - Read viewer commands
states:
  - Disconnected
  - Connecting
  - Missing scopes
  - Read-only
  - Sending
  - Local test
  - Send failure
journeys:
  - viewer-intake
  - moderation
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: stream
  key: channel
order: 82000
type: PBI
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

# Chat

## Purpose

Respond to viewers through the connected Twitch channel.

Twitch settings has a separate subpage. Private moderation accompanies interactive chat. Project IDs route requests independently of the selected board.

## Entry and next action

Open Stream chat, then choose Chat. Available actions: Send chat; Enable explicit local test; Moderate message; Read viewer commands. Return through the owning [Stream chat](stream.md) surface.

## States and recovery

Disconnected; Connecting; Missing scopes; Read-only; Sending; Local test; Send failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ChatPanel.vue](../../../src/plugin/presentation/components/coforge/ChatPanel.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `viewer-intake`, `moderation`.

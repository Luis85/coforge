---
id: stream
title: Stream chat
goal: Manage the conversation with viewers.
audience: streamer
kind: page
route: studio.view = stream
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/StreamPage.vue
entry:
  - Choose Stream chat in the studio navigation.
actions:
  - Choose Chat
  - Choose Twitch settings
  - Choose Bot messages
  - Inspect intake status
states:
  - Disconnected
  - Connecting
  - Live chat
  - Local command test
journeys:
  - viewer-intake
  - broadcast
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: stream
order: 81000
type: Feature
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

# Stream chat

## Purpose

Manage the conversation with viewers.

Conversation, connection configuration and recurring messages have separate local subpages. Twitch chat and its contributor count exclude sample and local-test identities, including while disconnected. Choosing Test commands locally shows the separate local-test history and contributors; End local test restores Twitch history without deleting stored examples or clearing the draft. Local tests remain labelled and excluded from public capture chat.

## Entry and next action

Choose Stream chat in the studio navigation. Available actions: Choose Chat; Choose Twitch settings; Choose Bot messages; Inspect intake status. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Disconnected; Connecting; Live chat; Local command test. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The conversation is the primary workspace, with moderation and the viewer command reference grouped beside it. Twitch settings and bot messages remain local pages. Viewer guidance describes registration and project IDs without a hard-coded community identity.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamPage.vue](../../../src/plugin/presentation/components/coforge/StreamPage.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `viewer-intake`, `broadcast`.

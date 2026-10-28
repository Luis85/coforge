---
id: "twitch-moderation"
title: "Chat moderation"
goal: "Review and confirm one specific Twitch moderation action."
audience: "streamer"
kind: "panel"
route: "stream moderation details"
parent: "stream-channel"
component: "src/plugin/presentation/components/coforge/TwitchModeration.vue"
entry: ["Within Stream chat → Chat, expand Moderation or choose a moderation action on a Twitch message."]
actions: ["Choose delete, timeout or ban","Review exact target","Confirm or cancel"]
states: ["Missing permission","Draft","Review required","Pending","Failure","Confirmed"]
journeys: ["moderation"]
privacy: "Private vault workspace; excluded from public projections."
---

# Chat moderation

## Purpose

Review and confirm one specific Twitch moderation action.

Deletion targets one Twitch message. Timeout and ban target a named viewer. Preparing a review does not execute the action; confirmation is explicit.

## Entry and next action

Within Stream chat → Chat, expand Moderation or choose a moderation action on a Twitch message. Available actions: Choose delete, timeout or ban; Review exact target; Confirm or cancel. Return through the owning [Chat](stream-channel.md) surface.

## States and recovery

Missing permission; Draft; Review required; Pending; Failure; Confirmed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/TwitchModeration.vue](../../../src/plugin/presentation/components/coforge/TwitchModeration.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `moderation`.

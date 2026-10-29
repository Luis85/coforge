---
id: "twitch-channel"
title: "Twitch channel editor"
goal: "Save the metadata viewers will see on Twitch."
audience: "streamer"
kind: "panel"
route: "Stream chat / Twitch settings / channel metadata"
parent: "[[docs/components/views/stream-connection]]"
component: "src/plugin/presentation/components/coforge/TwitchChannelEditor.vue"
entry: ["Within Stream chat → Twitch settings, use the channel metadata editor."]
actions: ["Edit title, category, tags and language","Save","Open Twitch branding"]
states: ["Disconnected","Missing permission","Draft","Saving","Failure"]
journeys: ["broadcast"]
privacy: "Private vault workspace; excluded from public projections."
---

# Twitch channel editor

## Purpose

Save the metadata viewers will see on Twitch.

Channel updates apply immediately after explicit submission. Images, banners, accents and channel panels remain in Twitch’s editor.

## Entry and next action

Within Stream chat → Twitch settings, use the channel metadata editor. Available actions: Edit title, category, tags and language; Save; Open Twitch branding. Return through the owning [Twitch settings](stream-connection.md) surface.

## States and recovery

Disconnected; Missing permission; Draft; Saving; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/TwitchChannelEditor.vue](../../../src/plugin/presentation/components/coforge/TwitchChannelEditor.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

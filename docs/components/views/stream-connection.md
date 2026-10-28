---
id: "stream-connection"
title: "Twitch settings"
goal: "Connect Twitch and inspect channel readiness."
audience: "streamer"
kind: "subpage"
route: "studio.streamTool = connection"
parent: "stream"
component: "src/plugin/presentation/components/coforge/TwitchChannelControls.vue"
entry: ["Open Stream chat, then choose Twitch settings."]
actions: ["Edit connection settings","Connect or reconnect streamer and chatbot","Save Twitch connection","Reconnect","Update channel metadata","Inspect bot delivery needs attention"]
states: ["Native unavailable","Disconnected","Connecting","Missing scopes","Connected","Error"]
journeys: ["setup","viewer-intake"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"stream","key":"connection"}
---

# Twitch settings

## Purpose

Connect Twitch and inspect channel readiness.

Connection controls are separate from conversation and recurring messages. Connecting alone never enables automated replies or starts a broadcast.

## Entry and next action

Open Stream chat, then choose Twitch settings. Edit the application Client ID, account choice, Receive Twitch chat and automatic-bot-message preferences, then choose **Save Twitch connection**. The connection controls authorize/reconnect the appropriate accounts. **Reconnect** refreshes the connection using saved configuration. Channel metadata is edited in the inline [Twitch channel editor](twitch-channel.md). Return through the owning [Stream chat](stream.md) surface.

## States and recovery

Native unavailable; Disconnected; Connecting; Missing scopes; Connected; Error. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The current channel and connection message lead the settings surface. Authorization, receiving chat and automatic posting are distinct choices. Channel edits remain explicit; an unconfirmed delivery remains available for inspection rather than replay.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/TwitchChannelControls.vue](../../../src/plugin/presentation/components/coforge/TwitchChannelControls.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `viewer-intake`.

---
id: "stream-messages"
title: "Bot messages"
goal: "Maintain the recurring messages sent while live."
audience: "streamer"
kind: "subpage"
route: "studio.streamTool = messages"
parent: "[[docs/components/views/stream]]"
component: "src/plugin/presentation/components/coforge/StreamMessagesView.vue"
entry: ["Open Stream chat, then choose Bot messages."]
actions: ["Create or edit","Set interval","Pause or activate","Delete"]
states: ["No messages","Unsaved","Invalid interval","Paused","Live and enabled"]
journeys: ["viewer-intake","broadcast"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"stream","key":"messages"}
---

# Bot messages

## Purpose

Maintain the recurring messages sent while live.

Messages post only while live and automatic bot messages are enabled. Missed intervals are never replayed.

## Entry and next action

Open Stream chat, then choose Bot messages. Available actions: Create or edit; Set interval; Pause or activate; Delete. Return through the owning [Stream chat](stream.md) surface.

## States and recovery

No messages; Unsaved; Invalid interval; Paused; Live and enabled. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

Message authoring is grouped apart from the retained message list. Each retained message shows state, interval and last confirmed delivery beside its actions. Saving an edit pauses the message for review.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamMessagesView.vue](../../../src/plugin/presentation/components/coforge/StreamMessagesView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `viewer-intake`, `broadcast`.

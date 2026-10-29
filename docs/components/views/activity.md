---
id: "activity"
title: "Studio activity"
goal: "Open the request associated with a recent event."
audience: "streamer"
kind: "panel"
route: "studio.activityOpen = true"
parent: "[[docs/components/views/studio]]"
component: "src/plugin/presentation/components/coforge/ActivityPopover.vue"
entry: ["Choose Recent activity in the studio header."]
actions: ["Inspect event","Open associated request","Close"]
states: ["No events","Event with request","Event without request"]
journeys: ["recovery","request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
---

# Studio activity

The introduction identifies recent changes across projects. Request events open their associated request; events without a request remain informational. The panel receives private studio activity only and is never reused as a public capture.

## Purpose

Open the request associated with a recent event.

Events without a request are informational. Navigation closes the popover; request events open the drawer.

## Entry and next action

Choose Recent activity in the studio header. Available actions: Inspect event; Open associated request; Close. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No events; Event with request; Event without request. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ActivityPopover.vue](../../../src/plugin/presentation/components/coforge/ActivityPopover.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `recovery`, `request-to-recognition`.

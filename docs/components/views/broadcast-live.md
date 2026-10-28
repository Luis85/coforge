---
id: "broadcast-live"
title: "Live broadcast"
goal: "Keep the current broadcast running with visible health and explicit controls."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = live"
parent: "broadcast"
component: "src/plugin/presentation/components/coforge/BroadcastControls.vue"
entry: ["Open Stream studio, then choose Broadcast."]
actions: ["Prepare","Go live","BRB or resume","Stop","Refresh observed state"]
states: ["Disconnected","Off air","Live","BRB","Unknown outcome","Stale health"]
journeys: ["broadcast"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"broadcast","key":"live"}
---

# Live broadcast

## Purpose

Keep the current broadcast running with visible health and explicit controls.

Controls serialize mutations without replaying unknown effects. LiveStudioPanel reports audience, chat activity and OBS source age without changing archive cadence.

## Entry and next action

Open Stream studio, then choose Broadcast. Available actions: Prepare; Go live; BRB or resume; Stop; Refresh observed state. Return through the owning [Stream studio](broadcast.md) surface.

## States and recovery

Disconnected; Off air; Live; BRB; Unknown outcome; Stale health. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/BroadcastControls.vue](../../../src/plugin/presentation/components/coforge/BroadcastControls.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

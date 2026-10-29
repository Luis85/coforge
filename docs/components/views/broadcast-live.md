---
id: "broadcast-live"
title: "Live broadcast"
goal: "Keep the current broadcast running with visible health and explicit controls."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = live"
parent: "[[docs/components/views/broadcast]]"
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

## Presentation and information hierarchy

The broadcast console distinguishes off-air, live and unconfirmed states through both words and theme colors. When disconnected it explains how to open and connect OBS; preparation remains a separate readiness check. Audience, chat and OBS health readings retain their individual source status and age.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/BroadcastControls.vue](../../../src/plugin/presentation/components/coforge/BroadcastControls.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

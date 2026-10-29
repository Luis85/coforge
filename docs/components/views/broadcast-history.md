---
id: "broadcast-history"
title: "Stream history"
goal: "Inspect the archived record for a completed or active stream."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = history"
parent: "broadcast"
component: "src/plugin/presentation/components/coforge/StreamHistoryPanel.vue"
entry: ["Open Stream studio, then choose History."]
actions: ["Choose saved stream","Refresh stream history","Export stream JSON","Open Stream statistics"]
states: ["No records","Selected","Unavailable measurements","Missing intervals"]
journeys: ["broadcast","stream-analysis"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"broadcast","key":"history"}
---

# Stream history

## Purpose

Inspect the archived record for a completed or active stream.

Records retain private one-minute samples. Offline/disconnected intervals are not invented. Stream statistics handles comparisons.

## Entry and next action

Open Stream studio, then choose History. Available actions: Choose saved stream; Refresh stream history; Export stream JSON; Open Stream statistics. Return through the owning [Stream studio](broadcast.md) surface.

## States and recovery

No records; Selected; Unavailable measurements; Missing intervals. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

Choose a recording to inspect samples and observed audience values, export the retained JSON or continue to Stream statistics. Unavailable measurements remain named explicitly.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamHistoryPanel.vue](../../../src/plugin/presentation/components/coforge/StreamHistoryPanel.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`, `stream-analysis`.

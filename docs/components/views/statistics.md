---
id: "statistics"
title: "Stream statistics"
goal: "Compare recorded audience and stream performance."
audience: "streamer"
kind: "page"
route: "studio.view = statistics"
parent: "studio"
component: "src/plugin/presentation/components/coforge/StreamStatisticsView.vue"
entry: ["Choose Statistics in the studio navigation."]
actions: ["Select stream","Choose metric","Compare earlier streams","Inspect sample"]
states: ["No recordings","Unavailable measurement","Missing-data gap","Selected sample","Example"]
journeys: ["stream-analysis"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"statistics"}
---

# Stream statistics

## Purpose

Compare recorded audience and stream performance.

Preserves one-minute samples and missing-data gaps. Comparisons use up to three earlier completed streams on the same channel.

## Entry and next action

Choose Statistics in the studio navigation. Available actions: Select stream; Choose metric; Compare earlier streams; Inspect sample. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No recordings; Unavailable measurement; Missing-data gap; Selected sample; Example. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamStatisticsView.vue](../../../src/plugin/presentation/components/coforge/StreamStatisticsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `stream-analysis`.

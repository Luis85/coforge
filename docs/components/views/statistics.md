---
id: statistics
title: Stream statistics
goal: Compare recorded audience and stream performance.
audience: streamer
kind: page
route: studio.view = statistics
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/StreamStatisticsView.vue
entry:
  - Choose Statistics in the studio navigation.
actions:
  - Select stream
  - Choose metric
  - Compare earlier streams
  - Inspect sample
states:
  - No recordings
  - Unavailable measurement
  - Missing-data gap
  - Selected sample
  - Example
journeys:
  - stream-analysis
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: statistics
order: 80000
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

# Stream statistics

## Purpose

Compare recorded audience and stream performance.

Preserves one-minute samples and missing-data gaps. Comparisons use up to three earlier completed streams on the same channel.

## Entry and next action

Choose Statistics in the studio navigation. Available actions: Select stream; Choose metric; Compare earlier streams; Inspect sample. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No recordings; Unavailable measurement; Missing-data gap; Selected sample; Example. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The selected recording leads with mean and peak observed viewers, observed Twitch messages and missing recorded minutes. These summaries use retained observations. The selected metric shows available and unavailable observation counts before the chart; unavailable values stay distinct from zero. Comparison recordings and exact sample inspection remain available below.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamStatisticsView.vue](../../../src/plugin/presentation/components/coforge/StreamStatisticsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `stream-analysis`.

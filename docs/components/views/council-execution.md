---
id: "council-execution"
title: "Council execution controls"
goal: "Choose whether this desktop may execute Council work."
audience: "streamer"
kind: "panel"
route: "Council executor controls"
parent: "council-monitor"
component: "src/plugin/presentation/components/coforge/CouncilExecutionControls.vue"
entry: ["Within The Council → Run monitor, use the inline Execution controls section."]
actions: ["Check runtime","Designate desktop","Pause or resume execution","Pause or resume selected project"]
states: ["Native not ready","No executor","Paused","Resumed","Project paused"]
journeys: ["Council","recovery"]
privacy: "Private vault workspace; excluded from public projections."
---

# Council execution controls

## Purpose

Choose whether this desktop may execute Council work.

Only one designated desktop executes while active. Reload pauses execution and unknown outcomes remain held for explicit recovery.

## Entry and next action

Within The Council → Run monitor, use the inline Execution controls section. Available actions: Check runtime; Designate desktop; Pause or resume execution; Pause or resume selected project. Return through the owning [Council run monitor](council-monitor.md) surface.

## States and recovery

Native not ready; No executor; Paused; Resumed; Project paused. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilExecutionControls.vue](../../../src/plugin/presentation/components/coforge/CouncilExecutionControls.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`, `recovery`.

---
id: council-execution
title: Council execution controls
goal: Choose whether this desktop may execute Council work.
audience: streamer
kind: panel
route: Council executor controls
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/CouncilExecutionControls.vue
entry:
  - Use the inline Execution controls on Ask the Council or Advanced Council tools → Run monitor.
actions:
  - Check runtime
  - Designate desktop
  - Pause or resume execution
  - Pause or resume selected project
states:
  - Native not ready
  - No executor
  - Paused
  - Resumed
  - Project paused
journeys:
  - Council
  - recovery
privacy: Private vault workspace; excluded from public projections.
order: 47000
type: PBI
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

# Council execution controls

## Purpose

Choose whether this desktop may execute Council work.

Only one designated desktop executes while active. Reload pauses execution and unknown outcomes remain held for explicit recovery.

## Entry and next action

Use the inline Execution controls on [Ask the Council](council-ask.md) or Advanced Council tools → [Run monitor](council-monitor.md). Available actions: Check runtime; Designate desktop; Pause or resume execution; Pause or resume selected project. Return through the owning [The Council](council.md) surface.

## States and recovery

Native not ready; No executor; Paused; Resumed; Project paused. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilExecutionControls.vue](../../../src/plugin/presentation/components/coforge/CouncilExecutionControls.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`, `recovery`.

## Workspace redesign

Execution controls remain separate from editable definitions and local task-note creation. One instance is rendered on the active Ask or monitor page, so the current executor and paused state remain clear without duplicated controls. Saving a question does not designate a device or resume execution.

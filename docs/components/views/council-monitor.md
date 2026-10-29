---
id: council-monitor
title: Council run monitor
goal: Resolve the next action or recovery decision for a Council run.
audience: streamer
kind: subpage
route: council.tab = monitor
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/CouncilMonitor.vue
entry:
  - Open The Council, expand Advanced Council tools, then choose Run monitor.
actions:
  - Check and designate executor
  - Pause or resume
  - Filter and inspect
  - Resolve checkpoint
  - Recover unknown result
  - Retry publication
  - Export evidence
states:
  - No runs
  - Paused
  - Queued
  - Running
  - Checkpoint
  - Unknown outcome
  - Publication conflict
  - Completed
journeys:
  - Council
  - recovery
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: council
  key: monitor
order: 51000
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

# Council run monitor

## Purpose

Resolve the next action or recovery decision for a Council run.

Contributions persist and project before the next invocation. Unknown provider outcomes require explicit recovery without replay. Plan handoff does not accept code or publish an Idea.

## Entry and next action

Open The Council, expand Advanced Council tools, then choose Run monitor. Available actions: Check and designate executor; Pause or resume; Filter and inspect; Resolve checkpoint; Recover unknown result; Retry publication; Export evidence. Return through the owning [The Council](council.md) surface.

## States and recovery

No runs; Paused; Queued; Running; Checkpoint; Unknown outcome; Publication conflict; Completed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilMonitor.vue](../../../src/plugin/presentation/components/coforge/CouncilMonitor.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`, `recovery`.

## Workspace redesign

Run records and expandable evidence use a consistent execution ledger. Attention and recovery controls remain close to the inspected run; no count is presented as proof of a successful provider effect.

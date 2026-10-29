---
id: council-workflows
title: Council workflows
goal: Save an explicit proposal workflow for this project.
audience: streamer
kind: subpage
route: council.tab = workflows
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/WorkflowV2Editor.vue
entry:
  - Open The Council, expand Advanced Council tools, then choose Council workflows.
actions:
  - Load saved
  - Edit steps and collections
  - Preview import or export
  - Save or discard
states:
  - No project
  - No saved definition
  - Unsaved draft
  - Validation error
  - Stale revision
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: council
  key: workflows
order: 56000
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

# Council workflows

## Purpose

Save an explicit proposal workflow for this project.

Version 2 composes reusable agents, councils and checkpoints. Generic note subjects have no votes or rewards. Editable definitions cannot bypass host review.

## Entry and next action

Open The Council, expand Advanced Council tools, then choose Council workflows. Available actions: Load saved; Edit steps and collections; Preview import or export; Save or discard. Return through the owning [The Council](council.md) surface.

## States and recovery

No project; No saved definition; Unsaved draft; Validation error; Stale revision. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowV2Editor.vue](../../../src/plugin/presentation/components/coforge/WorkflowV2Editor.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

The proposal workflow shares the catalogue and authoring workspace visual language with reusable definitions. Its typed input and checkpoint controls remain separate from ordinary project workflow execution.

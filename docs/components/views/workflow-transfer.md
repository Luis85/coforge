---
id: workflow-transfer
title: Workflow import and export
goal: Review a portable definition before replacing or sharing it.
audience: streamer
kind: panel
route: workflow transfer preview
parent: "[[docs/components/views/workflow-settings]]"
component: src/plugin/presentation/components/coforge/WorkflowDefinitionTransfer.vue
entry:
  - Within Workflow settings, choose Import JSON or Preview workflow export.
actions:
  - Paste JSON
  - Validate and preview
  - Apply draft
  - Preview export
states:
  - Closed
  - Invalid import
  - Valid preview
  - Export ready
journeys:
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
order: 93000
type: Task
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

# Workflow import and export

## Purpose

Review a portable definition before replacing or sharing it.

Exports include definitions and authored prompts but exclude credentials, paths, history and recovery state. Applying import only changes the draft.

## Entry and next action

Within Workflow settings, choose Import JSON or Preview workflow export. Available actions: Paste JSON; Validate and preview; Apply draft; Preview export. Return through the owning [Workflow settings](workflow-settings.md) surface.

## States and recovery

Closed; Invalid import; Valid preview; Export ready. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowDefinitionTransfer.vue](../../../src/plugin/presentation/components/coforge/WorkflowDefinitionTransfer.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `workflow-configuration`.

## Workspace redesign

Import and export use a focused inspection surface with literal JSON. Import still replaces only the editor draft after preview; save remains explicit.

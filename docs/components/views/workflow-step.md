---
id: "workflow-step"
title: "Workflow step editor"
goal: "Configure one stable workflow step."
audience: "streamer"
kind: "panel"
route: "studio.workflowStepSelection"
parent: "workflow-settings"
component: "src/plugin/presentation/components/coforge/WorkflowStepEditor.vue"
entry: ["Open Workflow settings, then select a step in the step list."]
actions: ["Rename","Choose kind","Edit contract and access","Edit prompt or checklist"]
states: ["No selection","AI","Manual checkpoint","Invalid contract","Unsaved"]
journeys: ["workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
---

# Workflow step editor

## Purpose

Configure one stable workflow step.

Contracts and access remain separate from identity and ordering. Edits stay in the workflow draft until an explicit save.

## Entry and next action

Open Workflow settings, then select a step in the step list. Available actions: Rename; Choose kind; Edit contract and access; Edit prompt or checklist. Return through the owning [Workflow settings](workflow-settings.md) surface.

## States and recovery

No selection; AI; Manual checkpoint; Invalid contract; Unsaved. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowStepEditor.vue](../../../src/plugin/presentation/components/coforge/WorkflowStepEditor.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `workflow-configuration`.

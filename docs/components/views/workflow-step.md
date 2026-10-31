---
id: workflow-step
title: Workflow step editor
goal: Configure one stable workflow step.
audience: streamer
kind: panel
route: studio.workflowStepSelection
parent: "[[docs/components/views/workflow-settings]]"
component: src/plugin/presentation/components/coforge/WorkflowStepEditor.vue
entry:
  - Open Workflow settings, then select a step in the step list.
actions:
  - Select and edit a bucket
  - Move a step to another bucket
  - Rename
  - Choose kind
  - Edit contract and access
  - Edit prompt or checklist
  - Choose or clear an answer template
states:
  - No selection
  - AI
  - Manual checkpoint
  - Invalid contract
  - Unsaved
journeys:
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
order: 92000
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

# Workflow step editor

## Purpose

Configure one stable workflow step.

Contracts and access remain separate from identity and ordering. Edits stay in the workflow draft until an explicit save.

The shared panel edits a selected bucket's label/description or a selected step.
The **Bucket** selector moves a step to the end of another nonterminal bucket;
row controls reorder it within its current bucket. IDs and required inputs remain
unchanged. Moving work can invalidate dependencies, which must be repaired before
Save. Accepted remains an outcome with no executable steps. Panel headings,
labels, help, disclosures and native fields share a consistent left/start edge.

## Entry and next action

Open Workflow settings, then select a step in the step list. Available actions: Rename; Choose kind; Edit contract and access; Edit prompt or checklist. Return through the owning [Workflow settings](workflow-settings.md) surface.

## States and recovery

No selection; AI; Manual checkpoint; Invalid contract; Unsaved. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowStepEditor.vue](../../../src/plugin/presentation/components/coforge/WorkflowStepEditor.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `workflow-configuration`.

## Workspace redesign

A distinct step catalogue gives selected steps a shared accent surface; the editor keeps its stable reference and AI or manual controls. At narrow pane widths catalogue and editor stack.

AI steps lead with authored instructions and their answer format. Select one
optional project [Markdown template](workflow-output-templates.md); a missing
selection stays visible with a repair instruction. The result contract remains
separate from template guidance. Advanced agent/access and execution settings are
grouped in disclosures, while required inputs still validate against preceding
producers. Step IDs remain stable through duplicate, reorder and rename operations
according to their existing semantics (a duplicate receives its own identity).

Collapsed settings retain visible provider/model, access and automatic/manual
summaries. A selected template has a read-only Markdown source preview independent
of any other template currently being edited in the library. The workflow's
validation summary names the affected step and opens/focuses its repair target,
including hidden model settings, previous-result dependencies, timing limits and
specific checklist items. These repair actions preserve the draft and never save
or dispatch work.

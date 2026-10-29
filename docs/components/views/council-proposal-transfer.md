---
id: council-proposal-transfer
title: Proposal workflow transfer
goal: Review a portable v2 proposal workflow before applying it.
audience: streamer
kind: panel
route: Council workflows / transfer preview
parent: "[[docs/components/views/council-workflows]]"
component: src/plugin/presentation/components/coforge/WorkflowV2Transfer.vue
entry:
  - Within The Council → Council workflows, open the workflow transfer controls.
actions:
  - Preview import
  - Apply draft
  - Preview export
states:
  - Invalid import
  - Valid preview
  - Unsaved draft
  - Export ready
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
order: 57000
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

# Proposal workflow transfer

## Purpose

Review a portable v2 proposal workflow before applying it.

Transfer changes definitions rather than executing them. Host permissions and final review remain authoritative.

## Entry and next action

Within The Council → Council workflows, open the workflow transfer controls. Available actions: Preview import; Apply draft; Preview export. Return through the owning [Council workflows](council-workflows.md) surface.

## States and recovery

Invalid import; Valid preview; Unsaved draft; Export ready. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowV2Transfer.vue](../../../src/plugin/presentation/components/coforge/WorkflowV2Transfer.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Proposal transfer uses the Council inspection disclosure hierarchy, literal source and explicit draft replacement. Imported definitions never start execution.

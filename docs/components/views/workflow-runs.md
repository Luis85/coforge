---
id: workflow-runs
title: Workflow runs
goal: Resolve the next checkpoint or attempt outcome.
audience: streamer
kind: subpage
route: studio.workflowTool = runs
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/ConfiguredWorkflowExecution.vue
entry:
  - Open Agent workflow, then choose Workflow runs.
actions:
  - Select request run
  - Inspect captured steps and results
  - Complete required checklist
  - Inspect attempt history
  - Recover Herdr attempt
states:
  - No runs
  - Queued
  - Running
  - Human checkpoint
  - Failed
  - Complete
journeys:
  - request-to-recognition
  - recovery
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: workflow
  key: runs
order: 89000
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

# Workflow runs

## Purpose

Resolve the next checkpoint or attempt outcome.

Checkpoints do not occupy the AI worker and do not accept code. Attempts retain exact definitions and provider selections. Herdr recovery requires correlated results.

## Entry and next action

Open Agent workflow, then choose Workflow runs. Available actions: Select request run; Inspect captured steps and results; Complete required checklist; Inspect attempt history; Recover Herdr attempt. Return through the owning [Agent workflow](workflow.md) surface.

## States and recovery

No runs; Queued; Running; Human checkpoint; Failed; Complete. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ConfiguredWorkflowExecution.vue](../../../src/plugin/presentation/components/coforge/ConfiguredWorkflowExecution.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `recovery`.

## Workspace redesign

The request title and current run state lead the execution workspace. Completed and current steps have distinct surfaces, while attempt details remain expandable and failures remain visible.

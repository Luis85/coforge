---
id: herdr-recovery
title: Herdr workflow recovery
goal: Resolve the uncertain outcome of a managed workflow attempt.
audience: streamer
kind: panel
route: pending Herdr workflow attempt
parent: "[[docs/components/views/workflow-runs]]"
component: src/plugin/presentation/components/coforge/HerdrWorkflowRecovery.vue
entry:
  - Within Agent workflow → Workflow runs, inspect the pending Herdr attempt recovery panel.
actions:
  - Refresh correlated result
  - Inspect attempt
  - Acknowledge recovery
states:
  - No pending attempt
  - Waiting
  - Unknown outcome
  - Stale result
  - Recoverable
journeys:
  - recovery
privacy: Private vault workspace; excluded from public projections.
order: 90000
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

# Herdr workflow recovery

## Purpose

Resolve the uncertain outcome of a managed workflow attempt.

Terminal text cannot complete work. Attempt, project, revision, nonce and settling evidence must match before structured results apply.

## Entry and next action

Within Agent workflow → Workflow runs, inspect the pending Herdr attempt recovery panel. Available actions: Refresh correlated result; Inspect attempt; Acknowledge recovery. Return through the owning [Workflow runs](workflow-runs.md) surface.

## States and recovery

No pending attempt; Waiting; Unknown outcome; Stale result; Recoverable. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/HerdrWorkflowRecovery.vue](../../../src/plugin/presentation/components/coforge/HerdrWorkflowRecovery.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `recovery`.

## Workspace redesign

Recovery receives the shared attention surface while preserving exact task evidence and explicit acknowledgement. No interface change retries an uncertain external action.

---
id: workflow-attempts
title: Step attempts
goal: Inspect project-wide agent job outcomes without selecting a request run.
audience: streamer
kind: subpage
route: studio.workflowTool = runs
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/WorkflowHistory.vue
entry:
  - Open Project settings, Agent workflow, then Step attempts.
actions:
  - Inspect attempt status and logs
  - Inspect recorded cost and usage
  - Cancel eligible active work
states:
  - No attempts
  - Queued or running
  - Completed, failed or cancelled
journeys:
  - request-to-recognition
  - recovery
privacy: Private project job evidence; excluded from public projections.
coverage:
  group: workflow
  key: runs
order: 89000
---

# Step attempts

## Purpose

Inspect this project's durable job history, recorded outcomes, logs and usage.
The retained internal `runs` key now labels this tab Step attempts. Request-level
captured workflow steps, checkpoints and prior runs belong to the selected
request's [Workflow runs](workflow-runs.md) tab.

## Entry and next action

Open Project settings → Agent workflow → Step attempts, then inspect a job's
status, log and recorded usage. Cancel an eligible active job explicitly.

## States and recovery

No attempts; Queued; Running; Completed; Failed; Cancelled. Inspection never starts
another attempt. Failed or uncertain work requires its existing recovery controls;
cancellation preserves evidence.

## Composition and boundaries

Source: [WorkflowHistory.vue](../../../src/plugin/presentation/components/coforge/WorkflowHistory.vue).
This project-wide job view remains separate from request-specific execution.

---
id: workflow-limits
title: Timing and limits
goal: Configure the timing and native CLI bounds captured by future workflow runs.
audience: streamer
kind: subpage
route: studio.workflowTool = limits
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/WorkflowDefinitionLimits.vue
entry:
  - Open Project settings, Agent workflow, then Timing & limits.
actions:
  - Adjust cadence, timeout, turns and budget
  - Save or discard the shared workflow draft
states:
  - Saved
  - Unsaved draft
  - Invalid limits
journeys:
  - workflow-configuration
privacy: Private project configuration; excluded from public projections.
coverage:
  group: workflow
  key: limits
order: 90000
---

# Timing and limits

## Purpose

Timing & limits exposes its fields directly in the flat Agent workflow tab row.
It shares one mounted draft and explicit Save with [Idea Board Workflow](workflow-settings.md).
Switching between these tabs preserves pending edits; saving prepares future runs
and leaves existing captured limits and current Play/Pause state intact.

## Entry and next action

Open Project settings → Agent workflow → Timing & limits. Adjust bounds, inspect
validation, then explicitly Save workflow or discard the shared draft.

## States and recovery

Saved; Unsaved draft; Invalid limits. Failed saves keep the draft and saved
configuration. Repair links reveal and focus the affected field.

## Composition and boundaries

Source: [WorkflowDefinitionLimits.vue](../../../src/plugin/presentation/components/coforge/WorkflowDefinitionLimits.vue).
Native CLI limits do not impose spending caps on an interactive Herdr agent.

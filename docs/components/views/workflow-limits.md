---
id: workflow-limits
title: Earlier agent behavior link
goal: Understand managed agent sessions when opening an earlier timing link.
audience: streamer
kind: panel
route: "compatibility: studio.workflowTool = limits (read-only)"
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/WorkflowDefinitionLimits.vue
entry:
  - Follow an earlier retained Timing and limits link.
actions:
  - Read how agent sessions complete
  - Return to Idea Board Workflow
states:
  - Managed session explanation
  - Earlier captured configuration retained
journeys:
  - workflow-configuration
privacy: Private project configuration; excluded from public projections.
order: 90000
---

# Earlier agent behavior link

## Purpose

Retained timing links open a read-only explanation of managed agent sessions.
Timing and limits is absent from ordinary Agent workflow navigation. New native
sessions follow completion and connection state, without task duration, turn or
USD controls. Quiet periods do not end a task; Stop and human review remain.

## Entry and next action

Follow an earlier retained timing link, then return to
[Idea Board Workflow](workflow-settings.md) to edit steps or agent instructions.
This explanation does not edit the shared workflow draft or start an agent.

## States and recovery

Earlier captured limits remain available in each request's recorded configuration.
Opening this compatibility panel does not upgrade an existing attempt or change
its captured values. Current Play/Pause and operator Stop holds remain authoritative.

## Composition and boundaries

Source: [WorkflowDefinitionLimits.vue](../../../src/plugin/presentation/components/coforge/WorkflowDefinitionLimits.vue).
This panel is a compatibility destination, not a visible workflow navigation tab.
Council and Herdr keep their separate execution contracts.

---
id: "workflow"
title: "Agent workflow"
goal: "Resolve the next execution decision for this project."
audience: "streamer"
kind: "page"
route: "studio.view = workflow"
parent: "studio"
component: "src/plugin/presentation/components/coforge/WorkflowView.vue"
entry: ["Choose Agent workflow in the studio navigation."]
actions: ["Inspect execution","Complete checkpoint","Pause or resume","Inspect history","Open Workflow settings"]
states: ["No project","No active work","Queued","Running","Checkpoint","Failed or uncertain result"]
journeys: ["request-to-recognition","workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"workflow"}
---

# Agent workflow

## Purpose

Resolve the next execution decision for this project.

Monitors saved workflow execution; configuration lives in Workflow settings. Actual code changes still require final streamer review.

## Entry and next action

Choose Agent workflow in the studio navigation. Available actions: Inspect execution; Complete checkpoint; Pause or resume; Inspect history; Open Workflow settings. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; No active work; Queued; Running; Checkpoint; Failed or uncertain result. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowView.vue](../../../src/plugin/presentation/components/coforge/WorkflowView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `workflow-configuration`.

## Workspace redesign

The selected-project band precedes execution navigation. A prominent automation strip, selected request heading and captured-step sequence separate control state, work in progress and durable attempt evidence.

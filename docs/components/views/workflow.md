---
id: "workflow"
title: "Agent workflow"
goal: "Manage this project's agent process from configuration through execution."
audience: "streamer"
kind: "page"
route: "studio.view = workflow"
parent: "[[docs/components/views/studio]]"
component: "src/plugin/presentation/components/coforge/WorkflowView.vue"
entry: ["Choose Agent workflow in the studio navigation."]
actions: ["Inspect execution","Complete checkpoint","Pause or resume","Inspect history","Configure workflow","Manage Herdr workspaces"]
states: ["No project","No active work","Queued","Running","Checkpoint","Failed or uncertain result"]
journeys: ["request-to-recognition","workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"workflow"}
---

# Agent workflow

## Purpose

Manage this project's agent process from configuration through execution.

One workspace groups Workflow runs, Herdr workspaces and [Workflow settings](workflow-settings.md) as focused local tasks. Configuration defines future work; monitoring shows captured execution evidence. Actual code changes still require final streamer review.

## Entry and next action

Choose Agent workflow in the studio navigation, then select Workflow runs, Herdr workspaces or Workflow settings. Available actions: Inspect execution; Complete checkpoint; Pause or resume; Inspect history; Configure workflow; Manage Herdr workspaces. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; No active work; Queued; Running; Checkpoint; Failed or uncertain result. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowView.vue](../../../src/plugin/presentation/components/coforge/WorkflowView.vue). This parent owns the Agent workflow H1, shared page frame and local navigation. All three tasks share that frame. Workflow settings embeds its editor with an H2; the compatibility settings locator still renders this same parent workspace and keeps Agent workflow current in the global navigation.

Journey tags: `request-to-recognition`, `workflow-configuration`.

## Workspace redesign

The selected-project band precedes execution navigation. A prominent automation strip, selected request heading and captured-step sequence separate control state, work in progress and durable attempt evidence.

For a selected external MCP run, the strip names the external client and explicit
client calls. Project automation does not advance that run. Its captured native
provider/model configuration remains visible as definition context in the tooltip;
it is not presented as the provider that actually executed the MCP work. Native
runs retain their configured provider labels, automatic-step count and cadence.

---
id: workflow
title: Agent workflow
goal: Manage this project's agent process from configuration through execution.
audience: streamer
kind: subpage
route: "studio.settingsTool = workflow (compatibility: studio.view = workflow)"
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/WorkflowView.vue
entry:
  - Choose Project settings at the bottom of navigation, then Agent workflow.
actions:
  - Inspect execution
  - Complete checkpoint
  - Pause or resume
  - Inspect history
  - Configure workflow
  - Manage Herdr workspaces
states:
  - No project
  - No active work
  - Queued
  - Running
  - Checkpoint
  - Failed or uncertain result
journeys:
  - request-to-recognition
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  - group: studio
    key: workflow
  - group: settings
    key: workflow
order: 87000
type: Feature
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

# Agent workflow

## Purpose

Manage this project's agent process from configuration through execution.

One workspace groups Workflow runs, Herdr workspaces and [Workflow settings](workflow-settings.md) as focused local tasks. Configuration defines future work; monitoring shows captured execution evidence. Actual code changes still require final streamer review.

## Entry and next action

Choose Project settings at the bottom of navigation, then Agent workflow. Select Workflow runs, Herdr workspaces or Workflow settings. Available actions: Inspect execution; Complete checkpoint; Pause or resume; Inspect history; Configure workflow; Manage Herdr workspaces. Return through the owning [Project settings](settings.md) surface.

## States and recovery

No project; No active work; Queued; Running; Checkpoint; Failed or uncertain result. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowView.vue](../../../src/plugin/presentation/components/coforge/WorkflowView.vue), embedded inside Project settings. The settings page owns the H1 and Agent workflow owns its subordinate heading and local navigation. Workflow runs, Herdr workspaces and Workflow settings share this frame. Existing workflow locators select this same nested workspace and keep Project settings current in main navigation.

Journey tags: `request-to-recognition`, `workflow-configuration`.

## Workspace redesign

A prominent automation strip, selected request heading and captured-step sequence separate control state, work in progress and durable attempt evidence. The project switcher identifies the selected project; navigation never starts execution.

For a selected external MCP run, the strip names the external client and explicit
client calls. Project automation does not advance that run. Its captured native
provider/model configuration remains visible as definition context in the tooltip;
it is not presented as the provider that actually executed the MCP work. Native
runs retain their configured provider labels, automatic-step count and cadence.

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
  - Pause or resume
  - Inspect step attempts
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

One row contains Idea Board Workflow, Step attempts, Answer / output templates and Herdr, in that order. Configuration defines future work; Step attempts shows project-wide job evidence. Open a request's [Workflow runs](workflow-runs.md) detail tab for its captured process, checkpoints and retained history. Actual code changes still require final streamer review.

## Entry and next action

Choose Project settings at the bottom of navigation, then Agent workflow. Configure the process, inspect Step attempts, maintain templates or manage Herdr. Pause or resume changes the current project automation state. The startup preference inside Idea Board Workflow takes effect only when CoForge reopens.

## States and recovery

No project; No active work; Queued; Running; Checkpoint; Failed or uncertain result. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [WorkflowView.vue](../../../src/plugin/presentation/components/coforge/WorkflowView.vue), embedded inside Project settings. Existing workflow locators select this same workspace and keep Project settings current in main navigation. Definition edits retain one mounted draft and explicit Save; templates save independently. Earlier timing links open a read-only compatibility explanation rather than another navigation tab.

Journey tags: `request-to-recognition`, `workflow-configuration`.

## Workspace redesign

A current automation control stays above the flat local tabs. The project switcher identifies the selected project; navigation never starts execution. Request-specific execution controls and captured steps live in request details.

In request details, a selected external MCP run names the external client and explicit
client calls. Project automation does not advance that run. Its captured native
provider/model configuration remains visible as definition context in the tooltip;
it is not presented as the provider that actually executed the MCP work. Native
runs retain their configured provider labels, automatic-step count and cadence.

---
id: settings
title: Project settings
goal: Configure the selected project and manage its agent workflow.
audience: streamer
kind: page
route: studio.view = settings
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/SettingsView.vue
entry:
  - Choose Project settings at the bottom of the studio navigation.
actions:
  - Edit brief and prompt
  - Configure repository
  - Save or discard
  - Manage Agent workflow
  - Inspect runtime
  - Use backup and sample tools
states:
  - No project
  - Saved
  - Unsaved
  - Saving
  - Invalid draft
  - Pending-work guard
journeys:
  - setup
  - multi-project
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: settings
order: 74000
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

# Project settings

## Purpose

Configure the selected project and manage its agent workflow.

General, Requests, Repository, Agent workflow, Runtime and Data & examples divide settings into focused tasks. Canonical project-note saves preserve unrelated properties and Markdown body. Provider steps, models and limits live in Agent workflow → Workflow settings.

[Request Object](settings-request-object.md) configures the frontmatter class and optional typed fields for new requests. Existing request notes retain their captured format; no migration runs when this project definition changes.

## Entry and next action

Choose Project settings at the bottom of the studio navigation. It remains reachable when the task groups collapse and stays current while any nested task is open. Choose a local task, edit its configuration and save explicitly. Runtime checks and data tools have their own actions; opening them does not dispatch work. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; Saved; Unsaved; Saving; Invalid draft; Pending-work guard. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsView.vue](../../../src/plugin/presentation/components/coforge/SettingsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `multi-project`, `workflow-configuration`.

## Workspace redesign

The project switcher retains project identity and private visibility. One Project settings H1 frames local tasks with labelled navigation, subordinate headings and a retained settings draft. General, Requests and Repository share an explicit save boundary; workflow authoring has its own save boundary. Guarded navigation and project changes preserve dirty drafts. Runtime shows observed capabilities, and Data & examples labels all-project backup separately from selected-project replacement.

## Project privacy

The Project visibility field saves a canonical public/private choice independently of immutable active agent configuration. A failed revocation keeps the draft and a separate publication-blocked state; restoring publication requires an explicit successful public reconciliation.

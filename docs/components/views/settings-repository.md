---
id: settings-repository
title: Project repository settings
goal: Set the repository boundary used by agent work.
audience: streamer
kind: subpage
route: studio.settingsTool = repository
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsRepositorySection.vue
entry:
  - Open Project settings, then Repository.
actions:
  - Edit workspace and repository fields
  - Review implementation authorization
  - Save project settings
states:
  - Missing path
  - Invalid workspace
  - Authorization disabled
  - Unsaved
  - Saved
journeys:
  - setup
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: settings
  key: repository
order: 77000
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

# Project repository settings

## Purpose

Set the repository boundary used by agent work.

Build edits stay in a separate worktree. A general prompt and editable workflow cannot widen the host’s repository permissions.

## Entry and next action

Open Project settings, choose Repository, then edit the Agent workspace fields. Available actions: Edit workspace and repository fields; Review implementation authorization; Save project settings. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Missing path; Invalid workspace; Authorization disabled; Unsaved; Saved. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsRepositorySection.vue](../../../src/plugin/presentation/components/coforge/SettingsRepositorySection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `workflow-configuration`.

## Workspace redesign

Repository configuration shares the larger project-settings section heading and spacing while paths retain literal formatting and existing permission boundaries.

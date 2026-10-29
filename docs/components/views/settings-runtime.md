---
id: settings-runtime
title: Project runtime check
goal: Verify the native runtime is available for this project.
audience: streamer
kind: subpage
route: studio.settingsTool = runtime
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue
entry:
  - Open Project settings, Runtime, then Check Claude Code.
actions:
  - Check runtime
  - Inspect readiness or error
states:
  - Not checked
  - Checking
  - Ready
  - Native unavailable
  - Check failed
journeys:
  - setup
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: settings
  key: runtime
order: 79000
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

# Project runtime check

## Purpose

Verify the native runtime is available for this project.

Runtime diagnostics do not start workflow execution or expand permissions.

## Entry and next action

Open Project settings, choose Runtime, inspect Local connections and choose Check Claude Code. Available actions: Check runtime; Inspect readiness or error. Repository paths and implementation authorization are configured under Repository; Herdr workspaces are under Agent workflow. Native executable configuration and credentials remain in Obsidian’s CoForge integration settings. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Not checked; Checking; Ready; Native unavailable; Check failed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue](../../../src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `workflow-configuration`.

## Workspace redesign

Runtime observations use an aligned evidence list with tabular numeric treatment. Observed capabilities remain separate from saved configuration.

---
id: settings-runtime
title: Local connections
goal: Inspect observed local runtime, repository access and community chat readiness.
audience: streamer
kind: subpage
route: studio.settingsTool = runtime
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue
entry:
  - Open Project settings, Runtime, then Check Claude Code.
actions:
  - Check Claude Code
  - Inspect observed readiness
  - Configure repository
  - Manage Herdr workspaces
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

# Local connections

## Purpose

Inspect observed local runtime, repository access and community chat readiness.

The Runtime subpage displays Local connections: native Claude Code availability, the saved game repository, saved implementation permission and community chat status. The chat observation is channel-wide; the repository and implementation permission belong to the selected project. Unsaved General, Requests and Repository drafts do not change this evidence. Runtime diagnostics do not start workflow execution or expand permissions.

## Entry and next action

Open Project settings, choose Runtime, inspect Local connections and choose Check Claude Code. Configure repository opens the local Repository task; Manage Herdr workspaces opens Agent workflow → Herdr workspaces. These actions retain the shared settings draft and navigate without saving or starting a provider request. Native executable configuration and credentials remain in Obsidian’s CoForge integration settings. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Not checked; Checking; Ready; Native unavailable; Check failed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue](../../../src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `workflow-configuration`.

## Workspace redesign

Runtime observations use an aligned evidence list. Literal saved paths use monospace; a missing-path explanation uses normal text. Observed capabilities remain separate from saved configuration, with direct navigation to the controls that can resolve a missing setup.

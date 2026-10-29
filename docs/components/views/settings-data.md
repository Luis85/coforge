---
id: settings-data
title: Backup and sample tools
goal: Export a private studio backup or explicitly replace this project’s requests with sample data.
audience: streamer
kind: subpage
route: studio.settingsTool = data
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsDataSection.vue
entry:
  - Open Project settings, then Data & examples.
actions:
  - Export private JSON backup
  - Request sample replacement
  - Keep data or confirm replacement
states:
  - Ready
  - Confirmation required
  - Pending work blocks replacement
  - Failure
journeys:
  - setup
  - recovery
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: settings
  key: data
order: 75000
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

# Backup and sample tools

## Purpose

Export a private studio backup or explicitly replace this project’s requests with sample data.

Private backup includes all projects, ideas, plans, settings and activity in the plugin folder. Confirmed sample loading replaces this project’s requests, moves its notes to vault trash and pauses its automation. Other projects and shared chat stay intact.

## Entry and next action

Open Project settings, choose Data & examples, then use Backup and sample tools. Available actions: Export private JSON backup; Request sample replacement; Keep data or confirm replacement. The backup covers the entire private studio; sample replacement targets the selected project. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Ready; Confirmation required; Pending work blocks replacement; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsDataSection.vue](../../../src/plugin/presentation/components/coforge/SettingsDataSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `recovery`.

## Workspace redesign

Backup and sample tools occupy a distinct data surface. Destructive sample replacement retains its exact-target confirmation and pending-work guard.

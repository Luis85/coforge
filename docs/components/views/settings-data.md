---
id: settings-data
title: Data & examples
goal: Export a private studio backup, load sample content or review example cleanup.
audience: streamer
kind: subpage
route: studio.settingsTool = data
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsDataSection.vue
entry:
  - Open Project settings, then Data & examples.
actions:
  - Export private studio backup
  - Load sample workspace
  - Keep my data
  - Preview example cleanup
states:
  - Ready
  - Confirmation required
  - Pending work blocks replacement
  - Unsaved project changes block sample loading
  - No project
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

# Data & examples

## Purpose

Export a private studio backup, load sample content or review example cleanup.

Private backup includes all projects, ideas, plans, settings and activity in the plugin folder. With a selected project, confirmed sample loading replaces this project’s requests, moves its notes to vault trash and pauses its automation. Other projects and shared chat stay intact. Without a project, the explicit confirmation creates the illustrative Mosslight project and sample requests with automation paused. Example cleanup has a separate preview and confirmation.

## Entry and next action

Open Project settings and choose Data & examples. Choose Export private studio backup, Load sample workspace or Preview example cleanup. The sample confirmation offers Keep my data and Load sample workspace. The backup covers the entire private studio; sample replacement names its selected-project target. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Ready; Confirmation required; Pending work blocks replacement; Unsaved project changes block sample loading; No project; Failure. Save or discard the shared project draft before loading sample content. The confirmation describes project replacement when a project exists and sample-project creation otherwise. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsDataSection.vue](../../../src/plugin/presentation/components/coforge/SettingsDataSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `recovery`.

## Workspace redesign

Data & examples occupies a distinct data surface. Destructive sample replacement retains its exact-target confirmation, dirty-draft protection and pending-work guard. The Finish experimenting section opens the separately documented [Example content cleanup](settings-example-cleanup.md) preview.

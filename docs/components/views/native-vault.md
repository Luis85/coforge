---
id: native-vault
title: Ideas folder setting
goal: Choose where canonical idea notes live.
audience: streamer
kind: panel
route: native settings / Vault
parent: "[[docs/components/views/native-settings]]"
component: src/plugin/presentation/components/coforge/PluginSettings.vue
entry:
  - Within Obsidian Settings → Community plugins → CoForge, edit Ideas folder under Vault.
actions:
  - Edit ideas folder
  - Save integration settings
states:
  - Unchanged
  - Folder move
  - Pending work blocks move
  - Invalid path
journeys:
  - setup
privacy: Private vault workspace; excluded from public projections.
order: 13000
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

# Ideas folder setting

## Purpose

Choose where canonical idea notes live.

Changing the folder moves existing notes. Queued work must finish or be cancelled first.

## Entry and next action

Within Obsidian Settings → Community plugins → CoForge, edit Ideas folder under Vault. Available actions: Edit ideas folder; Save integration settings. Return through the owning [CoForge integration settings](native-settings.md) surface.

## States and recovery

Unchanged; Folder move; Pending work blocks move; Invalid path. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettings.vue](../../../src/plugin/presentation/components/coforge/PluginSettings.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `setup`.

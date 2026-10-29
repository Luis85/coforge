---
id: native-settings
title: CoForge integration settings
goal: Save the vault-wide integration configuration.
audience: streamer
kind: native
route: Obsidian Settings / CoForge
parent:
component: src/plugin/presentation/components/coforge/PluginSettings.vue
entry:
  - Open Obsidian Settings → Community plugins → CoForge.
actions:
  - Edit integration fields
  - Save
  - Discard
  - Dismiss notice
states:
  - Loading
  - Startup failure
  - Unsaved
  - Saved
  - Validation or save error
journeys:
  - setup
  - viewer-intake
  - public-sharing
privacy: Private vault workspace; excluded from public projections.
order: 8000
type: Epic
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

# CoForge integration settings

## Purpose

Save the vault-wide integration configuration.

Native settings are distinct from project settings and workflow definitions. Twitch secrets use Obsidian secret storage; configuration contains references.

## Entry and next action

Open Obsidian Settings → Community plugins → CoForge. Available actions: Edit integration fields; Save; Discard; Dismiss notice. This is an independent entry surface.

## States and recovery

Loading; Startup failure; Unsaved; Saved; Validation or save error. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

A compact ownership guide distinguishes these vault-wide integrations from Project settings and Workflow settings. Native setting rows, secret storage references, explicit Save/Discard and the unsaved state remain in the Obsidian settings surface.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettings.vue](../../../src/plugin/presentation/components/coforge/PluginSettings.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `setup`, `viewer-intake`, `public-sharing`.

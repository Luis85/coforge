---
id: "native-settings"
title: "CoForge integration settings"
goal: "Save the vault-wide integration configuration."
audience: "streamer"
kind: "native"
route: "Obsidian Settings / CoForge"
parent: null
component: "src/plugin/presentation/components/coforge/PluginSettings.vue"
entry: ["Open Obsidian Settings → Community plugins → CoForge."]
actions: ["Edit integration fields","Save","Discard","Dismiss notice"]
states: ["Loading","Startup failure","Unsaved","Saved","Validation or save error"]
journeys: ["setup","viewer-intake","public-sharing"]
privacy: "Private vault workspace; excluded from public projections."
---

# CoForge integration settings

## Purpose

Save the vault-wide integration configuration.

Native settings are distinct from project settings and workflow definitions. Twitch secrets use Obsidian secret storage; configuration contains references.

## Entry and next action

Open Obsidian Settings → Community plugins → CoForge. Available actions: Edit integration fields; Save; Discard; Dismiss notice. This is an independent entry surface.

## States and recovery

Loading; Startup failure; Unsaved; Saved; Validation or save error. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettings.vue](../../../src/plugin/presentation/components/coforge/PluginSettings.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `setup`, `viewer-intake`, `public-sharing`.

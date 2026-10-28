---
id: "settings-runtime"
title: "Project runtime check"
goal: "Verify the native runtime is available for this project."
audience: "streamer"
kind: "panel"
route: "Project settings / runtime check"
parent: "settings"
component: "src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue"
entry: ["Within Project settings, inspect Local connections and choose Check Claude Code."]
actions: ["Check runtime","Inspect readiness or error"]
states: ["Not checked","Checking","Ready","Native unavailable","Check failed"]
journeys: ["setup","workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
---

# Project runtime check

## Purpose

Verify the native runtime is available for this project.

Runtime diagnostics do not start workflow execution or expand permissions.

## Entry and next action

Within Project settings, inspect Local connections and choose Check Claude Code. Available actions: Check runtime; Inspect readiness or error. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Not checked; Checking; Ready; Native unavailable; Check failed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue](../../../src/plugin/presentation/components/coforge/SettingsRuntimeSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `workflow-configuration`.

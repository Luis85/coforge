---
id: "settings-data"
title: "Project data tools"
goal: "Export or explicitly replace this project’s workspace data."
audience: "streamer"
kind: "panel"
route: "Project settings / data tools"
parent: "settings"
component: "src/plugin/presentation/components/coforge/SettingsDataSection.vue"
entry: ["Within Project settings, use the Project data section."]
actions: ["Export private JSON backup","Request sample replacement","Keep data or confirm replacement"]
states: ["Ready","Confirmation required","Pending work blocks replacement","Failure"]
journeys: ["setup","recovery"]
privacy: "Private vault workspace; excluded from public projections."
---

# Project data tools

## Purpose

Export or explicitly replace this project’s workspace data.

Private backup includes all projects, ideas, plans, settings and activity in the plugin folder. Confirmed sample loading replaces this project’s requests, moves its notes to vault trash and pauses its automation. Other projects and shared chat stay intact.

## Entry and next action

Within Project settings, use the Project data section. Available actions: Export private JSON backup; Request sample replacement; Keep data or confirm replacement. Return through the owning [Project settings](settings.md) surface.

## States and recovery

Ready; Confirmation required; Pending work blocks replacement; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsDataSection.vue](../../../src/plugin/presentation/components/coforge/SettingsDataSection.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `recovery`.

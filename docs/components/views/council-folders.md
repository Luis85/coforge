---
id: "council-folders"
title: "Council folders"
goal: "Save the vault folders used for Council definitions."
audience: "streamer"
kind: "subpage"
route: "council.tab = folders"
parent: "[[docs/components/views/council]]"
component: "src/plugin/presentation/components/coforge/CouncilFolderSettings.vue"
entry: ["Open The Council, expand Advanced Council tools, then choose Definition folders."]
actions: ["Review mappings","Edit folders","Save mapping"]
states: ["Loading","Unsaved","Invalid path","Revision conflict","Saved"]
journeys: ["Council"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"council","key":"folders"}
---

# Council folders

## Purpose

Save the vault folders used for Council definitions.

Folder configuration is separate from definition authoring and cannot enable execution or widen capabilities.

## Entry and next action

Open The Council, expand Advanced Council tools, then choose Definition folders. Available actions: Review mappings; Edit folders; Save mapping. Return through the owning [The Council](council.md) surface.

## States and recovery

Loading; Unsaved; Invalid path; Revision conflict; Saved. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilFolderSettings.vue](../../../src/plugin/presentation/components/coforge/CouncilFolderSettings.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Folder configuration uses a focused disclosure, labelled fields and preview grouping. Saving still reconciles definitions without moving or deleting authored files.

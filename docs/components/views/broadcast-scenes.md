---
id: "broadcast-scenes"
title: "OBS scenes and sources"
goal: "Edit the exact OBS scene and its existing sources."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = scenes"
parent: "[[docs/components/views/broadcast]]"
component: "src/plugin/presentation/components/coforge/ObsSceneManager.vue"
entry: ["Open Stream studio, then choose Scenes."]
actions: ["Select scene","Create, rename, copy or delete","Switch program","Edit source visibility, order or membership","Refresh"]
states: ["Disconnected","Busy","Selected","Destructive confirmation","Unknown outcome","Example"]
journeys: ["broadcast"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"broadcast","key":"scenes"}
---

# OBS scenes and sources

## Purpose

Edit the exact OBS scene and its existing sources.

Selecting a scene opens its editor; program switching is separate. Copies share existing sources. Unknown mutations need refresh and recovery before another change.

## Entry and next action

Open Stream studio, then choose Scenes. Available actions: Select scene; Create, rename, copy or delete; Switch program; Edit source visibility, order or membership; Refresh. Return through the owning [Stream studio](broadcast.md) surface.

## States and recovery

Disconnected; Busy; Selected; Destructive confirmation; Unknown outcome; Example. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The selected scene and program-switch control lead the page. Creation, renaming and duplication are grouped as separate forms; the source list keeps each exact target beside its available actions. Destructive confirmation and unconfirmed-effect recovery remain explicit.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ObsSceneManager.vue](../../../src/plugin/presentation/components/coforge/ObsSceneManager.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

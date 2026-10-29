---
id: broadcast-sources
title: OBS sources and layouts
goal: Create supported sources and arrange the selected scene with explicit live impact.
audience: streamer
kind: subpage
route: studio.broadcastTool = sources
parent: "[[docs/components/views/broadcast]]"
component: src/plugin/presentation/components/coforge/ObsSourceEditor.vue
entry:
  - Open Stream studio, then choose Sources & layouts.
actions:
  - Create a supported source
  - Edit supported source properties and device choices
  - Inspect and edit source transforms
  - Manage supported source filters
states:
  - Disconnected
  - No selection
  - Unsupported properties
  - Shared source
  - Unconfirmed outcome
journeys:
  - broadcast
privacy: Private controls and local device references; excluded from public projections.
coverage:
  group: broadcast
  key: sources
order: 37200
---

# OBS sources and layouts

## Purpose

Author supported input types and edit exact scene-item transforms, crop and locks.
Scene membership, visibility and layer order remain available in [Scenes](broadcast-scenes.md).

## Interaction and recovery

Selecting or inspecting a scene does not switch program output. A sampled scene
image is evidence from its recorded observation time, not a smooth live monitor.
Input settings and filters are shared across scenes; previewing a scene does not
isolate a shared source from its live uses. Unsupported device/vendor properties
remain explicit setup exceptions. Mutations require a current connection/collection
context and use the same durable intent and recovery boundary as broadcast controls.

## Composition

Owned by [Stream studio](broadcast.md). Form controls use named sources, finite
supported settings and native-theme layouts without exposing private host controls
to any public display.

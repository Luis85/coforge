---
id: broadcast
title: Stream studio
goal: Operate the current broadcast with explicit stream controls.
audience: streamer
kind: page
route: studio.view = broadcast
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/BroadcastView.vue
entry:
  - Choose Stream studio in the studio navigation.
actions:
  - Prepare
  - Go live
  - Pause or resume
  - Stop
  - Choose stream subpage
states:
  - Disconnected
  - Off air
  - Live
  - On break
  - Unknown external outcome
journeys:
  - broadcast
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: broadcast
order: 32000
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

# Stream studio

## Purpose

Operate the current broadcast with explicit stream controls.

Broadcast leads, followed immediately by Show plan as the second tab. Setup,
scenes, capture displays and history have separate local subpages. Connection and
navigation never start broadcasting.

## Entry and next action

Choose Stream studio in the studio navigation. Available actions: Prepare; Go live; Pause or resume; Stop; Choose stream subpage. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Disconnected; Off air; Live; On break; Unknown external outcome. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The stream workspace leads with the observed broadcast state, audience/health and
explicit stream controls. Show plan exposes the rundown, private presenter notes
and saved cue actions. Setup owns connection, authentication, scene assignments
and human readiness review. Scenes keeps creation/editing, membership, visibility
and ordering. Preview monitors, audio tuning, source/device properties and output
configuration remain in OBS. Changing pages preserves preparation drafts. Live
BRB/resume controls remain available when navigating to other private work views.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/BroadcastView.vue](../../../src/plugin/presentation/components/coforge/BroadcastView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

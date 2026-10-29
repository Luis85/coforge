---
id: council-inboxes
title: Watched inboxes
goal: Activate reviewed note intake for a project destination.
audience: streamer
kind: subpage
route: council.tab = inboxes
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/CouncilSubmission.vue
entry:
  - Open The Council, expand Advanced Council tools, then choose Watched inboxes.
actions:
  - Configure folder
  - Preview existing files
  - Select candidates
  - Activate or pause
  - Confirm generation reset
states:
  - No bindings
  - Preview required
  - Existing candidates
  - Paused
  - Reconciled arrivals
  - Invalid binding
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: council
  key: inboxes
order: 49000
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

# Watched inboxes

## Purpose

Activate reviewed note intake for a project destination.

Activation previews existing files. Reload reconciles arrivals and pauses execution. Recursive/readiness filtering never widens capabilities.

## Entry and next action

Open The Council, expand Advanced Council tools, then choose Watched inboxes. Available actions: Configure folder; Preview existing files; Select candidates; Activate or pause; Confirm generation reset. Return through the owning [The Council](council.md) surface.

## States and recovery

No bindings; Preview required; Existing candidates; Paused; Reconciled arrivals; Invalid binding. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilSubmission.vue](../../../src/plugin/presentation/components/coforge/CouncilSubmission.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Inbox routing uses the Council authoring hierarchy and explicit admission preview. The executor prerequisite remains visible before any watched intake can be changed.

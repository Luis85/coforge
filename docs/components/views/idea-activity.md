---
id: idea-activity
title: Request activity
goal: Trace what happened to this request.
audience: streamer
kind: subpage
route: studio.drawerTab = activity
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaActivityTab.vue
entry:
  - Open a request’s details, then choose Activity.
actions:
  - Read chronological events
  - Inspect attempts
states:
  - No activity
  - Recorded events
  - Failed attempt
journeys:
  - request-to-recognition
  - recovery
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: idea
  key: activity
order: 27000
type: Task
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

# Request activity

## Purpose

Trace what happened to this request.

Private activity retains attributed status changes and attempts. It is excluded from public capture.

## Entry and next action

Open a request’s details, then choose Activity. Available actions: Read chronological events; Inspect attempts. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

No activity; Recorded events; Failed attempt. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaActivityTab.vue](../../../src/plugin/presentation/components/coforge/IdeaActivityTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `recovery`.

## Workspace redesign

The timeline and attempt sections share the request evidence heading scale. Attempt logs remain literal source text and do not imply successful implementation.

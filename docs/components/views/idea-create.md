---
id: "idea-create"
title: "New request"
goal: "Record a request in the selected project."
audience: "streamer"
kind: "dialog"
route: "studio.creating = true"
parent: "board"
component: "src/plugin/presentation/components/coforge/NewIdeaDrawer.vue"
entry: ["On Idea board, choose New request (or Add idea to inbox on Kanban)."]
actions: ["Enter title and description","Choose category","Create","Cancel"]
states: ["No project","Draft","Validation error","Saving","Failure with retained draft"]
journeys: ["request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
---

# New request

## Purpose

Record a request in the selected project.

Creates a canonical note with a stable ID. Viewer chat requests still require registration and explicit project IDs; downstream review is always enforced.

## Entry and next action

On Idea board, choose New request (or Add idea to inbox on Kanban). Available actions: Enter title and description; Choose category; Create; Cancel. Return through the owning [Request board](board.md) surface.

## States and recovery

No project; Draft; Validation error; Saving; Failure with retained draft. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/NewIdeaDrawer.vue](../../../src/plugin/presentation/components/coforge/NewIdeaDrawer.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

## Workspace redesign

The creation heading names the selected project and its stable ID before any input. The dialog retains labelled fields, protected focus and the existing submission-failure draft.

---
id: idea-detail
title: Request details
goal: Decide the next valid action for one request.
audience: streamer
kind: dialog
route: studio.selectedIdea
parent: "[[docs/components/views/board]]"
component: src/plugin/presentation/components/coforge/IdeaDrawer.vue
entry:
  - On Idea board, open a request card or request row.
actions:
  - Choose detail tab
  - Run eligible stage
  - Cancel active run
  - Close
states:
  - No selected request
  - Active attempt
  - Stage error
  - Review pending
journeys:
  - request-to-recognition
privacy: Private vault workspace; excluded from public projections.
order: 26000
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

# Request details

## Purpose

Decide the next valid action for one request.

Overview, Sessions, Plan & Design, Increment, Workflow runs, AI costs and Activity
support exactly one request. Sessions provides read-only observation of captured
attempts; Workflow runs contains its captured process and retained run history.
AI costs reads the request's scoped retained ledger. Execution controls and
mandatory review remain in their owning tabs; Sessions and AI costs expose no
execution or charge mutations. Services reject invalid transitions.

## Entry and next action

On Idea board, open a request card or request row. Available actions: Choose detail tab; Run eligible stage; Cancel active run; Close. Return through the owning [Request board](board.md) surface.

## States and recovery

No selected request; Active attempt; Stage error; Review pending. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaDrawer.vue](../../../src/plugin/presentation/components/coforge/IdeaDrawer.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

## Workspace redesign

The request heading is a distinct project-work surface; evidence sections use a
larger reading hierarchy. A stopped Inbox request with preserved changes exposes
Increment review, with an actionable explanation before Restart. The card menu
owns explicit Stop/Restart; detail navigation never releases the durable hold.

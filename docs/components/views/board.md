---
id: board
title: Request board
goal: Choose the next request that needs attention.
audience: streamer
kind: page
route: studio.view = board
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/IdeaBoard.vue
entry:
  - Choose Idea board in the studio navigation.
actions:
  - Filter and search
  - Switch Kanban or table
  - Open request
  - Create request
  - Use valid context actions
states:
  - No project
  - No requests
  - No matches
  - Queued work
  - Review pending
journeys:
  - request-to-recognition
  - multi-project
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: board
order: 24000
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

# Request board

## Purpose

Choose the next request that needs attention.

Requests are scoped to their canonical parent project. Opening a card leads to focused request details; services enforce screening and final human review.

The board flows through Inbox, Up next, Design, In progress and Accepted. Planned
requests appear in Design while their specification is prepared and before Build
starts. The standard workflow retains Design as a private Markdown artifact and
passes it with the plan to Build. The public board shows the same Design stage
without exposing private workflow artifacts or instructions.

## Entry and next action

Choose Idea board in the studio navigation. Available actions: Filter and search; Switch Kanban or table; Open request; Create request; Use valid context actions. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; No requests; No matches; Queued work; Review pending. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaBoard.vue](../../../src/plugin/presentation/components/coforge/IdeaBoard.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `multi-project`.

## Workspace redesign

The sidebar switcher identifies the canonical project and private visibility; the work surface has no repeated project banner or decision-summary section. Filter tabs and the toolbar follow the heading. Needs review and Flagged retain current-project counts and open their existing filters without running work.

## Project privacy

Private project context is labelled in the owner workspace. Owner requests and local simulation remain available; viewer chat intake is refused for private projects even when an ID is guessed.

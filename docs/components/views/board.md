---
id: "board"
title: "Request board"
goal: "Choose the next request that needs attention."
audience: "streamer"
kind: "page"
route: "studio.view = board"
parent: "studio"
component: "src/plugin/presentation/components/coforge/IdeaBoard.vue"
entry: ["Choose Idea board in the studio navigation."]
actions: ["Filter and search","Switch Kanban or table","Open request","Create request","Use valid context actions"]
states: ["No project","No requests","No matches","Queued work","Review pending"]
journeys: ["request-to-recognition","multi-project"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"board"}
---

# Request board

## Purpose

Choose the next request that needs attention.

Requests are scoped to their canonical parent project. Opening a card leads to focused request details; services enforce screening and final human review.

## Entry and next action

Choose Idea board in the studio navigation. Available actions: Filter and search; Switch Kanban or table; Open request; Create request; Use valid context actions. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; No requests; No matches; Queued work; Review pending. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaBoard.vue](../../../src/plugin/presentation/components/coforge/IdeaBoard.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `multi-project`.

## Workspace redesign

A project context band identifies the canonical project. The decision summary counts current project requests awaiting screening, moderation or final review; review and moderation counts open their existing filters without running work. Accepted totals count request state, not agent attempts.

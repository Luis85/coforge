---
id: "idea-detail"
title: "Request details"
goal: "Decide the next valid action for one request."
audience: "streamer"
kind: "dialog"
route: "studio.selectedIdea"
parent: "board"
component: "src/plugin/presentation/components/coforge/IdeaDrawer.vue"
entry: ["On Idea board, open a request card or request row."]
actions: ["Choose detail tab","Run eligible stage","Cancel active run","Close"]
states: ["No selected request","Active attempt","Stage error","Review pending"]
journeys: ["request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
---

# Request details

## Purpose

Decide the next valid action for one request.

Focused overview, plan, increment and activity children support one request. The footer preserves mandatory review and services reject invalid transitions.

## Entry and next action

On Idea board, open a request card or request row. Available actions: Choose detail tab; Run eligible stage; Cancel active run; Close. Return through the owning [Request board](board.md) surface.

## States and recovery

No selected request; Active attempt; Stage error; Review pending. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaDrawer.vue](../../../src/plugin/presentation/components/coforge/IdeaDrawer.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

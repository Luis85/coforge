---
id: "idea-increment"
title: "Request increment"
goal: "Accept or reject the actual implementation changes."
audience: "streamer"
kind: "subpage"
route: "studio.drawerTab = increment"
parent: "idea-detail"
component: "src/plugin/presentation/components/coforge/IdeaIncrementTab.vue"
entry: ["Open a request’s details, then choose Increment."]
actions: ["Inspect increment and diff","Accept or reject"]
states: ["No increment","Building","Review ready","Accepted","Rejected"]
journeys: ["request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"idea","key":"increment"}
---

# Request increment

## Purpose

Accept or reject the actual implementation changes.

Diffs retain source formatting. Human acceptance cannot be replaced by provider delivery or a workflow checkpoint.

## Entry and next action

Open a request’s details, then choose Increment. Available actions: Inspect increment and diff; Accept or reject. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

No increment; Building; Review ready; Accepted; Rejected. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaIncrementTab.vue](../../../src/plugin/presentation/components/coforge/IdeaIncrementTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

---
id: "ai-costs"
title: "AI costs"
goal: "Understand the known cost and usage of agent work."
audience: "streamer"
kind: "page"
route: "studio.view = ai-costs"
parent: "studio"
component: "src/plugin/presentation/components/coforge/AICostsView.vue"
entry: ["Choose AI costs in the studio navigation."]
actions: ["Refresh","Filter project","Inspect feature and attempt","Record manual cost"]
states: ["No attempts","Reported amount","Manual amount","Unavailable amount","Partial token coverage"]
journeys: ["cost-review"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"ai-costs"}
---

# AI costs

## Purpose

Understand the known cost and usage of agent work.

Native USD costs retain failures and retries. Missing amounts are not zero; provider provenance stays visible. EUR cash payments belong in Stream finances.

## Entry and next action

Choose AI costs in the studio navigation. Available actions: Refresh; Filter project; Inspect feature and attempt; Record manual cost. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No attempts; Reported amount; Manual amount; Unavailable amount; Partial token coverage. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/AICostsView.vue](../../../src/plugin/presentation/components/coforge/AICostsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `cost-review`.

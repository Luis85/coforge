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
actions: ["Refresh","Filter project, agent, team or Council","Regroup captured identities","Inspect feature and attempt","Record manual cost"]
states: ["No attempts","Reported amount","Manual amount","Unavailable amount","Partial token coverage","Legacy unattributed","Not started without provider contact"]
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

## Presentation and information hierarchy

Cost coverage appears before feature and task details. The known USD total is visually prominent, with reported, manual, missing and pending coverage beside it. A partial-total explanation directs the operator to a manual fallback when a reliable source is available. Token counters remain independently attributed and never infer missing values.

[Agent, team and Council attribution](ai-cost-attribution.md) regroups the same retained attempts using captured identities. These overlapping dimensions have their own attribution coverage, independent of known monetary amounts. Direct agents, Council rounds, proposal workflows, delegated work and their retries remain distinct attempts; legacy unattributed costs remain visible. Pruning native execution history first requires a durable analytics copy.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/AICostsView.vue](../../../src/plugin/presentation/components/coforge/AICostsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `cost-review`.

---
id: "idea-overview"
title: "Request overview"
goal: "Understand and qualify the submitted request."
audience: "streamer"
kind: "subpage"
route: "studio.drawerTab = overview"
parent: "idea-detail"
component: "src/plugin/presentation/components/coforge/IdeaOverviewTab.vue"
entry: ["Open a request’s details, then choose Overview."]
actions: ["Read request and context","Inspect screening","Edit RICE","Run next stage"]
states: ["Unscreened","Flagged","Screened","Changed context"]
journeys: ["request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"idea","key":"overview"}
---

# Request overview

## Purpose

Understand and qualify the submitted request.

Safely renders Markdown. Added context invalidates analysis and preserves the original request.

## Entry and next action

Open a request’s details, then choose Overview. Available actions: Read request and context; Inspect screening; Edit RICE; Run next stage. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

Unscreened; Flagged; Screened; Changed context. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaOverviewTab.vue](../../../src/plugin/presentation/components/coforge/IdeaOverviewTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

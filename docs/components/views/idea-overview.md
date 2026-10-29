---
id: idea-overview
title: Request overview
goal: Understand and qualify the submitted request.
audience: streamer
kind: subpage
route: studio.drawerTab = overview
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaOverviewTab.vue
entry:
  - Open a request’s details, then choose Overview.
actions:
  - Read request and context
  - Inspect or edit captured custom values
  - Inspect screening
  - Edit RICE
  - Run next stage
states:
  - Unscreened
  - Flagged
  - Screened
  - Changed context
journeys:
  - request-to-recognition
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: idea
  key: overview
order: 29000
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

# Request overview

## Purpose

Understand and qualify the submitted request.

Safely renders Markdown. Added context invalidates analysis and preserves the original request.

Requests created with a project Request Object display their captured class and fields. Value edits validate against that captured schema, retain optional unset values and require a fresh request fingerprint. Successful changes return the complete request to screening and invalidate stale agent/workflow inputs while preserving body and unrelated frontmatter. Existing notes without a captured schema remain in their original format and are not automatically adopted.

## Entry and next action

Open a request’s details, then choose Overview. Available actions: Read request and context; Inspect screening; Edit RICE; Run next stage. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

Unscreened; Flagged; Screened; Changed context. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaOverviewTab.vue](../../../src/plugin/presentation/components/coforge/IdeaOverviewTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

## Workspace redesign

Screening provenance distinguishes Simulation, Claude Code and Herdr from the stored screening record. The evidence surface and vote count have clearer visual priority; moderation remains an explicit decision.

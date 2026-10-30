---
id: idea-plan
title: Request plan and design
goal: Assess the proposed implementation before building.
audience: streamer
kind: subpage
route: studio.drawerTab = plan
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaPlanTab.vue
entry:
  - Open a request’s details, then choose Plan & Design.
actions:
  - Read plan and steps
  - Read or copy the Design specification
  - Run eligible plan or build action
states:
  - No plan
  - Planning
  - Ready
  - Stale
journeys:
  - request-to-recognition
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: idea
  key: plan
order: 31000
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

# Request plan and design

## Purpose

Assess the proposed implementation before building.

Plans retain provenance. Repository access remains within saved execution permissions.

## Entry and next action

Open a request’s details, then choose Plan & Design. Available actions: Read plan and steps; Run eligible plan or build action. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

No plan; Planning; Ready; Stale. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaPlanTab.vue](../../../src/plugin/presentation/components/coforge/IdeaPlanTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`.

## Workspace redesign

The empty state describes an optional configured planning step rather than assuming every workflow has the standard stage order. Plan, acceptance criteria and risk sections retain their authored Markdown.

## Design specification

The Plan & Design tab shows the current request's intact, successfully produced
specification beside its plan. Reading and copying are private operations and
never start a provider, save a note, accept code or publish a result. Invalidated,
altered, foreign-run and earlier-request evidence is excluded; retained results
remain inspectable in Workflow runs. Build receives the saved Design artifact
through its captured input contract. Simulation content is clearly illustrative.

---
id: coworkers
title: CoWorkers
goal: Create and maintain reusable specialists for project teams.
audience: streamer
kind: page
route: studio.view = coworkers
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/CoWorkersView.vue
entry:
  - Choose CoWorkers in Build & Improve.
actions:
  - Search and filter CoWorkers
  - Create CoWorker
  - Edit instructions and provider
  - Save
  - Duplicate
  - Archive
  - Open canonical note
states:
  - Native unavailable
  - Example
  - Empty inventory
  - No matches
  - Unsaved draft
  - Save failure
  - Disabled
journeys:
  - Council
  - multi-project
privacy: Private vault definitions; excluded from public projections.
coverage:
  group: studio
  key: coworkers
order: 58000
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

# CoWorkers

## Purpose

Maintain a vault-wide inventory of reusable specialists. Each CoWorker has a role,
instructions, provider, model and enforced CoForge MCP tool policy. Stable agent/v1
identities and captured run revisions remain compatible with existing definitions.

## Entry and next action

Choose CoWorkers in Build & Improve. Search by name, role or ID and filter by
availability. Create a specialist or select a card to edit. Save changes for future
runs; failed writes preserve drafts. Duplicate uses the saved revision and retains
the current draft. Archive disables future use, preserving existing references.
Manage membership in [The Council's teams and councils](council-definitions.md).
Return through the owning [CoForge studio](studio.md).

## States and recovery

Native definitions require desktop Obsidian. The explicit browser example uses
temporary data. Invalid notes remain visible for repair. An unsaved draft can be
restored after selection changes; saving or discarding is required before archive.

## Composition and boundaries

[CoWorker inventory](../../../src/plugin/presentation/components/coforge/CoWorkerInventory.vue)
owns search, status filters, cards and the shared definition editor. Definitions
remain canonical Markdown, with no provider dispatch on navigation or saving.

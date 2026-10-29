---
id: settings
title: Project settings
goal: Save this project’s brief and workspace boundaries.
audience: streamer
kind: page
route: studio.view = settings
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/SettingsView.vue
entry:
  - Choose Project settings in the studio navigation.
actions:
  - Edit brief and prompt
  - Configure repository
  - Save or discard
  - Open Workflow settings
states:
  - No project
  - Saved
  - Unsaved
  - Saving
  - Invalid draft
  - Pending-work guard
journeys:
  - setup
  - multi-project
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: settings
order: 74000
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

# Project settings

## Purpose

Save this project’s brief and workspace boundaries.

Canonical project-note saves preserve unrelated properties and Markdown body. Provider steps, models and limits live in Workflow settings.

[Request Object](settings-request-object.md) configures the frontmatter class and optional typed fields for new requests. Existing request notes retain their captured format; no migration runs when this project definition changes.

## Entry and next action

Choose Project settings in the studio navigation. Available actions: Edit brief and prompt; Configure repository; Save or discard; Open Workflow settings. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; Saved; Unsaved; Saving; Invalid draft; Pending-work guard. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsView.vue](../../../src/plugin/presentation/components/coforge/SettingsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `multi-project`, `workflow-configuration`.

## Workspace redesign

Project identity is visible above the form. Brief, repository, workflow location, runtime evidence and data tools have distinct section hierarchy; changing projects uses the existing unsaved-draft guard.

## Project privacy

The Project visibility field saves a canonical public/private choice independently of immutable active agent configuration. A failed revocation keeps the draft and a separate publication-blocked state; restoring publication requires an explicit successful public reconciliation.

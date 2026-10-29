---
id: "project-create"
title: "Add project"
goal: "Create the canonical project identity and workspace configuration."
audience: "streamer"
kind: "panel"
route: "projects.adding = true"
parent: "[[docs/components/views/projects]]"
component: "src/plugin/presentation/components/coforge/ProjectsView.vue"
entry: ["Open Projects from the project selector, then choose Add project."]
actions: ["Enter name, path and brief","Add optional URLs","Create","Cancel"]
states: ["Draft","Invalid path or brief","Saving","Failure"]
journeys: ["setup","multi-project"]
privacy: "Private vault workspace; excluded from public projections."
---

# Add project

## Purpose

Create the canonical project identity and workspace configuration.

Creates a Markdown project note and pauses initial automation. Repository URLs never trigger Git cloning or initialization.

## Entry and next action

Open Projects from the project selector, then choose Add project. Available actions: Enter name, path and brief; Add optional URLs; Create; Cancel. Return through the owning [Projects](projects.md) surface.

## States and recovery

Draft; Invalid path or brief; Saving; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ProjectsView.vue](../../../src/plugin/presentation/components/coforge/ProjectsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `multi-project`.

## Workspace redesign

The inline creation form is a separate authoring surface with the same labelled-field and action hierarchy as workflow configuration. Paths and URLs keep their existing validation and write semantics.

## Project privacy

Choose Public or Private before creating the canonical project note. Private means owner workspace only; local authoring remains available without making a game discoverable to viewers.

---
id: "projects"
title: "Projects"
goal: "Choose or create the project whose backlog you will operate."
audience: "streamer"
kind: "page"
route: "studio.view = projects"
parent: "studio"
component: "src/plugin/presentation/components/coforge/ProjectsView.vue"
entry: ["Choose the project selector in the studio sidebar to open Projects."]
actions: ["Add project","Open board","Open settings","Confirm sample workspace"]
states: ["No projects","Adding","Selected","Unavailable","Background jobs"]
journeys: ["setup","multi-project"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"projects"}
---

# Projects

## Purpose

Choose or create the project whose backlog you will operate.

Viewer requests need readable project IDs. Repository URLs are metadata: adding a project never clones or initializes Git. Chat and recognition are shared.

## Entry and next action

Choose the project selector in the studio sidebar to open Projects. Available actions: Add project; Open board; Open settings; Confirm sample workspace. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No projects; Adding; Selected; Unavailable; Background jobs. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ProjectsView.vue](../../../src/plugin/presentation/components/coforge/ProjectsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `multi-project`.

## Workspace redesign

Project rows give the stable project ID, request count, review workload and automation state distinct visual roles. Unavailable project notes have an explicit restore instruction beside disabled actions.

## Project privacy

Project visibility is explicit at creation and in each row. Existing projects with no visibility field remain public. Private projects stay fully usable in the owner studio and are excluded from viewer discovery and public request projections.

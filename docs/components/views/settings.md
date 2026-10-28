---
id: "settings"
title: "Project settings"
goal: "Save this project’s brief and workspace boundaries."
audience: "streamer"
kind: "page"
route: "studio.view = settings"
parent: "studio"
component: "src/plugin/presentation/components/coforge/SettingsView.vue"
entry: ["Choose Project settings in the studio navigation."]
actions: ["Edit brief and prompt","Configure repository","Save or discard","Open Workflow settings"]
states: ["No project","Saved","Unsaved","Saving","Invalid draft","Pending-work guard"]
journeys: ["setup","multi-project","workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"settings"}
---

# Project settings

## Purpose

Save this project’s brief and workspace boundaries.

Canonical project-note saves preserve unrelated properties and Markdown body. Provider steps, models and limits live in Workflow settings.

## Entry and next action

Choose Project settings in the studio navigation. Available actions: Edit brief and prompt; Configure repository; Save or discard; Open Workflow settings. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; Saved; Unsaved; Saving; Invalid draft; Pending-work guard. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/SettingsView.vue](../../../src/plugin/presentation/components/coforge/SettingsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `multi-project`, `workflow-configuration`.

## Workspace redesign

Project identity is visible above the form. Brief, repository, workflow location, runtime evidence and data tools have distinct section hierarchy; changing projects uses the existing unsaved-draft guard.

---
id: "workflow-settings"
title: "Workflow settings"
goal: "Save the process that new requests will follow."
audience: "streamer"
kind: "page"
route: "studio.view = workflow-settings"
parent: "studio"
component: "src/plugin/presentation/components/coforge/WorkflowEditorView.vue"
entry: ["Choose Workflow settings in the studio navigation."]
actions: ["Add or select step","Reorder or replace","Edit prompts and provider","Preview import or export","Save or discard"]
states: ["No project","Standard defaults","Saved","Unsaved draft","Validation error","Active-work guard"]
journeys: ["workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"workflow-settings"}
---

# Workflow settings

## Purpose

Save the process that new requests will follow.

Each project owns a v1 definition with stable step IDs. Existing runs keep captured revisions. Import changes the draft after preview; saving is explicit.

## Entry and next action

Choose Workflow settings in the studio navigation. Available actions: Add or select step; Reorder or replace; Edit prompts and provider; Preview import or export; Save or discard. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No project; Standard defaults; Saved; Unsaved draft; Validation error; Active-work guard. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowEditorView.vue](../../../src/plugin/presentation/components/coforge/WorkflowEditorView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `workflow-configuration`.

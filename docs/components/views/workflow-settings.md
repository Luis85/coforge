---
id: "workflow-settings"
title: "Workflow settings"
goal: "Save the process that new requests will follow."
audience: "streamer"
kind: "subpage"
route: "studio.workflowTool = settings (compatibility: studio.view = workflow-settings)"
parent: "workflow"
component: "src/plugin/presentation/components/coforge/WorkflowEditorView.vue"
entry: ["Open Agent workflow, then choose Workflow settings."]
actions: ["Add or select step","Reorder or replace","Edit prompts and provider","Preview import or export","Save or discard"]
states: ["No project","Standard defaults","Saved","Unsaved draft","Validation error","Active-work guard"]
journeys: ["workflow-configuration"]
privacy: "Private vault workspace; excluded from public projections."
coverage: [{"group":"studio","key":"workflow-settings"},{"group":"workflow","key":"settings"}]
---

# Workflow settings

## Purpose

Save the process that new requests will follow.

Each project owns a v1 definition with stable step IDs. Existing runs keep captured revisions. Import changes the draft after preview; saving is explicit.

## Entry and next action

Open [Agent workflow](workflow.md), then choose Workflow settings in its local navigation. Available actions: Add or select step; Reorder or replace; Edit prompts and provider; Preview import or export; Save or discard. Workflow runs and Herdr workspaces remain sibling tasks in the same workspace.

## States and recovery

No project; Standard defaults; Saved; Unsaved draft; Validation error; Active-work guard. Save or discard a dirty workflow before changing local tasks, global destinations or projects. A blocked transition retains the current subpage and draft. Import only replaces the reviewed draft; saving remains explicit and existing runs retain their captured definitions.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowEditorView.vue](../../../src/plugin/presentation/components/coforge/WorkflowEditorView.vue), embedded inside [WorkflowView](../../../src/plugin/presentation/components/coforge/WorkflowView.vue). Agent workflow owns the H1, selected-project context, shared page frame and local navigation; the editor owns an H2 and its authoring controls. Workflow settings has no global sidebar entry.

The internal `studio.view = workflow-settings` locator remains a compatibility alias for existing guarded navigation. It selects this same local task; it does not create a second page or host tab. Both the compatibility locator and `workflowTool = settings` are covered by this one canonical view contract.

Journey tags: `workflow-configuration`.

## Workspace redesign

The selected project and saved or unsaved state precede a dedicated step catalogue and authoring area. Configuration, import preview and save actions retain separate visual levels and existing draft guards.

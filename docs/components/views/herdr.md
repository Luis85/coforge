---
id: "herdr"
title: "Herdr workspace controls"
goal: "Dispatch an explicitly reviewed request to a verified ready agent."
audience: "streamer"
kind: "subpage"
route: "studio.workflowTool = herdr"
parent: "[[docs/components/views/workflow]]"
component: "src/plugin/presentation/components/coforge/HerdrPanel.vue"
entry: ["Open Agent workflow, then choose Herdr workspaces."]
actions: ["Refresh identities","Manage native agents","Review dispatch","Send","Acknowledge recovery"]
states: ["Native unavailable","Disconnected","No ready agent","Review required","Pending or unknown mutation"]
journeys: ["workflow-configuration","recovery"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"workflow","key":"herdr"}
---

# Herdr workspace controls

## Purpose

Dispatch an explicitly reviewed request to a verified ready agent.

A dispatch prefixes the parent-project prompt. Verify agent and directory. Delivery is not completion; unknown mutations never replay automatically.

## Entry and next action

Open Agent workflow, then choose Herdr workspaces. Available actions: Refresh identities; Manage native agents; Review dispatch; Send; Acknowledge recovery. Return through the owning [Agent workflow](workflow.md) surface.

## States and recovery

Native unavailable; Disconnected; No ready agent; Review required; Pending or unknown mutation. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/HerdrPanel.vue](../../../src/plugin/presentation/components/coforge/HerdrPanel.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `workflow-configuration`, `recovery`.

## Workspace redesign

Connection configuration is a distinct workspace surface, separate from observed workspaces and agents. Unconfirmed actions receive a recovery surface; delivery remains separate from completion.

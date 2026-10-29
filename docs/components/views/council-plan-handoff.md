---
id: "council-plan-handoff"
title: "Council plan handoff"
goal: "Continue a validated Council plan in an existing request's project workflow."
audience: "streamer"
kind: "panel"
route: "council.inspectedRun completed / Continue a validated plan in the project workflow"
parent: "[[docs/components/views/council-monitor]]"
component: "src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue"
entry: ["Within The Council → Run monitor, inspect a completed run with a typed plan and expand Continue a validated plan in the project workflow."]
actions: ["Select validated plan artifact","Select existing project request","Hand selected plan to project workflow"]
states: ["No completed typed plan","Plan or request selection missing","Ready for explicit handoff","Handed to workflow","Stale request or rejected handoff"]
journeys: ["Council","request-to-recognition"]
privacy: "Private execution evidence and request workflow; no discussion publication or public mutation capability."
---

# Council plan handoff

## Purpose

Continue a validated Council plan in an existing request's project workflow.

The selected typed plan becomes an attributed input to the existing request's saved workflow. Generic discussion prose cannot become a plan. This explicit handoff cannot accept code or publish the Council discussion.

## Entry and next action

Within The Council → Run monitor, choose **Inspect captured evidence** for a completed run with a typed plan. Expand **Continue a validated plan in the project workflow**, choose the validated plan artifact and an existing request in that run's project, then choose **Hand selected plan to project workflow**.

Inspect the resulting request in [Workflow runs](workflow-runs.md). Its host permissions, configured steps and mandatory final code review remain authoritative. Return through the owning [Council run monitor](council-monitor.md) surface.

## States and recovery

The section appears only for a completed run containing a typed plan. The primary action stays disabled until both an artifact and request are selected. Skipped artifacts cannot be selected. The service checks the current request revision before applying the handoff; rejection remains visible and does not imply a completed workflow or accepted increment.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue](../../../src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue), in its framed plan-handoff details section. This task shares the selected-run context and busy/error state with the monitor; it does not add an independent navigation route or Obsidian tab.

Journey tags: `Council`, `request-to-recognition`.

## Workspace redesign

Plan handoff remains inside the inspected run, with the Council evidence hierarchy and existing explicit target-request selection. It does not approve implementation.

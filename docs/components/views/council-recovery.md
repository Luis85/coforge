---
id: "council-recovery"
title: "Council recovery tools"
goal: "Preserve or recover the selected run's retained execution evidence."
audience: "streamer"
kind: "panel"
route: "council.inspectedRun recovery tools"
parent: "council-monitor"
component: "src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue"
entry: ["Within The Council → Run monitor, select a run to inspect its recovery tools."]
actions: ["Record allowance extension","Prepare private run export","Publish retained results to selected note","Remove settled history with export and consent"]
states: ["No selected run","Exhausted allowance","Export ready","Missing source","Pending work blocks removal","Retention consent required"]
journeys: ["Council","recovery"]
privacy: "Private vault workspace; excluded from public projections."
---

# Council recovery tools

## Purpose

Preserve or recover the selected run's retained execution evidence.

Recovery preserves exact contributions and intents. Expand **Export or reassign retained results** to prepare private JSON or publish retained results into an explicitly chosen existing private note. The export includes notes, prompts, attributed results and attempts; review it before sharing. Reassignment preserves the captured input and human note text, and makes no provider call.

## Entry and next action

Within The Council → Run monitor, choose **Inspect captured evidence** for a run. Expand **Extend an exhausted execution allowance** or **Export or reassign retained results** for the corresponding task. Unknown-outcome acknowledgement and publication retries remain with the run's monitor controls. Return through the owning [Council run monitor](council-monitor.md) surface.

A completed run with a typed plan also exposes the separate [plan handoff](council-plan-handoff.md) task.

## States and recovery

An allowance extension requires a reason and records bounded additional dispatches or active execution time; consumed/reserved allowance remains counted. The finite host limits remain 100 dispatches and 120 active minutes. Recording an extension does not start another action or resolve an unknown outcome.

Removing readable history requires a completed/cancelled run, prepared private export and explicit consent. Uncertain attempts and pending publications/deliveries block removal; submission tombstones remain to prevent replay. Inspect action errors and preserve the evidence before retrying.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue](../../../src/plugin/presentation/components/coforge/CouncilRecoveryTools.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`, `recovery`.

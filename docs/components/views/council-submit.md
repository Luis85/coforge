---
id: "council-submit"
title: "Submit and preflight"
goal: "Submit a reviewed note to the intended collaboration destination."
audience: "streamer"
kind: "subpage"
route: "council.tab = submit"
parent: "council"
component: "src/plugin/presentation/components/coforge/CouncilSubmission.vue"
entry: ["Open The Council, then choose Submit and preflight."]
actions: ["Choose source and target","Preview preflight","Submit reviewed input"]
states: ["No target","Invalid source","Stale preflight","Preview ready","Submitted","Failure"]
journeys: ["Council"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"council","key":"submit"}
---

# Submit and preflight

## Purpose

Submit a reviewed note to the intended collaboration destination.

Preflight makes source, destination, permissions and bounded execution explicit. Ordinary edits do not rerun work; another submission is an explicit generation.

## Entry and next action

Open The Council, then choose Submit and preflight. Available actions: Choose source and target; Preview preflight; Submit reviewed input. Return through the owning [The Council](council.md) surface.

## States and recovery

No target; Invalid source; Stale preflight; Preview ready; Submitted; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilSubmission.vue](../../../src/plugin/presentation/components/coforge/CouncilSubmission.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

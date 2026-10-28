---
id: "council-submit"
title: "Submit existing note"
goal: "Submit a reviewed note to the intended collaboration destination."
audience: "streamer"
kind: "subpage"
route: "council.tab = submit"
parent: "council"
component: "src/plugin/presentation/components/coforge/CouncilSubmission.vue"
entry: ["Open The Council, expand Advanced Council tools, then choose Submit existing note."]
actions: ["Choose source and target","Preview preflight","Submit reviewed input"]
states: ["No target","Invalid source","Stale preflight","Preview ready","Submitted","Failure"]
journeys: ["Council"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"council","key":"submit"}
---

# Submit existing note

## Purpose

Submit a reviewed note to the intended collaboration destination.

Preflight makes source, destination, permissions and bounded execution explicit. Ordinary edits do not rerun work; another submission is an explicit generation.

Round prompt order lists each captured round's Round robin or Fan out setting and member count. The source, selected earlier collections and round-completion barriers remain explicit. Changing the mode after review invalidates preflight; it never reinterprets an admitted run.

## Entry and next action

Open The Council, expand Advanced Council tools, then choose Submit existing note. Available actions: Choose source and target; Preview preflight; Submit reviewed input. Return through the owning [The Council](council.md) surface.

## States and recovery

No target; Invalid source; Stale preflight; Preview ready; Submitted; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

The reviewed submission panel is also reused below the new-question intake after a task note has been saved. The advanced page keeps existing private-note selection available.

Source: [src/plugin/presentation/components/coforge/CouncilSubmission.vue](../../../src/plugin/presentation/components/coforge/CouncilSubmission.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Submission fields and preflight evidence use the Council authoring hierarchy. The execution prerequisite has a visible attention surface and working route to Run monitor.

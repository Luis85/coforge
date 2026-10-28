---
id: "operations"
title: "Operations"
goal: "Find the recorded outcome of a failed or uncertain action."
audience: "streamer"
kind: "page"
route: "studio.view = operations"
parent: "studio"
component: "src/plugin/presentation/components/coforge/OperationsView.vue"
entry: ["Choose Operations in the studio navigation."]
actions: ["Filter event and effect","Clear filters","Inspect records","Export safe diagnostics"]
states: ["No events","No matches","Unconfirmed effect","Export unavailable","Export error"]
journeys: ["recovery","moderation"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"operations"}
---

# Operations

## Purpose

Find the recorded outcome of a failed or uncertain action.

Records distinguish committed, no-change and uncertain effects. Exports exclude chat text, identities, credentials, paths and note content.

## Entry and next action

Choose Operations in the studio navigation. Available actions: Filter event and effect; Clear filters; Inspect records; Export safe diagnostics. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No events; No matches; Unconfirmed effect; Export unavailable; Export error. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/OperationsView.vue](../../../src/plugin/presentation/components/coforge/OperationsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `recovery`, `moderation`.

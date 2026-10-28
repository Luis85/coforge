---
id: "council-definitions"
title: "Agents and councils"
goal: "Save reusable specialists and project collaboration definitions."
audience: "streamer"
kind: "subpage"
route: "council.tab = definitions"
parent: "council"
component: "src/plugin/presentation/components/coforge/CouncilDefinitions.vue"
entry: ["Open The Council, then choose Definitions."]
actions: ["Create agent, team or council","Create default team","Select or search","Save or discard","Duplicate or archive","Preview import or export"]
states: ["No definitions","No team","Invalid definition","Preserved drafts","Changed on disk","Permission issue"]
journeys: ["Council"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"council","key":"definitions"}
---

# Agents and councils

## Purpose

Save reusable specialists and project collaboration definitions.

Agents belong to the vault; teams and councils belong to a project. Switching definitions or projects preserves drafts. Imported definitions stay disabled pending capability review.

## Entry and next action

Open The Council, then choose Definitions. Available actions: Create agent, team or council; Create default team; Select or search; Save or discard; Duplicate or archive; Preview import or export. Return through the owning [The Council](council.md) surface.

## States and recovery

No definitions; No team; Invalid definition; Preserved drafts; Changed on disk; Permission issue. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilDefinitions.vue](../../../src/plugin/presentation/components/coforge/CouncilDefinitions.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

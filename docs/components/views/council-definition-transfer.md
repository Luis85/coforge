---
id: council-definition-transfer
title: Definition import and export
goal: Review a portable specialist definition before saving or sharing it.
audience: streamer
kind: panel
route: Council definitions / import and export details
parent: "[[docs/components/views/council-definitions]]"
component: src/plugin/presentation/components/coforge/CouncilDefinitions.vue
entry:
  - Within The Council → Definitions, expand Import and export definitions.
actions:
  - Paste JSON
  - Preview current and imported definitions
  - Save import
  - Preview export
states:
  - Invalid JSON
  - Replacement preview
  - Disabled import
  - Export ready
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
order: 46000
type: Task
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Definition import and export

## Purpose

Review a portable specialist definition before saving or sharing it.

Imported definitions stay disabled pending local permission and connection review. Exports contain authored instructions and require review before sharing.

## Entry and next action

Within The Council → Definitions, expand Import and export definitions. Available actions: Paste JSON; Preview current and imported definitions; Save import; Preview export. Return through the owning [Agents and councils](council-definitions.md) surface.

## States and recovery

Invalid JSON; Replacement preview; Disabled import; Export ready. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilDefinitions.vue](../../../src/plugin/presentation/components/coforge/CouncilDefinitions.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Transfer uses the Council disclosure and inspection hierarchy, preserving literal source and its explicit preview and apply decisions.

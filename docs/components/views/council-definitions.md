---
id: council-definitions
title: "Councils & roster"
goal: Save project team rosters and Council discussion protocols.
audience: streamer
kind: subpage
route: council.tab = definitions
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/CouncilDefinitions.vue
entry:
  - Open The Council, choose Setup, then Councils & roster.
actions:
  - Manage CoWorkers
  - Create team or council
  - Create default team
  - Choose per-round prompt order
  - Select or search
  - Save or discard
  - Duplicate or archive
  - Preview import or export
states:
  - No definitions
  - No team
  - Invalid definition
  - Preserved drafts
  - Changed on disk
  - Permission issue
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: council
  key: definitions
order: 45000
type: PBI
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

# Councils & roster

## Purpose

Save project team rosters and Council discussion protocols. Reusable specialists
are created and maintained in [CoWorkers](coworkers.md); this view chooses their
membership and configures project discussions.

CoWorkers belong to the vault; teams and councils belong to a project. Switching
definitions or projects preserves drafts. Imported definitions stay disabled
pending capability review. Use [CoWorkers](coworkers.md) to create or edit a specialist.

Each Council round selects Round robin (sequential members) or Fan out (concurrent members). Participant order remains the publication order, rounds remain ordered, and same-round opinions remain independent. Legacy missing fields display Round robin without rewriting the note. Saving changes future captures; retained runs keep their captured modes and revisions.

## Entry and next action

Open The Council, choose Setup, then Councils & roster. Create
teams or councils, select their CoWorker membership and configure each round. Save
or discard drafts, duplicate or archive definitions, and preview import or export.
Manage CoWorkers opens the dedicated vault inventory. Return through the owning
[The Council](council.md) surface.

## States and recovery

No definitions; No team; Invalid definition; Preserved drafts; Changed on disk; Permission issue. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilDefinitions.vue](../../../src/plugin/presentation/components/coforge/CouncilDefinitions.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

The saved-definition catalogue is a separate, searchable surface beside focused definition authoring; selected entries use the shared accent treatment. Narrow panes stack the catalogue above the editor.

## Configuration readiness

[Council setup readiness](council-setup-readiness.md) identifies enabled CoWorkers,
a usable project roster and compiled Council definitions. Its actions lead to the
existing management controls. Provider availability is checked separately; definition
authoring never grants tools or starts execution.

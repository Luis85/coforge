---
id: service-design
title: Service Design
goal: Define and refine a project's service through a linked Service Blueprint.
audience: streamer
kind: page
route: studio.view = service-design
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/ServiceDesignView.vue
entry:
  - Select a project, then choose Service Design in Build & Improve.
actions:
  - Create the project service blueprint
  - Add and order journey steps
  - Create and edit blueprint entities
  - Link related entities
  - Find and explore related entities
  - Preview authored Markdown
  - Open canonical note
  - Refresh saved notes
  - Configure the note storage folder
states:
  - Native unavailable
  - No selected project
  - Loading
  - No blueprint
  - No journey steps
  - Saved blueprint
  - No matching entities
  - Unsaved draft
  - Draft replacement confirmation
  - Validation or external-edit conflict
  - Invalid or duplicate notes
journeys:
  - service-design
  - multi-project
privacy: Private project notes; excluded from public projections and capture surfaces.
coverage:
  group: studio
  key: service-design
order: 58500
type: Feature
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

# Service Design

## Purpose

Define a project's service as one Service Blueprint. Ordered journey steps form
the columns; physical/digital evidence, customer actions, frontstage actions,
backstage actions and support processes form the core rows. Linked actor/role,
touchpoint/channel, system, pain-point and opportunity notes complete the map.

## Entry and next action

Select the project in the studio switcher and choose Service Design in Build &
Improve. Create its blueprint, describe the customer scenario and service goal in
Markdown, and add journey steps in delivery order. Add a core-layer entity from
its grid cell or create a supporting entity from the entity toolbar. Select a
saved entity to edit its title, details, step, order or related entities; saving is
explicit. Open note reaches the canonical Markdown file in Obsidian.

Find related entities by title or type while editing, select the notes to link, and
follow the saved relationships through Explore related entities. Preview Markdown
shows authored detail without saving the draft.

Return through the owning [CoForge studio](studio.md). Selecting another project
changes the displayed blueprint and restores that project's independent draft.
Navigation does not save a draft or start agent work.

## States and recovery

Desktop Obsidian provides canonical note operations. An unavailable host or missing
project explains how to reach a usable state. Empty blueprints lead to journey
creation; an empty inventory or unsuccessful search provides its own next action.

Validation and failed writes keep the current draft. Refresh reloads saved notes
without replacing unsaved work. When a note changed externally, refresh and select
its saved revision; replacing an unsaved draft requires an explicit choice.
Malformed or duplicate managed notes are reported for repair, and writes are
blocked until the collection can be validated.

## Composition and boundaries

The page inherits the studio's centered operating frame, leaf-relative gutters,
native interface font, theme colors, semantic buttons and labelled fields. Open
sections and separators distinguish the map, editor, inventory and storage task.
The map is a captioned data table with scoped journey and layer headers, named
service boundaries and contextual cell actions. Narrow leaves scroll the map
inside its labelled region and stack editor fields. Opening an editor focuses its
title; a blocked draft replacement focuses the explicit recovery choice.

Each entity is an Obsidian-compatible frontmatter and Markdown note with a stable
ID, project/blueprint ownership and internal links. Metadata edits preserve
unrelated frontmatter and authored body bytes. Related entities belong to the same
blueprint. Existing entity kinds cannot change through an edit.

The vault-wide root defaults to `CoForge/Service Design`, with project subfolders.
Changing it affects new notes; prior folders remain discoverable. Storage rejects
public export overlap and protected paths. The page and its notes stay private,
with no public projection, provider dispatch or automatic repository publication.

Implementation acceptance and closeout evidence are tracked in the
[Service Design improvement plan](../../project-tasks/2026-10-29-service-design-improvement-plan.md).

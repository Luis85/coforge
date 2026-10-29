---
id: council
title: The Council
goal: Ask for specialist advice and follow each task to attributed results.
audience: streamer
kind: page
route: studio.view = council
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/CouncilView.vue
entry:
  - Choose The Council in the studio navigation.
actions:
  - Ask a question
  - Review task history
  - Choose a workspace tab
  - Refresh
  - Explore labelled example
states:
  - Native unavailable
  - Example
  - No project
  - Loading
  - Error
journeys:
  - Council
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: council
order: 44000
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

# The Council

## Purpose

Ask for specialist advice and follow each task to attributed results.

Ask the Council is the first page, with a new-question intake and task history. Definitions, existing-note submission, watched inboxes, monitoring, proposal workflows, messages and storage folders remain focused tasks in visible workspace tabs.

## Entry and next action

Choose The Council in the studio navigation to open [Ask the Council](council-ask.md). Write a question or review [Ingested tasks](council-task-history.md). Choose a workspace tab for configuration, existing-note submission or detailed recovery. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Native unavailable; Example; No project; Loading; Error. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilView.vue](../../../src/plugin/presentation/components/coforge/CouncilView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

The sidebar switcher identifies the selected project. Questions name their project
Council explicitly and resolve its owning team internally; no repeated project band precedes the form. The
question form includes a vault-file picker for an appended wikilink list. Task
history leads the first page; advanced authoring, submission, watched intake,
execution, messages and folder administration retain focused local tasks. Reusable
specialists have their own [CoWorkers inventory](coworkers.md).

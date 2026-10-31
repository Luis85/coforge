---
id: settings-general
title: Project details
goal: Set project identity, visibility, optional features, brief and shared agent instructions.
audience: streamer
kind: subpage
route: studio.settingsTool = general
parent: "[[docs/components/views/settings]]"
component: src/plugin/presentation/components/coforge/SettingsGeneralSection.vue
entry:
  - Open Project settings, then General.
actions:
  - Edit project name and description
  - Choose public or private visibility
  - Select visible groups and individual optional features for this project
  - Edit the general agent prompt
  - Save or discard project settings
states:
  - No project
  - Saved
  - Unsaved draft
  - Invalid draft
  - External configuration change
  - Publication blocked
journeys:
  - setup
  - multi-project
  - workflow-configuration
privacy: Private configuration; project visibility controls discovery, viewer requests and public projection eligibility.
coverage:
  group: settings
  key: general
order: 74500
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

# Project details

## Purpose

Set the selected project's identity, visibility, brief and shared agent instructions.
The general prompt is prefixed to dispatches without expanding tool permissions
or repository boundaries.

## Entry and next action

Open Project settings at the bottom of navigation, then General. Edit the project
name, visibility, description and general agent prompt under Project details. Save project settings
explicitly; General, Requests and Repository share the same retained draft.

Under Project features, keep the Build & Improve, Stream, Community and Insights
group controls and choose individual features beneath them:

| Group | Individual choices |
| --- | --- |
| Build & Improve | Idea board, The Council, CoWorkers, Service Design, Agent workflow |
| Stream | Stream studio, Alerts, Schedule, Stream chat, Twitch operations |
| Community | Community, Viewers, Economy, Community settings |
| Insights | Statistics, AI costs, Finances, Operations |

Each choice has a description; groups report selected counts. Hiding a group keeps
its child choices, which return when that group is shown. Internal tabs, editors,
templates and providers belong to their owning feature; they are not additional
activation switches. Essential settings, project switching and vault integration
setup remain available. Shared channel and vault data retain their actual scope.

The canonical project note stores groups in `coforge-feature-groups` and individual
choices in `coforge-features`. Missing properties keep existing capabilities; an
empty individual list selects none. Selection is saved explicitly and restored
after project changes or reload. Failed/stale saves preserve the draft and existing
note content.

Stream chat owns the board's chat and toggle; Stream studio owns live controls.
They can be selected independently. Council and workflow launch shortcuts follow
their choices, while existing cancellation and final human review remain available.
Shared services, public projections and captured/background work keep running.
Project settings and the switcher remain available even with no features selected.

## States and recovery

Failed or stale saves retain edits. Changing projects or leaving dirty settings
uses the existing save-or-discard guard. An explicit successful visibility change
is required to restore publication after a blocked reconciliation. Private
projects remain excluded from viewer discovery and commands; previously deployed
GitHub Pages content requires republishing.

## Composition and boundaries

The General section belongs to [Project settings](settings.md) and uses the shared
project-settings save boundary. Local navigation never saves or starts agents.
Canonical note identity, unrelated frontmatter and Markdown body remain preserved.
The project switcher identifies the active project and its private visibility.

Agent workflow is a sibling settings section. Its flat Idea Board Workflow,
Step attempts, Timing & limits, Answer / output templates and Herdr tabs have
their own authoring boundaries. General settings does not own the workflow's
startup preference or release per-request operator stop holds.

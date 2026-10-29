---
id: settings-general
title: Project details
goal: Set project identity, visibility, brief and shared agent instructions.
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

---
id: native-claude
title: Claude Code settings
goal: Configure the local CLI used by agent execution.
audience: streamer
kind: panel
route: native settings / Claude Code
parent: "[[docs/components/views/native-settings]]"
component: src/plugin/presentation/components/coforge/PluginSettingsClaude.vue
entry:
  - Within Obsidian Settings → Community plugins → CoForge, use the Claude Code section.
actions:
  - Edit executable settings
  - Save integration settings
  - Check Claude Code
states:
  - Native unavailable
  - Configured
  - Invalid executable
  - Unsaved
  - Checking
  - CLI available
  - CLI missing or too old
journeys:
  - setup
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
order: 9000
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

# Claude Code settings

## Purpose

Configure the local CLI used by agent execution.

The native executable is configured vault-wide. Choose the provider for each project's AI steps in Workflow settings; project repository/worktree boundaries and implementation permission remain in Project settings.

## Entry and next action

Within Obsidian Settings → Community plugins → CoForge, use the Claude Code section. Edit the native executable, save integration settings, then choose **Check Claude Code**. The check uses the saved executable path. Return through the owning [CoForge integration settings](native-settings.md) surface.

## States and recovery

Save a changed executable path before checking it. The check reads only the CLI version: it makes no model request and does not verify account sign-in. Availability or a missing/old CLI status appears beside the control; a shell-wrapper warning directs Windows users to the native executable. A working CLI does not override project implementation permission or per-step access restrictions.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettingsClaude.vue](../../../src/plugin/presentation/components/coforge/PluginSettingsClaude.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `setup`, `workflow-configuration`.

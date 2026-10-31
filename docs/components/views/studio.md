---
id: studio
title: CoForge studio
goal: Reach the private workspace for the task at hand.
audience: streamer
kind: shell
route: Obsidian CoForge view
parent:
component: src/plugin/presentation/components/coforge/StudioApp.vue
entry:
  - Use the CoForge ribbon or the Open CoForge command in Obsidian.
actions:
  - Choose navigation group
  - Select project
  - Reopen navigation or chat
  - Open help
states:
  - Loading
  - Invalid persisted data
  - Ready
  - Narrow layout
  - Collapsed panels
journeys:
  - setup
  - request-to-recognition
  - broadcast
  - Council
privacy: Private vault workspace; excluded from public projections.
order: 20000
type: Epic
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

# CoForge studio

## Purpose

Reach the private workspace for the task at hand.

The shell owns navigation, header, notifications and overlays. Stream studio opens initially. Shared chat and background processing survive project selection.

Navigation follows Build & Improve, Stream, Community and Insights. Project settings
is a persistent entry at the bottom and owns Agent workflow; Community settings
stays in Community. Projects opens through the persistent
project switcher. The top bar identifies the actual data scope: project identity
for Build & Improve work, Channel workspace for shared tools, and Vault workspace for
cross-project data. CoWorkers has a dedicated vault-wide inventory in Build &
Improve. Group headers collapse their destinations independently; the plugin's
localStorage restores their state on reload. See the
[information architecture](../INFORMATION-ARCHITECTURE.md).

Navigation and chat sidepanel collapse preferences also persist in localStorage
and remain separate from temporary narrow-layout hiding. The view reserves only
the actual overlapping Obsidian status-bar inset; detached views do not inherit
another window's footer gap. Notifications use a bounded, dismissible stack;
success text announces status and error text announces an alert.

## Entry and next action

Use the CoForge ribbon or the Open CoForge command in Obsidian. Available actions: Choose navigation group; Select project; Reopen navigation or chat; Open help. This is an independent entry surface.

## States and recovery

Loading; Invalid persisted data; Ready; Narrow layout; Collapsed panels. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StudioApp.vue](../../../src/plugin/presentation/components/coforge/StudioApp.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `request-to-recognition`, `broadcast`, `Council`.

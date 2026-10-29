---
id: broadcast-displays
title: Stream displays
goal: Open the read-only surface intended for OBS capture.
audience: streamer
kind: subpage
route: studio.broadcastTool = displays
parent: "[[docs/components/views/broadcast]]"
component: src/plugin/presentation/components/coforge/StreamDisplaysPanel.vue
entry:
  - Open Stream studio, then choose Public displays.
actions:
  - Preview and explicitly publish approved text into a supported OBS Text source
  - Save, refresh, clear or remove an owned text-overlay mapping
  - Show selected project on stream Kanban
  - Open Kanban, chat, leaderboards or community tab
  - Preview public surface
  - Close public display preview
states:
  - Native unavailable
  - Unavailable project
  - Embedded preview
  - Display opened
  - Open or project-change failure
journeys:
  - broadcast
  - public-sharing
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: broadcast
  key: displays
order: 33000
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

# Stream displays

## Purpose

Open the read-only surface intended for OBS capture.

Each **Open … tab** action opens a fresh main-workspace tab that can be detached manually. **Show selected project on stream Kanban** uses the studio's selected project and may reuse an existing main-workspace Kanban tab. The public projection excludes private controls and diagnostics.

The text-overlay composer sends selected public content to a supported OBS Text
input. It captures an exact preview and target before explicit publication. Saved
mappings support request, accepted-work, recognition, now-playing and fixed reviewed
Council-excerpt content; they can be refreshed by manual or explicitly bound show
cues. It never extracts private Council prompts or publishes during navigation.
Clearing checks ownership of the last published text. A disconnected or uncertain
external OBS copy stays visibly unresolved until the operator confirms clearing.

## Entry and next action

Open Stream studio, then choose Public displays. Select a project through the studio's project selector before showing it on the stream Kanban. Open the desired public tab, then detach it through Obsidian's tab menu for OBS capture. Return through the owning [Stream studio](broadcast.md) surface.

**Preview …** embeds the public surface within the private studio. Its surrounding studio controls remain private: capture the detached public window, never this embedded preview's parent page.

## States and recovery

Native actions are unavailable in the browser example; previews remain inspectable. An open/project-change error appears beside the launcher. Detached public window names remain stable as projects change; a capture window pauses if another pane or dialog appears and closes on plugin unload. After reload, reopen a public tab and detach it again.

## Presentation and information hierarchy

Each of the four display choices has a named launch and preview action. The preview is framed inside private studio controls; the detached public window remains the capture target. Public content receives only the public projection.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamDisplaysPanel.vue](../../../src/plugin/presentation/components/coforge/StreamDisplaysPanel.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`, `public-sharing`.

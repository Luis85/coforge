---
id: public-kanban
title: Public stream Kanban
goal: Show the community the screened request backlog.
audience: viewer / OBS capture
kind: public
route: Obsidian stream surface = kanban
parent:
component: src/plugin/presentation/components/coforge/StreamRequestBoard.vue
entry:
  - Use the Stream Kanban ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture.
actions:
  - Open from ribbon or Stream displays
  - Detach manually
  - Read projected cards
states:
  - No public project
  - Awaiting screening count
  - Empty column
  - Screened cards
journeys:
  - public-sharing
  - community
privacy: Explicit public whitelist; read-only.
coverage:
  group: public
  key: kanban
order: 17000
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

# Public stream Kanban

## Purpose

Show the community the screened request backlog.

Only screened requests cross the public projection. Private notes, prompts, moderation, finances and logs are excluded.

## Entry and next action

Use the Stream Kanban ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture. Available actions: Open from ribbon or Stream displays; Detach manually; Read projected cards. This is an independent entry surface.

## States and recovery

No public project; Awaiting screening count; Empty column; Screened cards. When data is unavailable, inspect the connection or project in the private studio. Public capture remains read-only.

## Composition and boundaries

The capture title, project identity and screened-request summary lead the board. Stage headings combine text and theme color; count markers stay beside their stage. Every card retains its public ID, demand, authorship and screening/status context. No private actions or raw unscreened text are added.

Source: [src/plugin/presentation/components/coforge/StreamRequestBoard.vue](../../../src/plugin/presentation/components/coforge/StreamRequestBoard.vue). Use the StreamSurfaceView public display shell and its explicit projection. The public surface has its own Obsidian tab and contains no private mutation controls.

Journey tags: `public-sharing`, `community`.

## Project privacy

Only requests whose canonical parent project is public are eligible. A selected private, unavailable or missing project produces a generic empty identity and board; the display never falls back to private active settings.

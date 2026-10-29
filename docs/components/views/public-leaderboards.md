---
id: public-leaderboards
title: Public leaderboards
goal: Recognize visible community contributions.
audience: viewer / OBS capture
kind: public
route: Obsidian stream surface = leaderboards
parent: "[[docs/components/views/public]]"
component: src/plugin/presentation/components/coforge/StreamLeaderboards.vue
entry:
  - Use the Stream Leaderboards ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture.
actions:
  - Open from ribbon or Stream displays
  - Detach manually
  - Read ranked metrics
states:
  - No contributions
  - One or more empty rankings
  - Ranked contributors
journeys:
  - public-sharing
  - community
privacy: Explicit public whitelist; read-only.
coverage:
  group: public
  key: leaderboards
order: 18000
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

# Public leaderboards

## Purpose

Recognize visible community contributions.

Only public display names, votes, screened ideas, accepted increments and badges cross the projection.

## Entry and next action

Use the Stream Leaderboards ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture. Available actions: Open from ribbon or Stream displays; Detach manually; Read ranked metrics. This is an independent entry surface.

## States and recovery

The surface shows all three rankings: supported ideas, idea makers and accepted-build contributors. Each ranking has its own empty state. There is no interactive metric selector; when data is unavailable, inspect it in the private studio. Public capture remains read-only.

## Composition and boundaries

The three ranking groups keep their named metric and explicit values. The first ranked contribution receives a subtle theme accent while visible rank numbers and native list semantics preserve meaning without color. Empty rankings explain the next participation step.

Source: [src/plugin/presentation/components/coforge/StreamLeaderboards.vue](../../../src/plugin/presentation/components/coforge/StreamLeaderboards.vue). Use the StreamSurfaceView public display shell and its explicit projection. The public surface has its own Obsidian tab and contains no private mutation controls.

Documentation parent: [Public](public.md). This family groups the public projections; the capture retains its independent entry and does not inherit the private studio shell.

Journey tags: `public-sharing`, `community`.

## Project privacy

Recognition is recomputed from public-project requests only. Private ideas, votes, implementations and badge progress do not increase public totals or reveal private-only contributors.

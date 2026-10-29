---
id: public-community
title: Public community
goal: Explain visible participation and community rewards.
audience: viewer / OBS capture
kind: public
route: Obsidian stream surface = community
parent: "[[docs/components/views/public]]"
component: src/plugin/presentation/components/coforge/StreamCommunity.vue
entry:
  - Use the Stream Community ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture.
actions:
  - Open from ribbon or Stream displays
  - Detach manually
  - Read rules and recognition
states:
  - No contributors
  - Configured names and ranks
  - Earned badges
journeys:
  - public-sharing
  - community
privacy: Explicit public whitelist; read-only.
coverage:
  group: public
  key: community
order: 16000
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

# Public community

## Purpose

Explain visible participation and community rewards.

Private viewer identities and moderation state stay behind the seam. Rules and public names are explicitly projected.

## Entry and next action

Use the Stream Community ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture. Available actions: Open from ribbon or Stream displays; Detach manually; Read rules and recognition. This is an independent entry surface.

## States and recovery

No contributors; Configured names and ranks; Earned badges. When data is unavailable, inspect the connection or project in the private studio. Public capture remains read-only.

## Composition and boundaries

Contributor recognition occupies the main column; the participation and rank guide has its own secondary surface. Badge descriptions and reward rules remain explicit, including the distinction between tracked chat presence and verified video watch time.

Source: [src/plugin/presentation/components/coforge/StreamCommunity.vue](../../../src/plugin/presentation/components/coforge/StreamCommunity.vue). Use the StreamSurfaceView public display shell and its explicit projection. The public surface has its own Obsidian tab and contains no private mutation controls.

Documentation parent: [Public](public.md). This family groups the public projections; the capture retains its independent entry and does not inherit the private studio shell.

Journey tags: `public-sharing`, `community`.

## Project privacy

Public contributor recognition and earned badges use public-project evidence only. Shared community vocabulary and the authored rank ladder remain channel-wide; private request evidence is excluded.

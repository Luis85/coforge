---
id: community-badges
title: Contributor badges
goal: Understand the milestones behind a contributor’s badges.
audience: streamer
kind: panel
route: community selected contributor badges
parent: "[[docs/components/views/community-profile]]"
component: src/plugin/presentation/components/coforge/CommunityBadges.vue
entry:
  - Within the selected contributor on Community, inspect earned and locked badges.
actions:
  - Inspect earned and locked badges
states:
  - No selection
  - Earned
  - Locked
journeys:
  - community
privacy: Private vault workspace; excluded from public projections.
order: 42000
type: Task
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

# Contributor badges

## Purpose

Understand the milestones behind a contributor’s badges.

Badges follow authoritative contribution milestones rather than manual acceptance in this display.

## Entry and next action

Within the selected contributor on Community, inspect earned and locked badges. Available actions: Inspect earned and locked badges. Return through the owning [Contributor recognition profile](community-profile.md) surface.

## States and recovery

No selection; Earned; Locked. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CommunityBadges.vue](../../../src/plugin/presentation/components/coforge/CommunityBadges.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `community`.

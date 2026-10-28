---
id: "community-profile"
title: "Contributor recognition profile"
goal: "Understand one contributor’s credited progress."
audience: "streamer"
kind: "panel"
route: "community.selected"
parent: "community"
component: "src/plugin/presentation/components/coforge/CommunityProfile.vue"
entry: ["Open Community, then select a contributor in the leaderboard."]
actions: ["Select contributor","Read credited ideas and accepted work"]
states: ["No selected contributor","Selected","No accepted work"]
journeys: ["community","request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
---

# Contributor recognition profile

## Purpose

Understand one contributor’s credited progress.

Only milestone-backed recognition is shown. This private inspection does not grant rewards by itself.

## Entry and next action

Open Community, then select a contributor in the leaderboard. Available actions: Select contributor; Read credited ideas and accepted work. Return through the owning [Community recognition](community.md) surface.

## States and recovery

No selected contributor; Selected; No accepted work. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CommunityProfile.vue](../../../src/plugin/presentation/components/coforge/CommunityProfile.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `community`, `request-to-recognition`.

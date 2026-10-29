---
id: "viewer-detail"
title: "Viewer profile"
goal: "Review a viewer’s private record and participation controls."
audience: "streamer"
kind: "panel"
route: "population.selectedId"
parent: "[[docs/components/views/population]]"
component: "src/plugin/presentation/components/coforge/PlayerDetails.vue"
entry: ["Open Viewers, then select a viewer name in the directory."]
actions: ["Inspect stats","Open private note","Apply eligible participation control"]
states: ["No selection","Registered","Unregistered","Blocked","Muted","Banned","Failure"]
journeys: ["community","moderation"]
privacy: "Private vault workspace; excluded from public projections."
---

# Viewer profile

Recorded rank, balances, participation and contribution facts lead the selected profile. CoForge participation controls and Twitch moderation follow as separate tasks with their existing explicit target confirmation. No profile statistic verifies video watch time.

## Purpose

Review a viewer’s private record and participation controls.

CoForge participation restrictions and Twitch moderation are distinct effects. Viewer notes preserve annotations and unrelated properties.

## Entry and next action

Open Viewers, then select a viewer name in the directory. Available actions: Inspect stats; Open private note; Apply eligible participation control. Return through the owning [Viewers and players](population.md) surface.

## States and recovery

No selection; Registered; Unregistered; Blocked; Muted; Banned; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PlayerDetails.vue](../../../src/plugin/presentation/components/coforge/PlayerDetails.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `community`, `moderation`.

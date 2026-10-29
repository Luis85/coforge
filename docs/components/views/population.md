---
id: "population"
title: "Viewers and players"
goal: "Inspect a viewer’s private participation record."
audience: "streamer"
kind: "page"
route: "studio.view = population"
parent: "[[docs/components/views/studio]]"
component: "src/plugin/presentation/components/coforge/PopulationView.vue"
entry: ["Choose Viewers in the studio navigation."]
actions: ["Search and filter","Select viewer","Refresh private notes","Clear filters","Page results"]
states: ["No viewers","No matches","No selection","Note sync pending or failed"]
journeys: ["viewer-intake","community","moderation"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"population"}
---

# Viewers and players

## Purpose

Inspect a viewer’s private participation record.

Observed viewers and registered players are distinct. Profiles and moderation remain private; tracked chat-presence time is not verified video watch time.

The participation overview separates observed viewers, registered players and the configured currency in circulation. Review not registered applies a reversible directory filter; it never registers or messages anyone. Clear filters restores the full directory. The selected profile leads with recorded statistics before participation and Twitch moderation controls.

## Entry and next action

Choose Viewers in the studio navigation. Available actions: Search and filter; Select viewer; Refresh private notes; Clear filters; Page results. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No viewers; No matches; No selection; Note sync pending or failed. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PopulationView.vue](../../../src/plugin/presentation/components/coforge/PopulationView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `viewer-intake`, `community`, `moderation`.

---
id: "community"
title: "Community recognition"
goal: "Understand who contributed to accepted progress."
audience: "streamer"
kind: "page"
route: "studio.view = community"
parent: "[[docs/components/views/studio]]"
component: "src/plugin/presentation/components/coforge/CommunityView.vue"
entry: ["Choose Community in the studio navigation."]
actions: ["Select contributor","Inspect badges","Review accepted releases"]
states: ["No contributors","Selected contributor","Earned or locked badges","Demo"]
journeys: ["request-to-recognition","community"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"community"}
---

# Community recognition

## Purpose

Understand who contributed to accepted progress.

Recognition follows screened ideas and accepted increments. Votes signal demand rather than permission to build or publish.

The contribution overview leads with makers, votes received and accepted increments from the same eligible contribution projection as the leaderboard. These are all-project totals, unaffected by the project switcher. Ranking modes and selected-contributor evidence remain the next step; no causal performance claim is inferred from votes.

## Entry and next action

Choose Community in the studio navigation. Available actions: Select contributor; Inspect badges; Review accepted releases. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

No contributors; Selected contributor; Earned or locked badges; Demo. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CommunityView.vue](../../../src/plugin/presentation/components/coforge/CommunityView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `community`.

---
id: "help"
title: "Studio guide"
goal: "Learn the request-to-recognition loop."
audience: "streamer"
kind: "dialog"
route: "studio.help = true"
parent: "[[docs/components/views/studio]]"
component: "src/plugin/presentation/components/coforge/HelpDialog.vue"
entry: ["Choose How it works in the studio navigation."]
actions: ["Read guide","Explore workflow","Close"]
states: ["Open","Demo explanation"]
journeys: ["setup","request-to-recognition"]
privacy: "Private vault workspace; excluded from public projections."
---

# Studio guide

The guide introduces the same Build & Improve, Stream, Community and Insights task groups as the sidebar, then follows the ordered request-to-recognition journey. Its workflow shortcut uses the guarded destination helper. Example commands remain illustrative and include an explicit project ID.

## Purpose

Learn the request-to-recognition loop.

Explains registration, requests, votes, workflow stages and human review. Samples are explicitly simulated and need no accounts.

## Entry and next action

Choose How it works in the studio navigation. Available actions: Read guide; Explore workflow; Close. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Open; Demo explanation. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/HelpDialog.vue](../../../src/plugin/presentation/components/coforge/HelpDialog.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `request-to-recognition`.

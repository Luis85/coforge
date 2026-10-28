---
id: "guided-setup"
title: "Guided stream setup"
goal: "Finish first-time OBS and Twitch readiness checks."
audience: "streamer"
kind: "panel"
route: "studio.setupRequested; studio.setupStep"
parent: "broadcast-setup"
component: "src/plugin/presentation/components/coforge/GuidedStreamSetup.vue"
entry: ["Choose Guided setup in the Stream studio header; the guide opens within Setup."]
actions: ["Reopen guide","Inspect installation","Connect tools","Review output","Change step","Close"]
states: ["Optional closed","Installation missing","WebSocket missing","Password or scopes missing","Human review needed","Ready"]
journeys: ["setup","broadcast"]
privacy: "Private vault workspace; excluded from public projections."
---

# Guided stream setup

## Purpose

Finish first-time OBS and Twitch readiness checks.

Readiness comes from current connections. The guide never launches a second OBS instance, reads stream keys or starts broadcasting.

## Entry and next action

Choose Guided setup in the Stream studio header; the guide opens within Setup. Available actions: Reopen guide; Inspect installation; Connect tools; Review output; Change step; Close. Return through the owning [Stream setup](broadcast-setup.md) surface.

## States and recovery

Optional closed; Installation missing; WebSocket missing; Password or scopes missing; Human review needed; Ready. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/GuidedStreamSetup.vue](../../../src/plugin/presentation/components/coforge/GuidedStreamSetup.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `broadcast`.

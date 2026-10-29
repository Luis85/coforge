---
id: "broadcast-setup"
title: "Stream setup"
goal: "Complete connection and readiness checks before going live."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = setup"
parent: "[[docs/components/views/broadcast]]"
component: "src/plugin/presentation/components/coforge/BroadcastSetup.vue"
entry: ["Open Stream studio, then choose Setup."]
actions: ["Guided setup","Connect or open OBS","Save profile and secret password","Choose scenes","Review readiness","Open Twitch settings"]
states: ["Native unavailable","Installation missing","Disconnected","Authentication issue","Scenes unavailable","Ready"]
journeys: ["setup","broadcast"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"broadcast","key":"setup"}
---

# Stream setup

## Purpose

Complete connection and readiness checks before going live.

OBS owns output credentials, devices and audio/video. The guide requires human output review and never reads stream keys or starts a broadcast.

## Entry and next action

Open Stream studio, then choose Setup. Available actions: Guided setup; Connect or open OBS; Save profile and secret password; Choose scenes; Review readiness; Open Twitch settings. Return through the owning [Stream studio](broadcast.md) surface.

## States and recovery

Native unavailable; Installation missing; Disconnected; Authentication issue; Scenes unavailable; Ready. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

Readiness is a separate checklist beside OBS configuration. Each check says Ready, Needed or Optional; color reinforces the text. A saved setup is not evidence of a current connection or permission to go live.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/BroadcastSetup.vue](../../../src/plugin/presentation/components/coforge/BroadcastSetup.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `setup`, `broadcast`.

---
id: "broadcast-music"
title: "Stream music"
goal: "Choose and control the local audio for this stream."
audience: "streamer"
kind: "subpage"
route: "studio.broadcastTool = music"
parent: "broadcast"
component: "src/plugin/presentation/components/coforge/StreamMusic.vue"
entry: ["Open Stream studio, then choose Music."]
actions: ["Refresh library","Select playlist","Play, pause or stop","Seek or set volume","Edit playlist","Open metadata note"]
states: ["Native unavailable","Example","No tracks","Missing file","Playing","Paused","Stale note conflict"]
journeys: ["broadcast"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"broadcast","key":"music"}
---

# Stream music

## Purpose

Choose and control the local audio for this stream.

Playback survives navigation and stops on plugin unload. Startup and go-live never start audio. The streamer reviews rights and configures OBS audio capture.

## Entry and next action

Open Stream studio, then choose Music. Available actions: Refresh library; Select playlist; Play, pause or stop; Seek or set volume; Edit playlist; Open metadata note. Return through the owning [Stream studio](broadcast.md) surface.

## States and recovery

Native unavailable; Example; No tracks; Missing file; Playing; Paused; Stale note conflict. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/StreamMusic.vue](../../../src/plugin/presentation/components/coforge/StreamMusic.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `broadcast`.

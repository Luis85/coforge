---
id: "public-chat"
title: "Public Twitch chat"
goal: "Show the current Twitch conversation on stream."
audience: "viewer / OBS capture"
kind: "public"
route: "Obsidian stream surface = chat"
parent: null
component: "src/plugin/presentation/components/coforge/StreamLiveChat.vue"
entry: ["Use the Stream Chat ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture."]
actions: ["Open from ribbon or Stream displays","Detach manually","Read live chat"]
states: ["Disconnected","No live messages","Connected messages"]
journeys: ["public-sharing","community"]
privacy: "Explicit public whitelist; read-only."
coverage: {"group":"public","key":"chat"}
---

# Public Twitch chat

## Purpose

Show the current Twitch conversation on stream.

Only live Twitch messages for the connected channel cross the projection. Local simulation and private diagnostics are excluded.

## Entry and next action

Use the Stream Chat ribbon, or open Stream studio → Public displays and launch this surface. Detach its Obsidian tab manually when needed for capture. Available actions: Open from ribbon or Stream displays; Detach manually; Read live chat. This is an independent entry surface.

## States and recovery

Disconnected; No live messages; Connected messages. When data is unavailable, inspect the connection or project in the private studio. Public capture remains read-only.

## Composition and boundaries

The capture title and connection state precede a dedicated scrolling conversation region. The empty state explains when messages appear and how to participate. Registration/help guidance stays below the message history; local simulator messages remain excluded.

Source: [src/plugin/presentation/components/coforge/StreamLiveChat.vue](../../../src/plugin/presentation/components/coforge/StreamLiveChat.vue). Use the StreamSurfaceView public display shell and its explicit projection. The public surface has its own Obsidian tab and contains no private mutation controls.

Journey tags: `public-sharing`, `community`.

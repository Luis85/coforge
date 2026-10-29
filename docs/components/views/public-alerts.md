---
id: public-alerts
title: Public Alerts overlay
goal: Present prepared stream alerts to viewers through OBS.
audience: viewer / OBS Browser Source
kind: public
type: Feature
route: http loopback /alerts/{opaque-token}/
parent: "[[docs/components/views/public]]"
component: src/plugin/infrastructure/coforge/alerts-player.ts
entry:
  - Paste the URL from Stream → Alerts into an OBS Browser Source.
actions:
  - Render received text and selected media
  - Play queued live alerts
  - Clear playback on stop or disconnection
states:
  - Transparent idle
  - Playing alert
  - Waiting queue
  - Disconnected and cleared
journeys:
  - broadcast
  - public-sharing
privacy: Read-only rendered cue whitelist and explicitly selected media; no studio or vault browsing capabilities.
order: 17500
---

# Public Alerts overlay

## Purpose

Show the streamer’s prepared alert text and selected GIF/image, audio or video while OBS broadcasts. This is an independent public HTML source, separate from the private [Alerts editor](alerts.md).

## Entry and lifecycle

The source requires CoForge on the same desktop. It renders text literally, starts transparent, queues up to 20 waiting cues and discards overflow. Image and video share a contained visual region; text uses separate space and scales to fit without truncation. Short messages remain best for on-air readability. Duration ends all media. Stop, disconnect and plugin unload clear active and waiting cues. Refresh or reconnect receives future alerts only. Definitions and private event records never cross the public cue seam. Media routes use opaque runtime IDs and serve only files explicitly referenced by saved alert definitions; private folders and filenames are not included in cue URLs.

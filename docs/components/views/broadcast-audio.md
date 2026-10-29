---
id: broadcast-audio
title: OBS audio
goal: Hear and adjust the intended OBS mix without leaving the studio.
audience: streamer
kind: subpage
route: studio.broadcastTool = audio
parent: "[[docs/components/views/broadcast]]"
component: src/plugin/presentation/components/coforge/ObsAudioMixer.vue
entry:
  - Open Stream studio, then choose Audio.
actions:
  - Refresh observed audio inputs
  - Change mute and volume
  - Configure supported monitoring, sync and audio tracks
states:
  - Disconnected
  - Unsupported input
  - Observed
  - Applying
  - Unconfirmed outcome
journeys:
  - broadcast
privacy: Private operator controls; never included in public displays.
coverage:
  group: broadcast
  key: audio
order: 37100
---

# OBS audio

## Purpose

Operate the OBS audio mix with explicit source identities and current observations.
OBS monitoring changes where OBS routes audio; it does not create a remote audio
player in CoForge. Local Music playback remains a separate service that OBS captures.

## Interaction and recovery

Mute and level controls affect the shared OBS input wherever it is used. Supported
advanced controls edit monitoring, sync and track routing. Unknown measurements stay
unavailable. An unconfirmed write blocks further mutations until OBS state is refreshed.

## Composition

Owned by [Stream studio](broadcast.md). The mixer adapts to narrow leaves and uses
labelled native inputs, semantic source names and the existing operation boundary.

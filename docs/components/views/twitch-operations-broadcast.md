---
id: twitch-operations-broadcast
title: Twitch breaks and raid preview
goal: Time ad breaks and inspect a raid destination before confirming.
audience: streamer
kind: panel
route: Twitch operations / Breaks & raids / readiness
parent: "[[docs/components/views/twitch-operations]]"
component: src/plugin/presentation/components/coforge/TwitchOperationsBroadcast.vue
entry:
  - Open Breaks & raids in Twitch operations.
actions:
  - Refresh ad schedule
  - Inspect destination
  - Select saved raid target
  - Review explicit action
states:
  - Missing or stale ad schedule
  - Current ad countdown and available snoozes
  - Destination loading or unavailable
  - Fresh target preview or expired preview
journeys:
  - broadcast
  - twitch-channel-operations
privacy: Private read-only previews. Ad or raid mutations require separate reviewed confirmation.
order: 85070
type: Task
---

# Twitch breaks and raid preview

## Purpose

Show upcoming ad timing and available snoozes from current authorized Twitch evidence.
Preview the destination channel's identity, category and live state before starting a raid.
Named raid action templates provide a reusable destination shortlist.

## Composition and boundaries

Read-only inspection never starts a raid or commercial. Countdown updates stop when the
view closes; stale or missing schedules never become invented availability. Raid reviews
require a fresh matching target preview and retain the usual account/channel gates.

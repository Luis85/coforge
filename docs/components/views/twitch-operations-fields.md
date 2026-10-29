---
id: twitch-operations-fields
title: Twitch action fields
goal: Enter validated action values with optional limits kept secondary.
audience: streamer
kind: panel
route: Twitch operations / action editor / fields
parent: "[[docs/components/views/twitch-operations-action]]"
component: src/plugin/presentation/components/coforge/TwitchOperationsFields.vue
entry:
  - Choose a channel action in Twitch operations.
actions:
  - Enter required values
  - Expand optional limits
states:
  - Empty or preserved draft
  - Required values missing
  - Optional values unchanged
journeys:
  - twitch-channel-operations
privacy: Private draft; only reviewed action parameters are sent after confirmation.
order: 85060
type: Task
---

# Twitch action fields

## Purpose

Enter the selected action's labelled values. Reward title, cost, prompt and availability
lead; cooldown and redemption limits live under an optional native disclosure.

## Composition and boundaries

The owning view provides its model through typed injection. Field definitions come from
the validated action catalogue. Editing a field invalidates the captured review; drafts
are preserved on failed execution and ordinary navigation.

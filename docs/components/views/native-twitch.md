---
id: "native-twitch"
title: "Twitch integration settings"
goal: "Connect streamer and bot accounts with required permissions."
audience: "streamer"
kind: "panel"
route: "native settings / Twitch"
parent: "[[docs/components/views/native-settings]]"
component: "src/plugin/presentation/components/coforge/PluginSettingsTwitch.vue"
entry: ["Within Obsidian Settings → Community plugins → CoForge, use the Twitch section."]
actions: ["Configure app and channel","Authorize accounts","Inspect scopes","Configure replies","Save"]
states: ["Unconfigured","Authorization pending","Connected","Expired","Missing scopes","Failure"]
journeys: ["setup","viewer-intake"]
privacy: "Private vault workspace; excluded from public projections."
---

# Twitch integration settings

## Purpose

Connect streamer and bot accounts with required permissions.

Tokens stay in secret storage. Bot reply preferences gate public automated messages. Connection never starts broadcasting.

## Entry and next action

Within Obsidian Settings → Community plugins → CoForge, use the Twitch section. Available actions: Configure app and channel; Authorize accounts; Inspect scopes; Configure replies; Save. Return through the owning [CoForge integration settings](native-settings.md) surface.

## States and recovery

Unconfigured; Authorization pending; Connected; Expired; Missing scopes; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettingsTwitch.vue](../../../src/plugin/presentation/components/coforge/PluginSettingsTwitch.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `setup`, `viewer-intake`.

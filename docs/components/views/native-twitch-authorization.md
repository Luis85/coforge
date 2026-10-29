---
id: native-twitch-authorization
title: Twitch authorization
goal: Grant the selected account’s required Twitch permissions.
audience: streamer
kind: panel
route: Twitch account authorization flow
parent: "[[docs/components/views/native-twitch]]"
component: src/plugin/presentation/components/coforge/TwitchAuthorization.vue
entry:
  - Within native CoForge Twitch settings, or Stream chat → Twitch settings, use the streamer or chatbot connection controls.
actions:
  - Connect or reconnect streamer
  - Connect or reconnect chatbot
  - Open Twitch authorization
  - Cancel authorization
states:
  - Missing client configuration
  - Awaiting browser authorization
  - Connected
  - Expired
  - Missing scopes
  - Failure
journeys:
  - setup
  - viewer-intake
privacy: Private vault workspace; excluded from public projections.
order: 12000
type: PBI
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Twitch authorization

## Purpose

Grant the selected account’s required Twitch permissions.

Streamer and bot identities remain explicit. Secret token handling belongs to native services rather than authored Markdown or public projections.

## Entry and next action

Within native CoForge Twitch settings, or Stream chat → Twitch settings, use **Connect streamer** or **Connect chatbot**; connected accounts offer the corresponding Reconnect action. A separate chatbot control appears only when the streamer account is not used as the chatbot. During authorization, choose **Open Twitch authorization** to approve the displayed code on Twitch, or **Cancel authorization** to stop waiting. Return through the owning [Twitch integration settings](native-twitch.md) surface.

## States and recovery

Missing client configuration; Awaiting browser authorization; Connected; Expired; Missing scopes; Failure. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/TwitchAuthorization.vue](../../../src/plugin/presentation/components/coforge/TwitchAuthorization.vue). This shared authorization panel appears in both native integration settings and the private Twitch settings subpage, using the surrounding form's container and shared buttons. Its external authorization work goes through the existing native/application services.

Journey tags: `setup`, `viewer-intake`.

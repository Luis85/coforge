---
id: alerts
title: Alerts
goal: Dispatch reusable viewer alerts into an OBS Browser Source.
audience: streamer
kind: page
route: studio.view = alerts
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/AlertsView.vue
entry:
  - Choose Alerts in the Stream navigation group.
actions:
  - Copy Alerts URL
  - Create, edit and delete an alert
  - Save text variables and selected vault media
  - Enable an automatic event binding
  - Fire a saved alert to OBS
  - Stop all alerts
states:
  - Source unavailable
  - Empty template library
  - Unsaved draft
  - Ready for dispatch
  - Missing variables or media
  - Save failed with draft retained
journeys:
  - broadcast
  - public-sharing
privacy: Private editor; the opaque loopback URL serves only prepared cues and explicitly selected media.
coverage:
  group: studio
  key: alerts
order: 81500
---

# Alerts

## Purpose

Create reusable text, GIF/image, audio and video alerts, then fire them manually or explicitly bind them to supported committed CoForge events. Private request events and simulator chat events are skipped. Automatic request titles and context follow the existing public projection: flagged and unscreened request text stays private; generic event/count and an available viewer display name can still thank a new submitter.

Curated Twitch bindings reuse the existing permission-filtered activity workflow for
follows, subscriptions, gifts, resubscription messages, cheers, incoming/outgoing raids,
new reward redemptions and stream online/offline facts. Configure unavailable collection
through Twitch operations → Data & access. Only safe public display-name, quantity and
reward-title fields are projected when known; anonymous or unverified anonymous-capable
identities omit the viewer variable. Raw messages, redemption input, moderation, account
identifiers and private linked context stay private. Facts from stale, pre-activation or
recorded-gap intervals are skipped; retained activity is never replayed.

## Entry and next action

Choose Alerts in Stream. Copy the URL into an OBS Browser Source on the same desktop, set the canvas dimensions, leave Local file off and enable Control audio via OBS. The source remains transparent while idle. CoForge must remain active. Saved templates and the endpoint identity live in the private plugin directory; the stable URL has read-only access and must only be shared with intended sources.

## States and recovery

The private editor retains drafts when navigating, choosing another alert or failing a save. Save before firing. Variables are plain text, never executable HTML or expressions. Media must be a supported existing vault file of at most 25 MiB. Missing variables skip automatic dispatch and show an editor error. An occupied saved port or invalid saved configuration leaves the source unavailable; free the port or restore the configuration and reload CoForge.

## Composition and boundaries

Live source state and saved-alert dispatch lead the page. First-time setup and template editing are expandable secondary tasks. Fire reports accepted connected pages, rather than asserting visible or audible playback; zero-source dispatch is rejected with OBS setup guidance. Files are checked before dispatch, and enabled automatic bindings reject variables their event can never supply. Drafts survive failures and choosing another template. Concise labels, associated help and keyboard focus support create, save, discard and delete.

Destructive removal identifies the exact template and requires confirmation. Stop clears active playback and queues while enabled future automatic bindings remain active. Alert playback ends after its configured duration, including audio/video. Each connected source queues up to 20 waiting alerts; overflow is discarded. Pending media checks are also bounded and cancelled by Stop, source loss or unload. Ordinary unrelated saves preserve playback. Removed media access and revoked public request visibility clear it.

Hidden sources that OBS unloads receive no missed alerts. Reconnection and plugin reload never replay cues. Source media URLs use opaque runtime identifiers; vault folders and filenames are excluded. No external URLs, arbitrary vault browsing or write endpoints are exposed. Reuse the same Browser Source across OBS scenes to avoid duplicate audio and unnecessary live connections.

The separate public player is served by `src/plugin/infrastructure/coforge/alerts-server.ts` with a transparent HTML document and self-contained script; it receives only rendered cue fields and selected media bytes, with no studio capabilities.

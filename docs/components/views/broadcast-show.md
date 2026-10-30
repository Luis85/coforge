---
id: broadcast-show
title: OBS show plan
goal: Prepare and explicitly run finite production cues with durable outcomes.
audience: streamer
kind: subpage
route: studio.broadcastTool = show
parent: "[[docs/components/views/broadcast]]"
component: src/plugin/presentation/components/coforge/ObsShowPlan.vue
entry:
  - Open Stream studio, then choose Show plan (second tab, after Broadcast).
actions:
  - Create and edit a show plan
  - Select a segment from the ordered rundown
  - Run a selected cue
  - Inspect step outcomes and acknowledge a partial cue
  - Explicitly enable or pause supported event bindings
  - Add a private moment marker
states:
  - Empty
  - Draft
  - Ready
  - Running
  - Partially applied
  - Unconfirmed
  - Automation paused
journeys:
  - broadcast
privacy: Show definitions, execution history and markers stay private in the vault.
coverage:
  group: broadcast
  key: show
order: 37300
---

# OBS show plan

## Purpose

Operate a show through named finite segments and explicitly mapped production
actions. A cue can select scenes, change audio, control supported recording/media,
show or hide an existing scene item and record a local moment marker. Cues do not
implicitly publish private Council tasks, change agent permissions or start broadcasting.

## Interaction and recovery

Saving a plan never executes it. Executing captures the selected definition and
persists each pending step before applying its effect. Confirmed steps stay applied
if a later step fails. Reload pauses automation and retains interrupted work for
explicit inspection and acknowledgement; it never replays the sequence.
Event bindings are explicit, finite, current-session actions. Missed events are
skipped, not queued for replay. The UI distinguishes local moment markers from
recording chapters, Twitch markers and saved replay files.

## Composition

Owned by [Stream studio](broadcast.md). Definitions and bindings remain separate
from run evidence. The ordered rundown shows segment durations and action counts;
selecting a segment exposes its private notes and cue actions without executing
them. Run controls identify the loaded plan and selected segment before the
detailed editor, with an explanation when execution is blocked. Unsaved changes
remain distinct from saved definitions. Choosing a plan in the loader does not
change the loaded run/delete target until explicitly loaded.

A retained partial result has a clear recovery action beside its step outcomes.
Native semantic controls preserve keyboard and narrow-pane use.

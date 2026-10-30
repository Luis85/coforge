---
id: schedule
title: Stream schedule
goal: Prepare a saved plan for a future stream.
audience: streamer
kind: page
route: studio.view = schedule
parent: "[[docs/components/views/studio]]"
component: src/plugin/presentation/components/coforge/ScheduleView.vue
entry:
  - Choose Schedule in the studio navigation.
actions:
  - New stream plan
  - Select plan
  - Save stream plan or discard changes
  - Open Markdown note
  - Refresh
  - Review saved preparation
  - Apply project, channel, scenes or music
states:
  - Native unavailable
  - Example
  - No plans
  - Draft
  - Conflict
  - Reviewed preparation
journeys:
  - stream-planning
  - broadcast
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: studio
  key: schedule
order: 73000
type: Feature
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

# Stream schedule

## Purpose

Prepare a saved plan for a future stream.

Plans are canonical Markdown notes. Saving does not update Twitch, OBS or playback. Preparation applies project, channel, scenes and OBS music separately.

For a saved plan, **Open Markdown note** opens its topics and script in Obsidian. Edit there and refresh this view; plan-property edits preserve the Markdown body and unrelated frontmatter. Mark a plan Planned, Completed or Cancelled through its status field.

## Entry and next action

Choose Schedule in the studio navigation. Create or select a plan and save it, then choose **Review saved preparation** for a planned stream. Apply only the desired project, channel, scenes or music step. Return through the owning [CoForge studio](studio.md) surface.

Applying channel metadata updates Twitch immediately. Scene assignments require OBS to be offline; music preparation adds missing source memberships disabled without starting playback. Finish checks and go live explicitly in Stream studio.

Music assignments select existing OBS Media/VLC sources for Live/BRB scenes. Refresh OBS sources explicitly; saved missing-source IDs remain visible for recovery. Configure files in OBS, then use Scenes and Show plan cues for visibility, playback, mute and volume. Existing memberships remain unchanged.

## States and recovery

Native unavailable; Example; No plans; Draft; Conflict; Reviewed preparation. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

Saved plans form a named selection column, beside the selected plan editor. Twitch metadata and OBS/music assignments are distinct editor sections with explicit timing of effects. Saving a plan does not update Twitch, start music or broadcast; preparation is reviewed and applied separately.

Temporary browser examples provide an explicit **Exit example** control. Exiting discards that example’s drafts and cached sample edits without mutating live services or vault content. Ordinary navigation keeps editable preview drafts; the explicit sample-cleanup action also closes temporary examples for the current studio pane. Native services are never replaced by preview services.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/ScheduleView.vue](../../../src/plugin/presentation/components/coforge/ScheduleView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `stream-planning`, `broadcast`.

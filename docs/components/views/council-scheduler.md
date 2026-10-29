---
id: council-scheduler
title: Task scheduler
goal: Schedule a private prompt for an agent, assigned team member or council.
audience: streamer
kind: subpage
route: council.tab = scheduler
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/TaskSchedulerView.vue
entry:
  - Open The Council → Advanced Council tools → Task scheduler.
actions:
  - Create or edit task
  - Set timer or recurrence
  - Enable or pause
  - Run now
  - Archive or restore
  - Inspect source and run
  - Acknowledge uncertain admission
states:
  - Desktop unavailable
  - Labelled example
  - Non-executor
  - Execution paused
  - Empty
  - Draft
  - Enabled
  - Archived
  - Skipped occurrence
  - Uncertain admission
  - Storage error
journeys:
  - Council
  - task-scheduling
privacy: Private plugin journal and ignored scheduled source notes; never included in capture views or public exports.
coverage:
  group: council
  key: scheduler
order: 54000
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

# Task scheduler

## Purpose

Send recurring prompts or timed tasks through the existing Council execution kernel. Team routing uses one explicitly selected member; it never wakes the whole team.

## Entry and next action

Open [The Council](council.md), expand Advanced Council tools and choose Task scheduler. Ask the Council remains the main landing page and task history. Designate the desktop in Run monitor and configure recipient definitions. Create a schedule, choose its project/team/recipient, prompt and optional context notes, then select a timer, interval, daily or weekly time. Save paused or explicitly enable future scheduling. Resume Council execution separately.

## States and recovery

Definitions, occurrence reservations and receipts are persisted privately. Missed occurrences and active-run overlaps are skipped with reasons. Timers execute only while the designated desktop and plugin are open. Calendar schedules retain their IANA timezone; missing DST times are skipped and repeated times run once.

Unknown admission outcomes disable future scheduling without replay. Inspect the recorded source and Run monitor, stop/recover the original work, then explicitly acknowledge before enabling new occurrences. Stale edits and persistence failures retain the form. Archiving affects future scheduling and preserves existing run evidence; restoring leaves it paused.

## Composition and boundaries

Use existing Council fields, responsive grids, controls and per-view Pinia state. The browser example is explicitly in memory and does not invoke providers or write vault files. Exit scheduler example or explicit global example cleanup discards its drafts and receipts and stops the example timer; ordinary navigation preserves drafts. Authored native schedules and their drafts are retained. Occurrences snapshot prompt and optional note context into private managed notes, preserving originals. Limits and final human review remain outside editable schedules.

Source: [TaskSchedulerView.vue](../../../src/plugin/presentation/components/coforge/TaskSchedulerView.vue). Full semantics: [Task scheduling](../../coforge/TASK-SCHEDULER.md).

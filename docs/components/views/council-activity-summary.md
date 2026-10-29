---
id: council-activity-summary
title: Council activity summary
goal: Understand the selected project's current Council work and find its next action.
audience: streamer
kind: panel
route: Council project activity across local pages
parent: "[[docs/components/views/council]]"
component: src/plugin/presentation/components/coforge/CouncilActivity.vue
entry:
  - Open any Council page with the desktop service or labelled example available.
actions:
  - View activity in the counted project
states:
  - No admitted work
  - Execution desktop needed
  - Paused
  - Active or queued
  - Needs attention or a decision
  - Completed
journeys:
  - Council
  - recovery
privacy: Private project execution evidence; excluded from public projections.
order: 44010
---

# Council activity summary

## Purpose

The summary counts the selected project's retained runs. It prioritizes actionable
work for inspection while showing the actual newest project activity timestamp
separately. View activity opens Activity → Runs & answers in that project and clears
conflicting stale filters so the inspected run cannot disappear behind them.

## Entry and next action

Open any Council task and choose View activity to reach the counted project and
prioritized run in Activity → Runs & answers.

## States and recovery

Concise count changes are announced without moving focus. Timestamps and extended
progress remain visible outside the live announcement. Provider responses, publication,
unknown outcomes and human decisions retain their existing meanings; navigation does
not resume execution, admit a task or start a provider.

## Composition and boundaries

The shared [Council](council.md) owns this panel. Project counts and the true latest
timestamp remain distinct from the discussion chosen for attention.

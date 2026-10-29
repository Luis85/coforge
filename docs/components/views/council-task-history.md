---
id: council-task-history
title: Council task history
goal: Find a saved question or retained ingestion and resolve its next action.
audience: streamer
kind: panel
route: Ask the Council / Ingested tasks
parent: "[[council]]"
component: src/plugin/presentation/components/coforge/CouncilAskView.vue
entry:
  - Open The Council and review Ingested tasks below the question form.
actions:
  - Search tasks
  - Review saved task
  - Inspect task
  - Show 50 more tasks
  - Refresh Council
states:
  - Empty
  - Saved note with no retained run
  - Queued or running
  - Completed
  - Failed or unknown outcome
  - Latest inbox observation
  - Saved-note catalogue unavailable
journeys:
  - Council
  - analytical-task
  - recovery
privacy: Private source paths, questions, project identities and run evidence; excluded from public projections.
order: 56687.5
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

# Council task history

## Purpose

Show retained task evidence across all projects, including direct submissions and watched intake. Every retained ingestion generation remains distinct, including failed and uncertain outcomes.

## Entry and next action

Open Ask the Council, then search Ingested tasks by title, source, project or status. Inspect task opens its retained run in the monitor. Review saved task restores an existing canonical source for preflight without creating or overwriting its note. Show 50 more tasks reveals another portion of the same evidence set.

## States and recovery

The list combines durable run records with canonical task notes and the latest unmatched inbox observations. A saved note labelled **no retained run** may be unsubmitted or may have had readable run history cleared; the UI does not claim it was never ingested. Inbox observations describe the latest reconciliation, not durable admissions. Failed task-note loading stays visible as incomplete history while retained runs remain available. Missing or pruned history is not reconstructed.

## Composition and boundaries

This panel is part of [CouncilAskView.vue](../../../src/plugin/presentation/components/coforge/CouncilAskView.vue). It joins saved task notes and retained runs by stable source identity. Saved tasks are read only from the dedicated private Council task folder; unrelated vault notes are not listed or rewritten. Retained results remain the execution journal's evidence, and an unknown outcome still requires explicit recovery.

Journey tags: `Council`, `analytical-task`, `recovery`.

---
id: settings-example-cleanup
title: Example content cleanup
goal: Review and explicitly remove sample and local-test content while preserving real requests.
audience: streamer
kind: panel
route: Project settings / Data & examples / Example cleanup
parent: "[[docs/components/views/settings-data]]"
component: src/plugin/presentation/components/coforge/ExampleContentCleanup.vue
entry:
  - Open Project settings, Data & examples, then Preview example cleanup.
actions:
  - Preview exact tracked requests
  - Inspect historical candidates
  - Select exact historical request IDs
  - Keep content
  - Confirm removal
  - Refresh a stale preview
states:
  - Closed
  - Loading preview
  - Paused automation required
  - Pending work blocked
  - Preview
  - Historical origin unknown
  - Working
  - Failed with selection retained
  - Committed
  - Recovery archive retained
journeys:
  - setup
  - multi-project
  - request-to-recognition
privacy: Private requests and note evidence stay within the vault. Cleanup uses exact IDs and never changes credentials, external game files or retained public request policy.
order: 76000
type: Task
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

# Example content cleanup

## Purpose

After experimenting, review exact sample and local-test request IDs before removal.
Tracked intake origin is private, persisted evidence. A simulation provider, a local
author or a familiar project name never makes a manually authored request a sample.

## Entry and next action

The preview automatically includes requests explicitly recorded as loaded samples
or local chat tests. It lists recognized original legacy samples and unknown
historical requests separately; neither group is selected until the streamer
chooses an exact ID. Project containers, manually authored and Twitch requests,
their votes and real cost evidence remain. Local simulator chat is removed;
unreferenced local profiles and the selected requests' run/activity history follow.
Simulation-only cost rows for those removed request generations are removed too;
real provider costs, manual cost evidence and retained requests' simulation history
remain. New sample work reusing an earlier request ID keeps its newer history.

## States and recovery

Preview and cancellation write nothing. Every project's request automation must
be paused, with no active or queued work or unresolved external effects. A changed
preview or note fails closed and must be refreshed. Failed persistence keeps the
preview and selection for retry. Notes use a staged, reversible archive before
the committed data update; a later trash failure leaves a private recovery copy.

Historical counters or external recovery evidence without trustworthy attribution
remain rather than being reset. Monotonic IDs and intake deduplication tombstones
remain so ordinary intake cannot replay deleted messages or reuse their IDs. Successful
cleanup also closes temporary in-memory examples without changing real services.
The nine example families are finance, AI costs, schedule, statistics, live studio,
music, Council, Herdr and task scheduler. Saved native schedules and their drafts
are preserved; the scheduler's example timer and cached receipts are discarded.

## Composition and boundaries

The panel belongs to [Backup and sample tools](settings-data.md). It owns preview
and confirmation state in a composable, while application services validate exact
selection and storage owns full-note comparison and transactional retirement.

---
id: "council-events"
title: "Event triggers"
goal: "Attach a saved workflow to committed project or application events."
audience: "streamer"
kind: "subpage"
route: "council.tab = events"
parent: "[[docs/components/views/council]]"
component: "src/plugin/presentation/components/coforge/WorkflowTriggersView.vue"
entry: ["Open The Council → Automation → Event triggers.", "Choose Attach an event trigger in either workflow editor."]
actions: ["Review saved workflow", "Create or edit trigger", "Enable future events", "Inspect decisions and runs", "Acknowledge uncertain admission", "Remove trigger"]
states: ["Desktop unavailable", "Non-executor", "Empty", "Draft", "Enabled", "Disabled", "Skipped event", "Uncertain admission", "Storage error"]
journeys: ["Council", "workflow-event-automation"]
privacy: "Private plugin journal and ignored automation notes; never included in public exports."
coverage: {"group":"council","key":"events"}
---

# Event triggers

## Purpose

Choose the event and listening scope, explicit target project and workflow type.
Review the current saved workflow revision, then save paused or explicitly enable
future matching events. Idea workflows use an existing request from the event or
a selected request from the target project. Note workflows capture a private event
source. Drafts stay in per-view state across navigation.

The designated open desktop reserves evidence before admission. Missed events,
paused execution, cooldowns and active previous runs are skipped with reasons.
Changed workflow revisions disable the trigger for explicit review. Unknown
admissions require inspection and acknowledgement; no automatic replay occurs.
Removing a binding preserves its run evidence. See [The Council](../../coforge/THE-COUNCIL.md).

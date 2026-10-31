---
id: idea-activity
title: Request activity
goal: Trace what happened to this request.
audience: streamer
kind: subpage
route: studio.drawerTab = activity
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaActivityTab.vue
entry:
  - Open a request’s details, then choose Activity.
actions:
  - Read chronological events
  - Inspect attempts
  - Read captured prompts and responses
states:
  - No activity
  - Recorded events
  - Failed attempt
  - History unavailable
  - Waiting for response
  - Simulated conversation
  - Truncated capture
journeys:
  - request-to-recognition
  - recovery
privacy: Private vault workspace; excluded from public projections.
coverage:
  group: idea
  key: activity
order: 27000
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

# Request activity

## Purpose

Trace what happened to this request.

Private activity retains attributed status changes and attempts. It is excluded from public capture.

## Entry and next action

Open a request’s details, then choose Activity. Available actions: Read chronological events; Inspect attempts. Return through the owning [Request details](idea-detail.md) surface.

## States and recovery

No activity; Recorded events; Failed attempt. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/IdeaActivityTab.vue](../../../src/plugin/presentation/components/coforge/IdeaActivityTab.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `request-to-recognition`, `recovery`.

## Workspace redesign

The timeline and attempt sections share the request evidence heading scale. Each
agent-run disclosure identifies its captured stage, provider/model, recorded reasoning effort, status and start
time. Expanding it reveals the captured prompt and response together; system
instructions and execution logs have subordinate disclosures. All evidence stays
literal, selectable text with line wrapping, native keyboard disclosure and visible focus.

Inputs are captured at dispatch, responses at receipt, and remain attached to their
original attempt across edits and reload. Reading does not dispatch or write.
Older attempts explicitly report missing history. Running, failed and cancelled
attempts identify unavailable responses. Simulations are labelled and do not imply
model contact; bounded captures visibly disclose truncation. A captured response
does not establish validation, completed implementation or human approval.

Conversation text remains in the private job journal and is excluded from public
viewer exports and structured diagnostic logs. Current settings and current request
content never substitute for missing historical evidence.

Coverage is the initial instructions/prompt and recorded provider output, not
intermediate tool turns or hidden model reasoning. External MCP clients show
**Task context** and **Submitted response** because CoForge cannot inspect
their full conversation or infer their model. Evidence follows the existing
latest-500 job retention; each text field retains at most 64,000 characters with
an explicit truncation notice.

**Captured prompt** identifies input retained before dispatch. Capture alone does
not confirm that the provider received it; launch failures, cancellation and
uncertain external delivery retain their original recovery semantics.

Recognizable credentials in Claude and Codex response captures are redacted before retention
and display. This privacy filter does not change the dispatched prompt or the raw
semantic output used for validation. It does not claim to detect every secret.

Reasoning effort appears only when captured in the dispatched workflow step.
Missing/default effort stays unspecified, and simulation/external-client history
never infers it from present-day settings.

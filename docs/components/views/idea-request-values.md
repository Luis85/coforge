---
id: "idea-request-values"
title: "Captured request fields"
goal: "Read and maintain private structured values using the request's original schema."
audience: "streamer"
kind: "panel"
route: "Request overview / Captured request object"
parent: "idea-overview"
component: "src/plugin/presentation/components/coforge/RequestValuesPanel.vue"
entry: ["Open Overview on a request created with a Request Object."]
actions: ["Read captured class and values","Edit optional values","Save request fields","Discard field changes"]
states: ["Captured values","Unsaved draft","Stale request","Save failure","Closed request"]
journeys: ["request-to-recognition"]
privacy: "Private request metadata; custom fields are never added to public projections."
---

# Captured request fields

## Purpose

Maintain the structured values captured when this request was created, even after the project's Request Object changes. Legacy requests without a captured schema retain their original note format.

## Entry and next action

Open Request overview. Optional text, number, date, checkbox and select controls use the captured definitions. Save request fields explicitly; successful changes require fresh screening. Discard reloads the current canonical values.

## States and recovery

Failed saves retain the draft and show the error. A changed request blocks saving until the streamer discards stale changes and reviews the latest values. Closed requests are read-only. Navigation preserves an unfinished per-request draft.

## Composition and boundaries

The panel belongs to [Request overview](idea-overview.md). Canonical guarded Markdown writes preserve IDs, unrelated frontmatter and exact body bytes. Captured properties participate in request revisions and untrusted agent context; they never grant execution permissions. Project definitions configure future requests and do not migrate existing notes.

---
id: "council-ask"
title: "Ask the Council"
goal: "Save a question and review the Council's proposed work before submitting."
audience: "streamer"
kind: "subpage"
route: "council.tab = ask"
parent: "[[docs/components/views/council]]"
component: "src/plugin/presentation/components/coforge/CouncilAskView.vue"
entry: ["Choose The Council in the studio navigation.","Choose Ask the Council from another Council task."]
actions: ["Write title and question","Choose Council and inspect recipients","Save task and review","Submit reviewed task","Start a new task","Review task history"]
states: ["No project or council","Unsaved question","Saved note","Preflight unavailable","Reviewed preview","Queued","Execution paused","Write conflict"]
journeys: ["Council","analytical-task"]
privacy: "Private analytical task notes and execution evidence; excluded from public projections."
coverage: {"group":"council","key":"ask"}
---

# Ask the Council

## Purpose

Write a new question or task, choose its Council and inspect the participating CoWorkers, then review the proposed work. This is the Council's first page; definition and administration tools remain secondary.

## Entry and next action

Choose The Council in the studio navigation. Enter Task title and Your question or task, select Council and inspect its CoWorkers and rounds, then choose Save task and review. Saving creates a canonical private Markdown note and runs preflight; it does not admit work, contact a provider or resume execution. Submission remains a separate reviewed action. Device designation and execution pause controls are available inline.

## States and recovery

An unsaved question remains in this pane while navigating. A successful save remains discoverable after reload even if preflight fails. The per-draft idempotency key makes retrying an uncertain save resolve the same note; changing a note or reusing its key for different content produces a conflict without overwriting bytes. Editing a successfully saved question starts a new draft identity and removes its old review while preserving the saved note. Start a new task also explicitly creates a new draft identity. Existing source files can be submitted through [Submit existing note](council-submit.md).

## Composition and boundaries

[CouncilAskView.vue](../../../src/plugin/presentation/components/coforge/CouncilAskView.vue) owns the question form and [task history](council-task-history.md). It reuses the reviewed submission and execution-control components. Canonical notes live in `CoForge/CouncilTasks`; typed task metadata accompanies the existing `submission/v1` source identity. The task folder is protected from public exports and watched-inbox overlap before writing. Generic analytical tasks do not create an Idea, viewer identity, votes, rewards or implementation authority.

Journey tags: `Council`, `analytical-task`.

---
id: "finance-entry"
title: "Finance entry"
goal: "Record or correct a single payment or recurring commitment."
audience: "streamer"
kind: "panel"
route: "finance selected entry or new draft"
parent: "[[docs/components/views/finance]]"
component: "src/plugin/presentation/components/coforge/FinanceEntryForm.vue"
entry: ["Within Finances, use the entry form or choose Edit beside an existing entry."]
actions: ["Choose kind","Enter amount, date and category","Choose optional stream","Set recurrence","Save","Start new entry"]
states: ["New","Editing","Invalid amount","Stale ledger","Saving"]
journeys: ["finance"]
privacy: "Private vault workspace; excluded from public projections."
---

# Finance entry

## Purpose

Record or correct a single payment or recurring commitment.

Recurring plans are commitments rather than payments. Reset starts a new entry; deletion is confirmed separately with the exact record.

## Entry and next action

Within Finances, use the entry form or choose Edit beside an existing entry. Available actions: Choose kind; Enter amount, date and category; Choose optional stream; Set recurrence; Save; Start new entry. Return through the owning [Stream finances](finance.md) surface.

## States and recovery

New; Editing; Invalid amount; Stale ledger; Saving. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Presentation and information hierarchy

The editor has its own neutral workspace surface next to the ledger. Entry type determines actual-payment attribution or recurring-plan fields. Edits retain existing validation, conflict detection and explicit deletion confirmation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/FinanceEntryForm.vue](../../../src/plugin/presentation/components/coforge/FinanceEntryForm.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `finance`.

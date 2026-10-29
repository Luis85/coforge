---
id: economy-fulfillment
title: Manual perk fulfillment
goal: Record manually completed perks from captured awards and purchases.
audience: streamer
kind: subpage
route: economy.page = fulfillment
parent: "[[docs/components/views/economy]]"
component: src/plugin/presentation/components/coforge/EconomyFulfillment.vue
entry:
  - Choose Fulfillment inside Economy.
actions:
  - Filter pending or fulfilled records
  - Find viewer or perk
  - Page records
  - Write a private fulfillment note
  - Record as fulfilled
  - Cancel the local note
states:
  - Empty queue
  - Pending
  - Fulfilled
  - Note dirty
  - Write failed
  - Concurrent entry changed
journeys:
  - community-economy
privacy: Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published.
coverage:
  group: economy
  key: fulfillment
order: 62000
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

# Manual perk fulfillment

## Purpose

The queue displays captured perk names, instructions, viewer identity and acquisition from command bonuses, purchases or loot boxes. It does not reinterpret old awards from today’s catalog. Filters, search and fifty-record pages keep long histories usable.

Deliver the perk outside CoForge, then explicitly record fulfillment. An exact per-entry revision prevents double fulfillment. A failed or stale write preserves the private local note and balances; recording completion never grants another reward or dispatches an external action.

## Entry and next action

Choose Fulfillment inside Economy. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

Empty queue, Pending, Fulfilled, Note dirty, Write failed, Concurrent entry changed. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

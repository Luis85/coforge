---
id: economy-lootboxes
title: Loot boxes
goal: Define purchasable weighted reward outcomes with visible exact odds.
audience: streamer
kind: subpage
route: economy.page = lootboxes
parent: "[[docs/components/views/economy]]"
component: src/plugin/presentation/components/coforge/EconomyLootboxes.vue
entry:
  - Choose Loot boxes inside Economy.
actions:
  - Add loot box
  - Set purchase price
  - Add reward outcomes and weights
  - Review effective odds
  - Remove draft outcome or box
states:
  - No rewards
  - No boxes
  - Incomplete weights
  - Zero-weight outcome
  - Effective reward odds
  - Dirty configuration
journeys:
  - community-economy
privacy: Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published.
coverage:
  group: economy
  key: lootboxes
order: 63000
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

# Loot boxes

## Purpose

Each box references saved catalog rewards. Nonnegative integer weights are supported and at least one outcome must have positive weight. Approximate percentages accompany exact fractions; repeated reward entries combine into the effective reward chance and also disclose the individual entry fraction. No random draw occurs while editing or saving.

Viewers inspect saved odds with !odds <box-id> and purchase an opening with !lootbox <box-id>. The box price is additional to that command fee. Bonus openings ignore the purchase price. Actual draws and captured outcomes are durably reserved so a failed write cannot produce a different retry outcome.

## Entry and next action

Choose Loot boxes inside Economy. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

No rewards, No boxes, Incomplete weights, Zero-weight outcome, Effective reward odds, Dirty configuration. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

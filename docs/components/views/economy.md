---
id: "economy"
title: "Economy"
goal: "Configure stream participation prices, earning and rewards."
audience: "streamer"
kind: "page"
route: "studio.view = economy"
parent: "studio"
component: "src/plugin/presentation/components/coforge/EconomyView.vue"
entry: ["Open Economy from the Community navigation group."]
actions: ["Choose a local Economy page", "Save rules", "Discard configuration draft"]
states: ["Loading", "Saved", "Dirty", "Stale configuration", "Save failed"]
journeys: ["community-economy"]
privacy: "Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published."
coverage: {"group": "studio", "key": "economy"}
---

# Economy

## Purpose

The Economy workspace owns one channel-wide configuration draft across its local pages. It uses community currency, not real-money prices. Opening or changing pages never runs a command, buys a reward, opens a box or records fulfillment.

Every command accepts a zero fee. Failed, rejected and duplicate semantic operations receive no charge or reward. The base earning rate shares the existing Community rule; subscriber currency is a total replacement rate.

Save applies configuration only to future successful operations. A configuration identity detects concurrent changes without making ordinary incoming usage receipts stale the draft. Failed saves preserve edits, and leaving the workspace is guarded until Save or Discard. Existing captured receipts and fulfillment facts keep their old definitions.

## Entry and next action

Open Economy from the Community navigation group. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

Loading, Saved, Dirty, Stale configuration, Save failed. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

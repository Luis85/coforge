---
id: "economy-earning"
title: "Presence earning"
goal: "Set base and subscriber currency rates for eligible tracked chat presence."
audience: "streamer"
kind: "subpage"
route: "economy.page = earning"
parent: "economy"
component: "src/plugin/presentation/components/coforge/EconomyEarning.vue"
entry: ["Choose Earning inside Economy."]
actions: ["Set the base rate", "Enable or disable a separate subscriber total rate"]
states: ["Zero income", "Inherited subscriber rate", "Separate subscriber total", "Dirty configuration"]
journeys: ["community-economy"]
privacy: "Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published."
coverage: {"group": "economy", "key": "earning"}
---

# Presence earning

## Purpose

Observed profiles, including unregistered viewers, can earn from eligible connected live chat-presence intervals. New profiles receive no automatic starting credits. Offline, disconnected and uncovered gaps are not filled. This measurement does not verify video watch time.

The subscriber total replaces the base rate rather than adding to it. An omitted premium value inherits the base rate; explicit zero is valid. Current subscriber evidence, participation restrictions and existing XP gates remain authoritative.

## Entry and next action

Choose Earning inside Economy. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

Zero income, Inherited subscriber rate, Separate subscriber total, Dirty configuration. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

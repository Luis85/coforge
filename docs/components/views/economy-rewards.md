---
id: "economy-rewards"
title: "Reward catalog"
goal: "Define virtual account rewards and manually delivered perks with purchase prices."
audience: "streamer"
kind: "subpage"
route: "economy.page = rewards"
parent: "[[docs/components/views/economy]]"
component: "src/plugin/presentation/components/coforge/EconomyRewards.vue"
entry: ["Choose Rewards inside Economy."]
actions: ["Add virtual reward", "Add manual perk", "Set purchase price", "Edit benefits or fulfillment instructions", "Remove a draft reward"]
states: ["Empty catalog", "Selected reward", "Virtual account benefit", "Manual perk", "Dirty configuration"]
journeys: ["community-economy"]
privacy: "Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published."
coverage: {"group": "economy", "key": "rewards"}
---

# Reward catalog

## Purpose

Virtual rewards grant configured currency, XP and reputation. Manual perks create captured fulfillment entries for the streamer; no external physical or game action is automated. Viewers discover prices with !shop and buy a reward with !redeem <reward-id>. The redeem command fee is additional to the catalog price.

Stable generated IDs are visible beside names. Changing a reward type clears its incompatible draft details. Removing a reward removes its draft command and box references; existing receipts and captured perk instructions remain intact.

## Entry and next action

Choose Rewards inside Economy. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

Empty catalog, Selected reward, Virtual account benefit, Manual perk, Dirty configuration. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

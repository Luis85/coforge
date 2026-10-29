---
id: economy-commands
title: Command prices
goal: Set fees and success benefits for every supported stream command.
audience: streamer
kind: subpage
route: economy.page = commands
parent: "[[docs/components/views/economy]]"
component: src/plugin/presentation/components/coforge/EconomyCommands.vue
entry:
  - Choose Command prices inside Economy.
actions:
  - Select a command
  - Set fee and virtual benefits
  - Assign bonus rewards and boxes
  - Inspect captured usage
states:
  - Free
  - Priced
  - No rewards configured
  - Recent usage empty
  - Dirty configuration
journeys:
  - community-economy
privacy: Private channel configuration, receipts and fulfillment notes. Only deliberate chat discovery exposes public catalog prices and odds; no private project data is published.
coverage:
  group: economy
  key: commands
order: 60000
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

# Command prices

## Purpose

All fourteen commands, including help and registration, have independent fees and success benefits. Purchase operations charge the command fee plus the saved catalog price; automatic bonus rewards and box prizes ignore catalog prices. Affordability uses credited chat-presence minutes at the configured base rate and never claims verified video viewing.

The receipt table distinguishes direct command benefits from captured virtual awards, manual perks and draws. It shows the latest fifty retained receipts without hiding their charged fee/purchase split. A receipt is evidence of a committed operation; changing this page never executes chat.

## Entry and next action

Choose Command prices inside Economy. Return through [Economy](economy.md) or the owning [CoForge studio](studio.md).

## States and recovery

Free, Priced, No rewards configured, Recent usage empty, Dirty configuration. Configuration edits share Save and Discard; private fulfillment notes have their own explicit action. Failures preserve local draft data.

## Composition and boundaries

Use the shared Economy frame and local navigation, native semantic fields and buttons, and one owning scroll region. This page never initiates provider work.

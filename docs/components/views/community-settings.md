---
id: "community-settings"
title: "Community settings"
goal: "Save community names, XP and reputation rules, and ranks."
audience: "streamer"
kind: "page"
route: "studio.view = community-settings"
parent: "studio"
component: "src/plugin/presentation/components/coforge/CommunitySettingsView.vue"
entry: ["Choose Community settings in the studio navigation."]
actions: ["Edit names","Edit XP and reputation rules and named ranks","Open Economy for currency income and prices","Save or discard"]
states: ["Saved","Unsaved","Invalid thresholds","Saving","Failure with retained draft"]
journeys: ["community"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"community-settings"}
---

# Community settings

This is channel-wide configuration, shared across every project. The scope summary shows saved versus unsaved configuration; environment labels, future earning rules and the rank ladder are distinct form sections. Existing balances and contribution history remain intact, and guarded navigation preserves a dirty draft.

## Purpose

Save community names, XP and reputation rules, and ranks. Currency income, subscriber totals, command fees and rewards live together in [Economy](economy.md). Community settings preserves the current Economy base rate when saving a naming or participation draft.

Labels and thresholds do not reset existing balances. Registration grants no initial balance.

## Entry and next action

Choose Community settings in the studio navigation. Available actions: Edit names; Edit earning rules and named ranks; Save or discard. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Saved; Unsaved; Invalid thresholds; Saving; Failure with retained draft. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CommunitySettingsView.vue](../../../src/plugin/presentation/components/coforge/CommunitySettingsView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `community`.

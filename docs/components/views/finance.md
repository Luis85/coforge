---
id: "finance"
title: "Stream finances"
goal: "Maintain the private stream ledger."
audience: "streamer"
kind: "page"
route: "studio.view = finance"
parent: "studio"
component: "src/plugin/presentation/components/coforge/FinanceView.vue"
entry: ["Choose Finances in the studio navigation."]
actions: ["Filter month or stream","Add or edit","Pause or activate plan","Confirm or cancel deletion","Refresh"]
states: ["Native unavailable","Example","No entries","Draft","Validation or conflict","Deletion confirmation"]
journeys: ["finance"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"studio","key":"finance"}
---

# Stream finances

## Purpose

Maintain the private stream ledger.

Actual EUR payments are separate from recurring planned monthly commitments. Plans never create payments. Ledger data is excluded from public projections.

## Entry and next action

Choose Finances in the studio navigation. Available actions: Filter month or stream; Add or edit; Pause or activate plan; Confirm or cancel deletion; Refresh. Return through the owning [CoForge studio](studio.md) surface.

## States and recovery

Native unavailable; Example; No entries; Draft; Validation or conflict; Deletion confirmation. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/FinanceView.vue](../../../src/plugin/presentation/components/coforge/FinanceView.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `finance`.

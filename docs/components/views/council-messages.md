---
id: "council-messages"
title: "Team messages"
goal: "Send bounded context or work to explicit team recipients."
audience: "streamer"
kind: "subpage"
route: "council.tab = messages"
parent: "council"
component: "src/plugin/presentation/components/coforge/CouncilMessages.vue"
entry: ["Open The Council, then choose Team messages."]
actions: ["Select team and recipients","Compose","Choose information or delegation","Send"]
states: ["No team","No recipients","Invalid limits","Pending","Delivered","Uncertain delivery"]
journeys: ["Council"]
privacy: "Private vault workspace; excluded from public projections."
coverage: {"group":"council","key":"messages"}
---

# Team messages

## Purpose

Send bounded context or work to explicit team recipients.

Information adds context without waking every member. Delegation has explicit recipients and finite inherited limits. Delivery is not completion.

## Entry and next action

Open The Council, then choose Team messages. Available actions: Select team and recipients; Compose; Choose information or delegation; Send. Return through the owning [The Council](council.md) surface.

## States and recovery

No team; No recipients; Invalid limits; Pending; Delivered; Uncertain delivery. Inspect an error beside the affected action before retrying. Saved state or observed external confirmation is evidence of completion; an unconfirmed effect requires inspection before another mutation.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/CouncilMessages.vue](../../../src/plugin/presentation/components/coforge/CouncilMessages.vue). Use the studio page heading, shared buttons and fields, semantic controls and the owning page scroll container. Panels share their parent layout rather than acting as browser routes.

Journey tags: `Council`.

## Workspace redesign

Team selection, authored message and bounded dispatch controls share Council form grouping. Context delivery remains distinct from recipient activation and completion.

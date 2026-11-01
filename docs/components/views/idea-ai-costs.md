---
id: idea-ai-costs
title: Request AI costs
goal: Understand the recorded AI cost and usage of one request.
audience: streamer
kind: subpage
route: studio.drawerTab = ai-costs
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaAICostsTab.vue
entry:
  - Open request details and choose AI costs.
actions:
  - Read known USD subtotal and cost coverage
  - Inspect attempt status, captured provider/model and cost provenance
  - Read available token usage and historical failed or retried charges
  - Refresh retained cost history without dispatching a provider
states:
  - No recorded attempts
  - Loading or unavailable cost history
  - Known provider-reported or manual cost
  - Unknown cost or token coverage
  - Simulation or not-started attempt
journeys:
  - request-to-recognition
privacy: Private project/request cost history; excluded from public projections.
coverage:
  group: idea
  key: ai-costs
order: 26900
type: Task
---

# Request AI costs

## Purpose

Read the canonical cost breakdown for one request without changing charges or
starting another invocation. Both project and request identity constrain the
history; the global AI Costs dashboard's filters stay independent.

## Entry and next action

Choose AI costs in [Request details](idea-detail.md). Read recorded attempts,
including failures, cancellations and retries. The known subtotal is explicitly
partial when cost is unavailable. Provider-reported, human-entered and simulated
values retain their own provenance; unknown values never become zero.

## Boundaries

Tokens retain their reported coverage. Native assistants are not counted again
when the provider already reports whole-query cost. A record is not a billing
invoice or proof of a successful increment. Viewing this tab never dispatches,
retries, changes a provider, edits a cost or accepts an increment.

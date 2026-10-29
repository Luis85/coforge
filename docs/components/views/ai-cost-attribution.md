---
id: "ai-cost-attribution"
title: "Agent, team and Council costs"
goal: "Compare retained attempt costs by captured agent, team or Council identity."
audience: "streamer"
kind: "panel"
route: "AI costs / Cost attribution"
parent: "[[docs/components/views/ai-costs]]"
component: "src/plugin/presentation/components/coforge/AICostAttribution.vue"
entry: ["Open AI costs and review Who used the AI budget."]
actions: ["Filter by agent", "Filter by team", "Filter by Council", "Regroup the same attempts", "Inspect partial coverage", "Clear attribution filters"]
states: ["Attributed", "Legacy unattributed", "Unknown cost", "Provider reported", "Manual fallback", "Simulation", "Not started without provider contact", "Filtered empty", "More than 50 identities"]
journeys: ["cost-review"]
privacy: "Private USD usage and captured execution identities; never included in public viewer projections. Prompts, source bodies and local paths are not analytics fields."
---

# Agent, team and Council costs

## Purpose

The same retained attempts can be grouped by agent, team or Council. The groups
overlap across dimensions and never become additional charges. Project and task
filters remain available above them. Missing cost is unavailable; simulation and
proven provider non-entry do not create guessed USD values.

## Entry and next action

Choose an identity filter or a grouping row to inspect its attempts. Agent and
team names come from immutable captured definitions; Council membership also
includes Councils expanded inside proposal workflows. Direct-agent work has no
Council. Verified native Herdr targets have their own identity namespace.

Attribution coverage is separate from monetary and provider-token coverage.
Legacy steps without reusable-agent identity keep their costs and appear under
the unattributed filter. Each history row keeps run, attempt and known parent/root
lineage; retries and uncertain outcomes remain separate records.

## States and recovery

Real provider costs and manual fallback retain their provenance. A proven
not-started attempt says no provider was contacted, has no guessed cost and
cannot receive a manual usage amount. Provider dispatches still in flight remain
pending; uncertain outcomes remain available for manual fallback where supported.

Clearing filters changes no execution or ledger data. Native run pruning awaits a
durable ledger refresh; an archive failure preserves the run. Captured attribution
and telemetry remain in the private ledger after the source history is pruned.

## Composition and boundaries

This panel shares [AI costs](ai-costs.md) state and its owning scroll container.
It uses typed composable actions; definitions and journal snapshots supply facts,
while the panel never starts agents or sends messages.

---
id: council-setup-readiness
title: Council setup readiness
goal: Find the next missing configuration prerequisite without mistaking it for provider readiness.
audience: streamer
kind: panel
route: Council Setup / Councils and roster / readiness
parent: "[[docs/components/views/council-definitions]]"
component: src/plugin/presentation/components/coforge/CouncilSetupReadiness.vue
entry:
  - Open The Council → Setup → Councils & roster.
actions:
  - Manage CoWorkers
  - Create default team
  - Edit project roster
  - Review Council
states:
  - Loading catalogue
  - Catalogue unavailable
  - Project needed
  - No enabled CoWorkers
  - No roster
  - Empty or disabled roster
  - Missing or invalid Council
  - Configured Council
journeys:
  - Council
privacy: Private catalogue facts; reusable CoWorkers are vault-wide and rosters/councils belong to the project.
order: 45010
---

# Council setup readiness

## Purpose

Readiness comes from the current definition catalogue: enabled CoWorkers, an enabled
project roster containing available members, and a Council that can compile against
its actual roster and members. Each missing prerequisite has an existing management
action. The user chooses only the Council when asking a question; the roster remains
the administrative source of membership.

## Entry and next action

Open Setup → Councils & roster. Follow Manage CoWorkers, Create default team,
Edit project roster or Review Council according to the observed blocker.

## States and recovery

These are configuration facts. Saving a provider/model does not prove that a connection
works, designate the execution desktop or start work. Runtime and execution controls
remain in Activity → Runs & answers, with necessary first-use controls also reachable
from Ask. Definitions retain stable IDs and explicit saves.

## Composition and boundaries

[Councils & roster](council-definitions.md) owns this panel; reusable specialist
authoring stays in [CoWorkers](coworkers.md).

Configured projects use a compact observed summary with management actions visible.
Explicit selection, creation and review reveal the definition editor. Catalogue refresh
and routine progress do not move focus or discard authored drafts.

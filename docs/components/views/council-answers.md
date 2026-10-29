---
id: council-answers
title: Council answers
goal: Read the captured discussion as attributed published contributions before inspecting execution machinery.
audience: streamer
kind: panel
route: Council Activity / selected retained run / published answers
parent: "[[docs/components/views/council-monitor]]"
component: src/plugin/presentation/components/coforge/CouncilAnswers.vue
entry:
  - Choose Read answers on a completed task or retained discussion.
actions:
  - Read published contributions
  - Return to the run list
  - Use the selected run's existing operational controls
  - Inspect contribution reference and reported usage
states:
  - No published answers yet
  - Awaiting publication
  - Published answers
  - Simulation
  - Missing contribution
  - Rejected proposed messages
journeys:
  - Council
  - analytical-task
privacy: Private captured questions, attributed answers and usage; excluded from public projections.
order: 51010
---

# Council answers

## Purpose

The reader leads with the human question title and captured Council identity. It shows
contributions only when the execution journal records successful publication, in the
captured invocation order. Simulations and explicitly skipped/missing contributions
remain labelled. It does not infer a consensus, hide dissent or synthesize an answer
that no CoWorker produced.

## Entry and next action

Choose Read answers in task history or Activity → Runs & answers. Read each
attributed contribution and open its reference/usage disclosure when needed.

## States and recovery

Selecting a discussion takes focus to its reader; routine progress does not repeatedly
move focus. Technical references, timestamps and reported usage remain available in a
disclosure. Unreported cost stays unknown. Recovery, rerun, allowance, export and plan
handoff controls retain their existing explicit boundaries below the reading surface.

## Composition and boundaries

[Runs & answers](council-monitor.md) owns this reader. The retained journal's
publication state remains authoritative; rendered Markdown does not grant tools
or approve implementation.

Back to runs clears only the inspected discussion and restores list focus, preserving
project/state/source filters. Existing run operations stay before long answers; the
selected run's controls are not duplicated in its list row. Their original state and
permission guards remain unchanged.

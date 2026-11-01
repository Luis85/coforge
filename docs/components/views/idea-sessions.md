---
id: idea-sessions
title: Agent sessions
goal: Inspect observed work for one request without controlling its agents.
audience: streamer
kind: subpage
route: studio.drawerTab = sessions
parent: "[[docs/components/views/idea-detail]]"
component: src/plugin/presentation/components/coforge/IdeaSessionsTab.vue
entry:
  - Choose Sessions on a private request card or in its details drawer.
actions:
  - Select a current or previous parent attempt
  - Filter an observed native assistant
  - Read live Peek observations and verification evidence
  - Pause or resume display follow
  - Open a read-only parent terminal follower on Windows
  - Read captured task history or the current increment
states:
  - No sessions
  - Queued or running parent attempt
  - Completed or failed attempt
  - Capture unavailable
  - Observed or tool-linked native assistant
  - Truncated observations
  - Follow paused with unread updates
  - Terminal follow unavailable
journeys:
  - request-to-recognition
  - recovery
privacy: Private operator observations; excluded from model and public projections.
coverage:
  group: idea
  key: sessions
order: 26500
type: Task
---

# Agent sessions

## Purpose

Inspect observed activity for one request's captured attempts while the provider
continues to own its execution and native assistants. Counts identify parent
attempts; native child rows require provider-emitted association. Tool-linked
identities, absent details and partial capture remain explicit.

## Entry and next action

Choose Sessions on a private card or the [Request details](idea-detail.md) tab.
Select a parent or observed child to read Peek. Scrolling upward pauses follow;
Resume returns to the latest retained entry. Existing captured history and the
current increment remain separate destinations.

## States and boundaries

Opening, reading or closing this surface never dispatches, resumes, sends input
to, cancels or takes over a provider. The Windows terminal follows the same
sanitized parent feed and has no provider input channel. Other platforms use
Peek. Existing workflow and recovery controls remain in their owning views.

Observations are bounded private evidence, not an execution or acceptance gate.
Missing history is not reconstructed from SDK databases or global rollouts.
Rendering is literal and follows no hidden reasoning or raw SDK payloads.
See [Inspect workflow sessions](../../coforge/AGENT-SESSIONS.md) for limits,
privacy and terminal prerequisites.

# Task: Run workflow sessions until completion and simplify agent operation

- Status: in progress
- Journey in `BRIEF.md`: dispatch a task/refinement, observe useful progress, and review an increment.

## Why

A new refinement still follows the old foreground timeout because the uncapped
path is tied to coding. Timing, turn/budget and retry-resource controls force the
owner to administer processes instead of working through the board.

## Traceability

The owner decision is recorded in `BRIEF.md`. The scaffold declares no matching
requirement or `vi-*` entries, so none are invented or marked implemented.

## Acceptance

- New ordinary Claude/Codex and MCP attempts capture a managed-session lifecycle,
  including read-only refinement and polishing. This does not grant tools, writes,
  delegation or access beyond their separately captured permissions.
- No task-duration, turn, USD or tool-call caps interrupt managed attempts. Native
  result/EOF/exit and explicit Stop govern completion; result validation and
  original descendant cessation remain required. Quiet periods are allowed.
- External MCP HTTP reply/socket closure is not treated as agent completion. A
  managed MCP task remains available for its submitted result or cancellation.
- Existing admitted legacy attempts keep their policy. Technical connection,
  setup, bounded output and shutdown proof mechanisms remain internal.
- Proven stopped attempts retain failure, spend and actual partial changes, then
  clean up their own resources automatically. Unknown/foreign ownership cannot be
  cleared or replayed. Explicit user Stop is never automatically resumed.
- Ordinary setup exposes agents/tasks and meaningful status/Stop/Continue, without
  timing, turn/budget or retry-epoch administration. Historical policy stays honest
  and read-only. The normal path uses installed supported CLI and OBS.

## Plan

1. Dedicated runtime, UX and recovery agents reproduce the old refinement path.
2. Write failing lifecycle, transport/EOF, cancellation, capture and UI regressions.
3. Capture the independent lifecycle policy and implement native/MCP enforcement,
   safe recovery and simple status/authoring through existing services.
4. Qualify quiet refinement and native children with real owned processes and
   installed CLI fixtures without paid model calls; verify in contained Obsidian.
5. Run project, UI/gallery, native ownership and host gates; self-review, commit,
   push, open a PR and merge only after required checks pass.

## Out of scope

Personal vault inspection, silently changing admitted executions, replaying unknown
effects, automatic human acceptance, global CLI/auth changes or a new agent engine.
Council/v2 and explicit legacy verification remain separately governed.

## Evidence

In progress. Initial failing regressions reproduce missing lifecycle capture and
the rejection of owned native lifetime records on a read-only refinement.

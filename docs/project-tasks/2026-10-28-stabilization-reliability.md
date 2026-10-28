# Stabilization review: privacy, reliability and maintenance

Status: implementation and independent review complete; local project/affected-browser gates passed. Native qualification belongs to the PR's real-Obsidian CI job.

## Review scope and findings

| ID | Priority | Evidence and impact | Resolution |
| --- | --- | --- | --- |
| R1 | P1 | Holding the Council preferences read, unloading the runtime, then releasing the read registered **8 new vault listeners**. The newly merged asynchronous Council startup could revive observation and polling after cleanup. | Fence workspace/Council initialization after every asynchronous phase. Source observation owns its own cancellation checks and cleans up a watcher whose configuration finished after unload. Three delayed-read regressions pass. |
| R2 | P2 | The Council composition file was already at its code-line limit; adding lifecycle safety exceeded 400 lines. | Extract source-observation startup into the existing lifecycle module. Aggregate Council cost projections at the runtime composition boundary alongside other cost sources. Source limits pass without compressed code or weaker thresholds. |
| R3 | P2 | An interval could be registered just before asynchronous startup returned its cleanup to the module, allowing unload to miss that handle. | Release cleanup immediately when the awaited handoff returns to an already disposed module. A fourth injected-timer regression reproduces the race and verifies the interval is cleared. |

## Boundaries inspected

- Public displays receive a frozen, read-only projection port. They cannot obtain studio host actions. `stream-surfaces.ts` and `public-board.ts` explicitly construct allowed public fields, screen requests, scope boards to projects, and exclude simulator/other-channel/diagnostic chat.
- `stream-views.ts` opens fresh main-workspace tabs, restores pinned project state and protects detached capture windows. The new private subpages reuse the existing display-launcher components; no privileged context crosses into their public Vue roots.
- `markdown.ts` creates allowlisted nodes, leaves HTML as text, blocks embeds and remote media, bounds input/tree size and validates external HTTP links. Configuration, logs and diffs retain source formatting.
- `StudioStore.transaction` clones state, awaits durable storage, then publishes events. `InvocationGate` serializes legacy and Council providers; `ExecutionScheduler` preserves pause and project gates. The stabilization changes do not alter provider grants, source-note canonicality, final code review or external-operation recovery.
- New view documents and sitemap tooling are repository artifacts. They contain source locations and user-facing contracts, not vault data, credentials or runtime history. The catalog validator checks coverage and freshness rather than introducing a second runtime router.
- Shared layouts use the leaf container's width, native theme/design tokens and existing UI ownership. The specialized board and public capture canvases keep their existing layouts.

These are code-level checks of the listed boundaries, supported by existing behavioral tests and the new regression. They are not a claim to have fuzzed every adapter or exercised live external services.

## Regression evidence

- New test failed before repair: `runtime-startup-disposal.test.ts`, expected 0 new registrations, received 8.
- Repaired lifecycle group: **4 files, 8 tests passed**, covering delayed workspace/Council/journal reads, HTTP authorization form encoding, private diagnostic exports, plugin host load/unload and Council vault composition.
- `npm run check:source`: code-line limits and locale parity passed, 2868 inputs / 226 translated keys at this checkpoint.
- `npm run -s dev:obsidian -- --json`: exit 1, real-Obsidian tooling not provisioned; nothing downloaded or launched.
- `npm run test:obsidian`: same exit 1 and provisioning limit. The PR enables existing end-to-end CI for native-host qualification.

## Remaining qualification

The final task report records full product/type/lint/build/browser checks and independent polish verdicts. Live Twitch, OBS, Claude and Herdr sessions require streamer-operated acceptance; browser examples are explicitly simulated. Local Node v24.20.0 differs from the repository pin v24.21.0; GitHub CI uses the pin.

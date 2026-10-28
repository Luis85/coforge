# CoForge application foundations

## Boundaries

`StudioService` is the application facade. UI composables call its use cases and consume snapshots;
they do not call HTTP, read secrets or write vault files. Vue components bind props/composables.
Pinia owns navigation, selected records and view feedback; application state remains canonical.
Consumers import `CoforgeApplication` and exported contracts from `features/coforge/api.ts`. The UI
receives that narrower facade, which excludes raw storage, worker internals and runtime lifecycle methods.

`StudioStore` serializes writes and exposes copied read models. It delegates recovery/note merging to
`studio-state.ts` and pre-write policies to `commit-policies.ts`. Those policies synchronize project
projections, enforce note integrity, settle eligible rewards and bound retained history. A failed save
leaves committed state unchanged. Idea/project Markdown IDs, unrelated properties and body bytes are preserved.

Players, balances, milestone claims, operational counters, delivery intents and stream messages are
stored in plugin JSON. Existing contributors are not silently registered. Missing new sections receive
defaults; invalid stored data is rejected and preserved rather than replaced with a demo.

## Interfaces and ownership

| Contract | Owner / implementation | Responsibility |
| --- | --- | --- |
| `StudioStorage` | `VaultStudioStorage`; in-memory fixture in tests | Canonical note and plugin-data persistence |
| `ChatSenderPort` | `TwitchApi` | Confirmed sends or classified safe failures |
| `PlayerModerationPort` | `TwitchApi` | External moderation and authoritative restriction reads |
| `LivePresencePort` | `TwitchApi` | Live session, complete paginated chat presence and restriction snapshots |
| `Timers` | Obsidian window timers; deterministic test timers | Owned scheduling and cancellation |
| `StudioEventSink` / `StudioEventListener` | Injected sink and application subscribers | Immutable committed facts, isolated observer failures |
| `TwitchSecrets` / `HttpRequest` | Host adapters | Credentials and network access, confined to integration code |
| `WorkflowDefinition` / `WorkflowRun` | Domain contracts and `ConfiguredWorkflowEngine` | Ordered definitions, immutable attempts/artifacts and revision-checked execution |
| `WorkflowWorkspaces` | `LocalWorkflowWorkspaces` and private journal | Durable reservations, exclusive shared worktrees, cumulative capture and final-review verification |
| `HerdrWorkflowGateway` / `HerdrAttemptFiles` | Local Herdr/native file adapters | Dedicated launch identity, one-shot delivery and bounded correlated result files |

`TwitchModule` composes accounts, authorization, WebSocket transport and application workers for one
plugin instance. No global singleton, second source of player truth or additional dependency container
is introduced. Its lifecycle owns every subscription and timer.

## Application services

- `chat.ts` handles sanitized command intake, stable provider identity, registration gates, cooldowns,
  duplicate-event detection and atomic acknowledgement intent.
- `population.ts` owns registration, local blocking, environment/rule changes and operational facts.
- `economy.ts` credits observed presence and trusted feature milestones. Durable milestone claims
  prevent repeated rewards after re-screening/retry. Changing names/ranks/rates never resets balances.
- `PlayerModeration` persists intent before external work, records confirmation and holds unknown
  outcomes across restarts. Snapshot leases prevent stale reads from overwriting newer actions.
- `LivePopulationTracker` owns complete live-presence sampling and interruption boundaries.
- `StreamMessageScheduler` owns announcement scheduling separately from presence accounting.
  It skips idle writes, resets live intervals after interruptions and never catches up missed posts.
- `BotDeliveryWorker` owns persisted reply/announcement intent, spacing, bounded retries for rate
  limiting and confirmed/failed/uncertain delivery. Explicit operator sends also persist intent first.

The application services depend on contracts, not Obsidian, Vue, Pinia or a concrete HTTP client.
Provider schemas, credentials, token rotation and protocol success checks stay in the Twitch adapters.
Opaque player IDs remain provider-prefixed so a rename cannot create a second account.

## Configurable workflows

`configured-workflow.ts` validates portable definitions: stable IDs, order, typed outputs,
access and limits. `configured-workflow-run.ts` validates captured runs, attempts and artifacts.
Step identity never selects tools or schemas. Legacy stage names remain transport compatibility
labels; `ConfiguredWorkflowEngine` advances its pinned cursor and commits results only after
checking the proposal revision, active attempt and exact bound artifact hashes.

`StudioService.saveWorkflow` writes a new project-note revision with a source precondition;
running definitions stay frozen. Manual checkpoints persist and release the worker. Host code
review remains separate from editable approval steps. Real cumulative changes are authoritative
host snapshots; missing semantic fields or later simulations cannot erase or replace them.

Provider adapters use `workflow-execution.ts` to select schemas by output and tools by access.
Native Claude and Herdr share a run workspace through `WorkflowWorkspaces`. The journal reserves
ownership before Git mutation and records verified descriptors before launch. Unknown external
outcomes retain holds; recovery can reuse only a verified idle target's workspace, otherwise it
retires that workspace. Final acceptance verifies lease state and the actual reviewed diff, then
checks application state again before committing. Acceptance never runs a Git merge.

Definitions live in project `workflow-definition` frontmatter; request `workflow-run` and
`workflow-history` contain managed progress. Template-safe serialization reverses exactly so
captured artifact bytes/hashes survive reload. Corruption hashes are not signatures: private
plugin-data integrity anchors independently reject forged or deleted managed progress. Human
annotations belong in note bodies. Legacy notes resolve defaults without incidental migration.

The private workflow editor, transfer preview and manual checkpoint drafts use per-leaf Pinia
stores. Composables own actions and lifecycle; Vue binds those models. Import validates before
replacing a draft and cannot run a step. Every configuration draft shares navigation/project-switch
guards. Export contains portable definitions, not credentials, workspace descriptors or histories.

`vault-folder-policy.ts` validates private/public separation at application, storage and publication
boundaries, including the actual host configuration directory. `protectPrivateData` appends managed
rules for the configured request folder before writes, preserving human ignore bytes and note bodies.
Already tracked files/history remain a repository-owner responsibility; no automatic Git mutation occurs.

## Events and effects

Use `studio.onEvent(listener)` for named post-commit facts such as `registered`, `reward-granted`,
`blocked` or `moderation-confirmed`. An event includes a fixed type, immutable operation record and
local commit revision. Records contain safe codes, effect, count, sequence and an optional subject ID.
Subscribers can read the current application snapshot for the associated projection.

Events publish only after storage succeeds. Retaining only the last 1,000 operational records does not
discard new facts from the commit's event delivery. Synchronous/asynchronous subscriber failures are
contained and reported; they cannot undo a write or license an external retry. Disposal stops delivery.

Subscribers should be fast, read-only and explicitly unsubscribed. The event stream is a notification
seam, not a durable job queue. A future game-actor bridge should reconcile registered players on startup
and react idempotently to `registered`; registration itself does not claim an external game actor was spawned.
External work requiring recovery belongs in a persisted intent/use case, as bot delivery demonstrates.

## Diagnostics and statistics

Operational records are durable operator evidence with fixed codes, counters and explicit retention.
Ordinary chat increments message counters without filling the audit ring with one row per message.
Reward history retains 2,000 entries; balances and lifetime milestone claims survive that pruning.

The framework logger receives a statically declared `coforge` catalog with logger-issued correlations
and aggregate metadata only. Technical exports exclude chat/note content, player identities, paths,
credentials and raw error causes. Operational subjects are resolved to display names only inside the
private population/operations views. Technical diagnostic retention and durable counters are distinct.

## Verification and extension

Most changes should be tested through the facade or a small application service with fake ports and
deterministic timers. Test failure/restart/duplicate/stale-response paths before host integration.
Use the in-memory Obsidian kit for exact note/plugin-data assertions. Browser journeys prove operator
flows, themes, narrow layouts and accessibility checks. Contained real-Obsidian CI covers native lifecycle,
views, persistence and reload. Live Twitch behavior still requires streamer-operated acceptance.

Keep new functionality in the smallest responsible module and inject its external capability through a
contract. Do not add HTTP or storage behavior to Vue components, issue public sends from event observers,
or treat a successful local write as proof of a successful external operation.

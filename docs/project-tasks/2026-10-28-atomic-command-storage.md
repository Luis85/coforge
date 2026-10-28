# Task: Commit Economy command effects and canonical notes together

- Status: implemented; overall parent PR qualification pending
- Journey: owner-requested Economy commands, fees, rewards and lootboxes.

## Acceptance and boundary

A recognized command's canonical note effects, account/usage outcome, message tombstone and frozen reward draw commit together. No success or grant is reported until authoritative plugin data is confirmed. Exact committed data remains success if the write throws afterward or recovery receipt cleanup fails. Unknown/truncated data or conflicting human notes preserve all recovery evidence and stop further persistent commands/loading rather than guessing.

## Implementation

`SaveOptions.atomicCommand: true` selects the bounded native adapter for recognized Economy commands. Ordinary chatter keeps its prior persistence path. Actual Economy config/ledger/fulfillment changes also select it automatically; new contribution rewards, account balances/claims, presence and registered-XP/rewarded-minute counters, presence receipts and earning-rule changes select it even without note effects. Last-seen-only profile observations keep their prior path. Empty legacy defaults do not select it for unrelated settings saves. It rejects unrelated project configuration, folder moves, request deletion, cleanup and external-note reconciliation in the same command. Existing-note effects are planned from freshly read canonical notes and preserve unrelated YAML ranges/comments and exact body bytes. New note paths are reserved without overwriting existing files or duplicate request IDs.

A protected `coforge-command-commit.json` holds exact before/after plugin data and note bytes before the first note write. Existing notes use compare-and-process. Every note result and the old authoritative data are verified before the single data commit. Startup recovers before canonical notes load; every later storage write must settle any retained receipt.

A proved precommit failure restores only exact owned bytes. Newly created notes move into journal-declared private `CoForge/Recovery/Commands/<uuid>/*.coforge-archive` files, with a receipt linking original identities/paths; they are retained rather than deleted, closing the read/delete race with human edits. Human edits racing archive movement are restored to the vacant original path when possible and preserved with a blocked recovery state. Staged metadata events/late exact echoes are suppressed.

A committed data file retains its fee/usage outcome. Later human edits with the same request identity are preserved. Missing note effects or notes indistinguishable from their pre-command version keep the committed receipt for inspection; no automatic redo or rollback overwrites a possible human revert.

Async command preparation remains inside the existing Store FIFO. A pending reservation does not publish partial state/events or allow another transaction to pass it. An async preparation failure leaves committed state unchanged.

## Evidence

- Real RED: the old storage left one free request Markdown note after a failed data commit with no committed message receipt.
- `atomic-command-{storage,recovery,async}.test.ts`: 3 files, 15 tests passed. Includes note/data/journal write-then-throw, receipt cleanup failure, process interruption before/after data commit, exact CRLF/YAML preservation, context append rollback, concurrent human edits including archive-move race, unknown data, private path/ID/schema validation and FIFO reservation behavior.
- Existing cleanup/Request Object/privacy adapter regression group: 5 files, 24 tests passed before final archive hardening.
- Scoped ESLint passed after replacing deletion with retained archive; final project/type/source qualification remains parent-owned.
- No local real-Obsidian run: host is unprovisioned. Parent owns CI.

## Frozen reward reservations

`StudioHost.economyReservations` is wired to `VaultStudioStorage.economyReservations` in the native runtime. Immutable per-event private files use SHA-256 filenames and secure uniform `crypto.randomInt` tickets; public event IDs never seed the draw. The shared typed validator checks frozen costs, benefits, purchase/bonus references, weights and outcomes against the captured definition. Retries retain the original input/configuration/ticket even after later configuration edits or a proved note/ledger rollback. Changed input using the same event key is rejected. Reservation itself grants no balance or perk.

All owned reservation files are validated before canonical state loads. Unknown/partial reservation bytes block further durable commands/loading before any new draw; exact write-then-throw evidence is accepted once. Private Git protection includes the reservation directory. No automatic tombstone, ticket or recovery evidence eviction was added.

## Additional evidence

- Atomic command/auto-selection/FIFO/reservation matrix: 5 files, 23 tests passed, including no-flag screen/accept award transactions, committed config/manual fulfillment when data writes then throws, and legacy default equivalence.
- Combined existing cleanup/Request Object/privacy and new storage/reservation group: 7 files, 32 tests passed.
- Actual typed runtime receipt roundtrip plus auto-selection regression group: 2 files, 9 tests passed. Receipt reloaded through the real native storage validator without granting a reward.
- Final full project typecheck passed with zero errors; source gate passed, 3052 inputs and 226 translated keys. Scoped native storage/reservation ESLint passed with zero warnings.
- No real host is provisioned locally; parent owns full UI/CI qualification.

## Final pure-income boundary review

Root identified the same write-then-throw acknowledgement risk for passive income without note effects. Two real30/60-second assertions failed before the predicate extension, then passed. The final focused `atomic-presence-income.test.ts` passed4 tests: complete/partial-minute income and receipt state survives a committed write that throws, the actual durable postcommit journal can be recovered after simulated process interruption, duplicate sample delivery adds no time/reward, later ordinary saves retain committed income, ordinary earning-rule changes acknowledge a proved commit, and ordinary chatter/last-seen-only observations create no recovery journal. Startup/replacement/cleanup/external-reconcile exclusions remain; project/folder replacement is rejected inside the atomic adapter.

# Task: Council round prompt order and durable concurrent execution

- Status: implementation complete; root qualification and review in progress
- Journey: ask the Council, receive independent opinions, then review attributed solution proposals.
- Owner steering: each Council round selects Round robin or Fan out; absent mode preserves sequential behavior.

## Shared contract

`CouncilRound.promptOrder?: 'round-robin' | 'fan-out'` compiles into each immutable admitted
`ExecutionInvocation.promptOrder`. Legacy definitions omit the optional property. Native dispatch decodes
and checks the pinned definition, so editing live configuration cannot reinterpret an existing run.
The schema/editor/compiler owner qualified both compatibility and explicit mode choices separately.

## Execution and barriers

A fan-out step selects the current contiguous round, omitting members with retained artifacts. Every
pending dispatch is resolved from the same pre-round snapshot. One durable journal mutation reserves
all attempt identities, invocation/retry/root allowance and bounded UTF-8 result capacity before any
provider call. Capacity reserves the existing shared 512 KiB overhead plus 64,000 bytes per pending
member for bounded result envelopes; the normal actual journal/run checks remain authoritative.

The native invocation gate admits one exclusive legacy call or one trusted batch in FIFO order. A
scoped batch lane permits actual concurrent transports within that batch and excludes legacy calls or
other batches until every started member settles. The scoped lane expires after the batch. Native
provider calls keep independent temporary workspaces, no reused session history and no tools.
Cancellation tracks controllers by attempt identity, so cancel/dispose abort every active member.

Each validated result and its telemetry commits independently through the existing serialized journal.
The shared attempt path merges partial provider usage per field, then mirrors the complete usage into
the artifact without adding duplicate counters. A missing final cost retains earlier reported cost.
All cost rows retain stable attempt IDs, including failures/retries/unknowns. Native cost archival and
the before-prune hook remain intact.

Artifacts and publication use declared participant order. Cursor advancement remains a contiguous
published prefix, preserving the existing consistency invariant. A successful later peer waits durably
behind an earlier unresolved member; it is not invoked again during retry. No next round starts until
all required slots have published. Explicit skips remain governed by the captured completion policy
and unknown-outcome acknowledgement. Human/local boundaries are not bypassed by a batch.

## Time and finite allowance

Accounting remains the sum of active automatic execution time, including each concurrent agent's
elapsed time. It is aggregate agent time, not fan-out wall-clock duration. Waiting for the shared native
gate, paused time, human waits and unloaded time are excluded. Existing sequential timing semantics
remain supported.

Every member's timing hook must reserve successfully before the first provider is invoked. Each live
phase has a conservative durable reservation of at most one second. Parallel reservations are stored
beside the backward-compatible legacy single-active reservation. A checkpoint's optional accountedMs
records elapsed time already charged, preventing double charging during another member's committed
checkpoint/stop notification. Known unused time escrow settles against actual elapsed time; invocation
and retry reservations are not silently refunded.

The default 15-minute root allowance supports normal concurrent round startup. A batch that cannot
reserve time or evidence for every member fails before any provider contact. Its persisted attempts
are marked not-started with a fixed no-contact reason and require an explicit retry. Those attempts
cannot carry provider telemetry or fabricated zero cost. After actual provider entry, an unavailable or
undurable result remains unknown and requires existing explicit recovery.

Reload retains consumed reservations, drops live timing phases and converts every started dispatching
intent to unknown. It does not infer unloaded elapsed time or replay providers. Kernel controls reject
retry, skip, repair, snapshot continuation or projection reassignment while members are still active;
Pause/Cancel remain available. Publication failures retain peer artifacts for repair without invoking
providers again.

## Evidence

The following commands actually ran; overlapping test selections are not added into a fabricated total.

| Qualification | Real result |
| --- | --- |
| Initial fan-out tests before the mode was accepted | 3 failed: strict invocation schema rejected promptOrder. |
| Deferred overlap/kernel/timing/cancellation/scheduler/gate iteration | 6 existing files passed; one new test initially failed because its two-intent assertion also ran for the third, next-round attempt; the assertion was scoped correctly. |
| Fan-out/native transport/cancellation/gate selection | 5 files passed, 14 tests passed. |
| Real compiled Council rounds plus allowance/journal/outbox/message/v2 regressions | 6 files passed, 19 tests passed. |
| Fan-out timing, native transport, compiled rounds and gate after accountedMs change | 8 files passed, 26 tests passed. |
| Fan-out safety plus kernel/retention/artifact/UTF-8 regressions | 5 files passed, 34 tests passed. |
| Typecheck | exit 0 on the kernel/native refactor; latest combined pass is tracked by root. |
| Source gate | Code-line limits and locale parity passed: 2954 inputs, 226 translated keys. |

The tests prove two deferred native transport capture calls overlap under the real provider builder and
scoped gate, while legacy work waits. They verify independent same-round prompts, declared next-round
opinion ordering, immutable admitted mode, round barriers, peer result retention, explicit uncertainty
recovery, no replay after reload, publication repair, cancellation of both native members, budget and
UTF-8 preflight failures, separate costs and aggregate elapsed time. A committed-notification test
checks that checkpoint/stop accounting never charges a peer twice.

## Untested scope

No paid live Claude calls were made. The native transport test uses the actual restricted provider path
with its process-capture seam deferred in the test; it does not claim a live provider benchmark. Local
real Obsidian is unprovisioned; root owns CI native qualification, the browser suite and final review.

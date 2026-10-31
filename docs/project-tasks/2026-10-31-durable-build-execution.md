# Task: Keep long Builds durable across Obsidian lifecycles

- Status: implemented and locally qualified; final-head CI and merge are recorded in the delivery PR.
- Journey: Idea board → native Build → preserved work → final human review.
- Owner decisions: background worker survives Obsidian close/reload; separate
  Build/short-task lanes with configurable vault-wide concurrency, default one
  each. BRIEF.md records the policy.

## Evidence and problem

CF-135's native Claude Build began at 12:15:14.990 UTC and failed at 12:18:24.093
UTC with the explicit process timeout. Its captured/current short policy is 180
seconds, 50 turns and USD20. Setup/finalization outside the provider timer explain
the roughly 189-second job duration. A real 8-file increment (108 additions, 16
deletions) remains in review. Earlier dirty-repository and turn-limit failures are
separate attempts. No live attempt, note or worktree was changed during diagnosis.

The current process adapter kills at its wall deadline, buffers at most 2MiB of
stdout, and uses renderer timers. Unload aborts it; startup fails active jobs.
Codex's scoped file broker and workspace leases are also host-owned. Its single
awaited engine lane prevents other work during a long Build. Simply accepting
100-hour numbers would not provide durable ownership, output, cancellation or
recovery.

## Traceability

Owner requests in BRIEF.md; the current traceability scaffold declares no req-*
or vi-* obligations for this change. Do not invent IDs or count TODO tests.

## Acceptance

1. A captured worker-backed native Build survives host/plugin detach, remains
   attributable and can be inspected after reopening without another provider
   launch. A simulated 100+ hour run is not killed by the legacy 180-second timer.
2. Durable preparation/admission/start use stable identities and idempotency.
   Persist authorization before dispatch; a lost acknowledgement never duplicates
   a provider. Unknown launch/process ownership fails into attention.
3. The local worker owns its process, broker and versioned private workspace
   journal. Authenticate local IPC, validate inputs and bind run/attempt/worker/
   epoch/input identity. No synced-file lease or PID alone grants ownership.
4. Separate heartbeat/liveness, observed activity and elapsed time. Keep memory
   and UI logs bounded while spooling private evidence. Output verbosity does not
   terminate an otherwise valid long Build; final semantic/result limits remain
   honest, with retained work on failure.
5. Completion requires provider termination, validated result and workspace
   capture, then successful canonical host persistence. Acknowledge only after
   that write; reattachment/repeated completion applies once.
6. Stop persists the Inbox hold, requests/revokes worker execution and records
   cancellation until termination is confirmed. Preserve partial work and unknown
   outcomes. Detaching on unload is distinct from operator cancellation. Only
   the existing operator Restart releases a stop hold.
7. Both lanes have configurable maximum concurrent runs (default one each), so
   multiple native Builds and multiple short/Design tasks may progress in parallel.
   Excess work waits without spinning or monopolizing the other lane; reducing
   limits never kills active work. One idea/workspace never gains concurrent
   writers. Council/trigger startup policies remain separate.
8. Policy, provider/model/effort/profile/input and resource bounds are captured.
   Existing attempts remain legacy; enable background execution for future runs
   explicitly. Do not raise spending/tool limits silently or resume CF-135.
9. UI offers accurate worker readiness, policy, queue age/elapsed/last-contact /
   last-activity, reconnect/check and cancellation/recovery states. No invented
   percentages/ETA or promised progress while the machine sleeps.
10. Studio activity polishing (additional owner screenshot): linked and static
    rows wrap inside the panel, with aligned marker/body/timestamp/actions,
    vertical-only scrolling and retained keyboard/close/request links. Validate
    long event text/tokens in both native themes and narrow/wide panels.

## Contract and ownership

- Application/domain agent: versioned background policy/ref/snapshot validation,
  durable-build port, job persistence and idempotent result projection; engine
  lane dispatch/reconciliation and reload/detach/Stop integration. Keep runtime
  code framework-free. Own types/ports/configured-workflow schema changes.
- Native worker agent: detached Node supervisor, authenticated client/protocol,
  atomic private journals/ownership, provider streaming/spooling, workspace and
  Codex broker lifetime, cancellation and Node-only adapters. No Electron imports.
- Presentation agent: workflow policy/readiness and feature detail monitoring,
  corresponding view contracts and focused browser/native tests. Coordinate
  domain field names before editing shared schemas.
- Root: runtime/build packaging and adapter composition, protected storage paths,
  owner decisions, integration and independent reviews, qualification/delivery.

Agree the shared durable-build contract before implementations diverge. Worker
prepare reserves without paid dispatch; host persists its reference/start intent;
worker start is idempotent. Inspection returns monotonic bounded snapshots plus
retained terminal result/evidence. Host records applied identity before worker
acknowledgement. Startup reattaches only to verified original ownership.

Use a verified native Node executable (existing MCP prerequisite precedent), never
assume Electron's executable is Node. Ship a versioned bundled worker with the
plugin without a global package/service installation. Existing live workers keep
their pinned executable/protocol; incompatible identities require attention.

## Increment plan

1. Failing policy/admission/recovery/lane tests and shared versioned contracts.
2. Node worker with controllable fake provider: prepare/start/inspect/stop/ack,
   durable state, identity, ownership, bounded output and crash-point proofs.
3. Restricted Claude/Codex adapters, worker-owned file broker/workspaces, native
   Node preflight, versioned worker packaging and runtime composition.
4. Engine detach/reconnect/project-once, short/Build lane isolation and durable
   Stop/review integration. Retain captured legacy behavior and private evidence.
5. Accurate configuration/monitoring UI, migration guidance and recovery; focused
   product/browser/contained-host end-to-end proofs, including worker continuation
   while a contained host is reloaded/closed.
6. Independent integration review, bounded polishing, source freeze, full project
   gate, UI quality/gallery, host smoke and real-host tests, PR qualification.

## Qualification and limits

Use fake clocks/providers to advance beyond 100 hours, high-volume output and
long quiet periods; exercise duplicate admission, host loss, worker death,
stale identity, disk-full, cancellation during writes, completion/ack crashes and
changed proposals. No paid 100-hour soak or live CF-135 retry. Provider sessions,
OS reboot and process reattachment are distinct; never promise automatic recovery
from ephemeral legacy sessions or unknown side effects.

Primary references consulted: Claude CLI/headless/session documentation and
OpenAI non-interactive Codex documentation. The native CLI supplies streaming and
explicit session identity; CoForge must supply its own durable authority and
result projection. Existing spending limits and provider reporting are not an
exact billing guarantee.

## Improvement and polishing increments

Run this pass after the initial implementation, using independent peer review
across the application, native-worker and presentation owners. Fix each concrete
finding with a behavioral regression, then qualify the combined increment.

| Increment | Improvement and end-to-end obligation | Current evidence/status |
| --- | --- | --- |
| 1. Sustained execution | Keep hot progress separate from canonical notes; bound semantic writes/output; elapsed deadlines must survive host detach and sleep. | Qualified: simulated 101-hour execution, high-volume child output and 1,000 hot polls with zero extra canonical saves. Included in the full passing gate. |
| 2. Admission and startup | Prove separate 2-Build/2-short operation, safe reductions, delayed startup dispatch, and lost-prepare unpaid cleanup. | Qualified: independent lane operation/reductions, startup dispatch fence, unused cleanup and fresh-client rollover after verified daemon retirement. |
| 3. Original-owner recovery | Preserve completed/lost-ACK receipts; inspect actual workspace evidence; retain unknown process ownership; cancel by known job even after metadata removal. Honor completed and unused authorization tombstones across archived generations. | Qualified: actual replay reproduction repaired, Stop intent rechecked after delayed inspection/configuration/start, existing cancel/ACK independent of future capacity sync, and immutable terminal receipts preserved. |
| 4. Private authority | Keep machine-local files outside canonical vault aliases; exclude configured managed folders and tracked copies; preserve old generations and never move a nested worktree. | Qualified: storage aliases, bound exit/no-spawn proofs, nested/unindexed evidence, original process birth, scoped broker and managed-folder protections. Shared shell tooling restored; project build/test profiles register the hook. |
| 5. Accurate, usable controls | Keep captured limits/profile distinct from observed progress; expose offline lost-ACK recovery and retained orphan attempts; preserve drafts/errors and explicit consent. | Qualified: recovery/empty-capture/orphan regressions, four browser cases, actual settings reload/Node/lane saves and zero-job native check. |
| 6. Activity layout | Wrap long event text/tokens; align markers/actions; preserve keyboard, close/focus and timestamps in both themes and widths. | Qualified: original 535px overflow reproduced and repaired; focused browser checks, 8 UI-quality checks, 40 gallery captures and actual native wide-dark/narrow-light images reviewed. |
| 7. Follow-up compatibility | Keep no-access steps isolated and provide qualified broker-only readonly continuation in the original workspace. Reject mixed foreground/background editing definitions before saving; never adopt a worker-owned foreground writer. | Qualified: actual Git read-lease identity/diff/journal tests, Claude/Codex protected read brokers, preserved prior changes, and prelaunch Herdr refusal. |
| 8. Delivery closeout | Integrate board-outline PR58; review final diff against brief/rules; run full project, UI, gallery, host smoke/native and final-head CI; merge only green. | PR58 merge 0b519ec integrated. All local gates below passed on frozen source 027db86. Final-head GitHub CI is mandatory before merge. No paid 100-hour run or live CF-135 retry. |

## Evidence

- `npm run verify:project`: exit 0; five check stages passed, zero failed/skipped
  stages in **1035.3s**. Product result: **1,702 passed, zero failed, six existing
  Windows skips**. Release build passed (2,003 modules); prototype embedding
  **1 passed**. UI effects explicitly skip without declared visual definitions.
- `npm run test:ui-quality`: **8/8 passed** (1.0m). `npm run ui:gallery`:
  **40 captures, zero failures**. Representative four-theme/size combinations,
  captured policy and activity images reviewed; no baselines changed.
- `npm run -s dev:obsidian -- --json --port 9322`: **passed** after reload on
  pinned Obsidian **1.14.4**, launcher **3.2.1**; errors, host errors and plugin
  console empty. Debug report has zero error logs; screenshot reviewed; port closed.
- `npm run test:obsidian`: **55/55 passed across 48 files**, zero failures/pending,
  **617.80s**. All 55 teardowns completed and 56 owned sessions stopped. No live
  owned PIDs, bad installed assets or capture errors. Both new durable native
  cases passed, including actual host exit before the original worker finished.
- Product-profile hook relocation: **6 unit and 11 focused product tests passed**,
  lint passed, and old/new release `main.js` SHA256 matched exactly. This keeps
  framework tooling generic without changing the runtime artifact.

Ignored evidence lives under `reports/durable-final-project/`,
`reports/durable-final-ui-quality/`, `reports/durable-final-ui-gallery/`,
`reports/durable-config-hook-qualification/`,
`reports/workflow-increment-evidence/final-native-027db86/` and
`.obsidian-sandbox/logs/`. The delivery PR records final-head GitHub qualification.

Independent review found real Stop and capacity-recovery races after the first
freeze. The in-progress gate was interrupted before edits; failing regressions
were implemented, peers reviewed the fixes, and the complete gate above reran.
No skipped/TODO test counts as acceptance. The final polishing pass found no
remaining concrete blocker. No billable provider, live CF-135, personal vault or
live OBS/Twitch operation was used. Local Node/npm are 24.20.0/11.21.1; CI uses
repository pins 24.21.0/11.19.1.

Unchanged hot polls avoid canonical saves and mutation transactions; ordinary
subscriber snapshot delivery retains the existing cloning/isolation contract.
Unconfirmed bootstrap without a persisted original-child or exit/no-spawn proof
fails closed. Provider/OS death does not authorize automatic paid-session replay.

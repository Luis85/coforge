# Background retry and result polishing: improvement and closeout plan

- Status: implementation and independent repair increments complete; final qualification and delivery in progress.
- Owner request: subagent-driven implementation, a comprehensive improvement
  plan executed end to end, final polishing, commit/push/PR and green-only merge.
- Product decisions and acceptance remain in BRIEF.md and
  `2026-10-31-retry-build-in-background.md`; this plan introduces no new scope.
- Sources contain no req-* or vi-* obligations for this increment. Do not invent
  traceability IDs or count TODOs, skipped checks or screenshots as acceptance.

## Delivery invariants

Completed primary steps, original artifacts, attempts and proposal text survive.
Every new paid attempt has a persisted exact authorization. Polishing feedback
is captured separately from saved instructions, and generated output remains
auxiliary until human review. Approved inputs retain genuine producer IDs/hashes.
Code copies preserve both source trees, bind actual bytes and the original base,
and never create a fictitious model job. Active/unknown writers and missing
managed metadata block operations. Stop holds require explicit operator release.
No development operation touches the live CF-135 request or a personal vault.

## Increment 1 — Source versions and human decisions

Application agent reviews and qualifies the root's target/amendment helpers.
Prove request, screening, RICE, Plan, Design, Markdown and code target selection;
pending output is not current; repeated Apply references the real auxiliary
artifact; source/proposal/checkpoint changes invalidate approval. Preserve the
original request body and use an explicit approved input projection. Human
moderation and estimate changes supersede earlier AI compatibility values.

Required evidence: behavioral target/amendment and lifecycle tests; actual
input prompt/reference assertions; no original artifact rewrites. Initial
proof caught a field-order attribution bug and a new screening flag remaining
in the screened bucket; both have regression tests and fixes.

## Increment 2 — Canonical persistence and recovery

Application agent fixes lifecycle and recovery; root independently tests the
actual VaultStudioStorage adapter. Qualify preview without note/model effects,
atomic admission and Apply, private-write rollback with no events, exact unknown
frontmatter/body preservation, and interrupted foreground auxiliary recovery
across two reloads. Compare memory, raw canonical note and persisted private
fingerprint; none may advance alone. Preserve the main checkpoint on all paths.

Required evidence: real-note tests plus context/request-object/workflow storage
regressions. Initial execution proof caught frontmatter reserialization; narrow
auxiliary command transactions address execution atomicity, and existing-note
writes reuse the managed-range writer for ordinary recovery/startup saves.
Interrupted queued auxiliary recovery exposed a skipped canonical-note write;
its failing test is retained until the recovery selection is corrected.

## Increment 3 — Writer ownership and exact native copies

Native agent finishes executor/resource provenance and private-copy hardening.
Qualify tracked, binary, untracked, deleted and mode-changed files on the original
Git base; source and target drift; missing or corrupt receipts; protected paths;
old-worker capability; same-run workspace epochs; zero provider starts before
verified import. The old executor and the new operator-owned resource are
different identities. Retry after a polishing copy must select that real epoch.

For code Apply, verify both the original reviewed baseline and the completed
auxiliary result. Persist operator intent before copy and canonical binding
after a verified private receipt. Complete operations return the same binding;
incomplete/unknown copies remain retained and never silently replay. Test both
foreground shared-instance acquisition and authenticated background-worker RPC.
Preserve original foreground and auxiliary trees, with no invented paid job.

Required evidence: actual temporary Git trees and detached Node worker with a
controlled fake provider; filesystem/receipt assertions and provider count.
Initial FG/BG materialization and authenticated RPC proofs passed; remaining
provenance/crash cases must pass before freeze.

## Increment 4 — Progress, lanes, Stop and review closure

Application agent qualifies every auxiliary job/recovery route against its exact
run ID. The main run cannot advance while a polishing run or result is pending,
including legacy automatic dispatch after workflow settings change. One blocked
card must not starve other lane candidates. Stop/Dismiss preserve main progress
and explicit holds. Apply/Discard on a previously shipped card resolves its
reopened review without granting completion credit again. Missing managed
progress is distinguished from genuinely legacy requests.

Required evidence: lifecycle, Stop, reload, current-input and accepted-card tests;
ordinary primary retries remain correctly scoped. Unsupported later foreground
editing after a converted background step must reject before paid admission,
with a clear explanation, rather than silently adopting a background workspace.

## Increment 5 — Interaction and visual polish

Presentation agent completes and qualifies optional pass settings, CoWorker/manual
configuration, exact effective model/effort/limits, all-bucket card/detail actions,
required feedback, preview consents and errors. Preserve modal feedback on failure;
suspend and restore the existing drawer/tab/draft and trigger focus. Only one
dialog may be active. Keep approved request/Design results visible after Apply;
show genuine provenance, pending review, history and exact auxiliary recovery.

Required evidence: behavioral DOM tests, narrow/wide light/dark browser captures,
keyboard/Axe checks, contained native presentation tests and zero paid calls.
Wrapping must contain long names/feedback/source values without hiding content
or weakening overflow thresholds. Keep settings in the agreed flat tab order.

## Increment 6 — Independent cross-review and repairs

After integration, native agent reviews application/root progress, persistence
and source contracts; application agent reviews UI state, consents and action
routing; presentation agent reviews native source/copy/error boundaries. Root
reviews the complete diff, schema compatibility, note ownership, logging and file
limits. Each finding names an actual reproducible failure and owning increment.
Repair with a behavioral regression, then rerun affected tests. Record limits
instead of inventing OS/provider proofs or widening permissions.

## Increment 7 — Frozen end-to-end qualification

Root reserves the shared build slot after all agents finish edits. Freeze product
and test source while full qualification runs. Run `npm run verify:project`
(including check), `npm run test:ui-quality`, `npm run ui:gallery` with image
review, contained pinned-host smoke and the full real-Obsidian suite. Focused
browser/native retry and polishing journeys supplement the complete suites.
Archive ignored local reports with exact commands, counts, durations and toolchain.
Any new source fix requires a new source freeze and appropriate requalification.

## Increment 8 — Final polishing and delivery

Re-read copy, errors, history labels, settings defaults and provenance against
the owner choices. Finish task documents and the PR template with real evidence,
remaining limitations and untested scope. Run the self-review skill, diff and
secret/artifact checks. Commit on `codex/retry-build-background`, push, open a
draft PR with `e2e`, and inspect every check on the final head. Fix and rerun any
failure. Mark ready and squash-merge only the exact tested head once every check
is green; use no force, admin bypass or unverified automatic merge.

## Evidence ledger

### Independent review and repair ledger

| Finding | Regression / repair | State |
| --- | --- | --- |
| New action events overflowed the logging catalog and prevented native plugin startup | Import-level diagnostics regression; separate bounded workflow-actions catalog, unchanged framework limit | Fixed; native plugin enables |
| Canonical note could advance before private result state | Actual Vault adapter admission/Apply/result-projection failure cases; audited lifecycle command transactions and original-reference ACK ordering | Focused rollback tests pass |
| Interrupted auxiliary recovery updated memory but skipped the note | Capture loaded fingerprints before nested recovery mutation; compare raw note and two consecutive reloads | Fixed and passing |
| Unknown frontmatter quotes changed during execution/recovery | Existing-note managed-range writer and auxiliary atomic saves; preserve raw body/context | Storage/context regression batch passes |
| Matching resource lost provenance because metadata field order differed | Normalize typed values before content comparison | Fixed and passing |
| Applied code lacked its genuine producer in the current-result panel | Enrich from the exact approved artifact; retain separate operator resource owner and later creation provenance | Application regression passes; presentation proof added |
| A later failed attempt was mistaken for the actual private workspace owner | Bounded known executor candidates; native journal resolves real owner; separate failed-executor consent and normalized owner audit | Application and actual native owner regressions pass |
| Partial operator copy made Apply permanently unrecoverable | Typed verified-idle retained-copy failure; append-only old intents; subsequent explicit fresh epoch, no model call | In-process and authenticated RPC proofs pass |
| Stop during Apply invalidated immutable result scope or allowed a late bind | Keep completed output revision; compare per-pass Stop version for each invocation | Deferred Apply and repeated Stop regressions pass |
| Previously shipped author could earn new XP after registering later | Exclude trusted polishing review settlement without manufacturing reward claims | Apply/Discard regressions pass |
| New screening flag stayed in the screened bucket; later human override could be hidden | Actionable flagged status and canonical human compatibility precedence | Regression passes |
| Repeated accepted code with no main workflow changed logical resource owner | Preserve the existing reviewed result owner across auxiliary passes | Regression passes |
| Background epoch could not supply genuine current code to later steps | Inject exact approved auxiliary artifact before required-role validation; keep old callbacks in their own epoch | Application handoff regressions pass |
| Windows CRLF checkout could look like a protected-file edit | Git-aware protected baseline comparison; retain exact raw snapshot hashes and reject hidden index flags | Native regression passes |
| Additional file notes could erase a bounded diff's truncation marker | Preserve explicit bounded-preview disclosure while snapshot bytes remain complete | Actual bounded source-preview regression passes |
| Modal preview survived primary checkpoint changes; fallback focus crossed studio views | Include checkpoint tuple; scope focus fallback to the originating root | Behavioral UI regressions pass |
| Clean repository code source was visually confused with historical accepted diff | Explicit source kind, base, bytes and historical-context explanation | UI regression passes |
| Native confirmation buttons missed WCAG contrast at 4.25:1 | Scope host-token contrast correction to the new controls, including hover; keep 4.5:1 assertion | Native light/dark presentation and full native suite pass |
| Auxiliary CoWorker cost row omitted captured workflow name | Resolve the genuine auxiliary workflow; preserve exact costs/usage and exclude private instructions | Three cost suites, 8 tests pass |
| Installed dependency trees could exceed capture bounds or contain blocked links | Explicit scoped exclusions for Git-ignored agent-denied directories/links; preserve tracked descendants and allowed ignored source leaves; disclose actual exclusions | Cache/link/track exception and ignored-source-through-Apply proofs pass |
| A binary edit could keep the same visible diff while changing actual bytes | Optional host-owned full scoped-tree hash through capture, codecs, Apply, copied binding and read/review; legacy absence is not invented proof | Codec/application, read-lease and actual capture/review regressions pass |
| Full-suite fixtures still selected the first workflow input and omitted new runtime port factories | Select the actual visible Workflow name field; compose typed resource factories and preserve every original no-dispatch/draft assertion | Affected suites and whole fast lint pass |
| MCP reload could let a late old shutdown blank a replacement connection | Deterministic stale-close regression; unique atomic publication, same-descriptor inode/publication ownership, non-yielding small clear, journal-before-readiness ordering | Fifteen unit tests and actual Windows restore/reload/RPC/note/shutdown proof pass |
| Runtime disposal delayed the new Apply fence behind awaited MCP cleanup | Invoke engine shutdown synchronously at disposal entry; drain already-admitted commits with remaining teardown | Four lifecycle suites, 14 tests pass |

The ledger records actual findings rather than expanding the owner scope. Every
listed repair has a passing behavioral regression and independent review. The
full project rerun and exact-head GitHub checks remain the final delivery gates.

This ledger is updated at closeout from real reports. Current focused evidence:

- Workspace base pin/epochs/operator entry, legacy storage and strong binary
  review: 3 files, 13 passed (53.38s).
- Target/amendment/config plus integrated auxiliary lifecycle: 4 files, 12 passed.
- Canonical note/storage/context/request-object/workflow batch: 7 files, 22 passed
  before the added interrupted-recovery assertion, which exposed the noted gap.
- Native FG/BG primary materialization: 3 passed (113.06s).
- Detached authenticated operator-copy RPC: 1 passed (50.45s); exactly one fake
  provider execution for the auxiliary pass, none for materialization.
- `npm run test:ui-quality`: 8 passed (52.6s). Gallery: 40 captures, zero failures;
  all variants reviewed through overview sheets and representative full captures.
- `npm run test:e2e`: 242 passed (37.2m), including the eight quality checks,
  reviewed retry, polishing, native-style layout, settings and privacy journeys.
- Full `npm run test:obsidian -- --no-build`: 57 passed across 49 files (672.78s).
  All 57 teardowns completed; 58 owned sessions stopped, zero retained scratch
  vaults and zero mismatched installed assets. The repaired MCP case passes in
  this full run as well as its bounded Windows confirmation.
- The final contained smoke check passed with `errors: []`, `hostErrorCount: 0`
  and `pluginConsole: []` on pinned Obsidian 1.14.4 / launcher 3.2.1.
- Frozen source: `b26f9d003e9e550a12ba260bb468d53b7ef4505d24786540010e99923369dbc3`
  over 3,605 source/config/test files. The initial full project run exposed two
  stale test fixtures and one lint finding; all three were corrected without
  weakening their assertions. The repeated project gate is running on this source.
- Final project and exact-head GitHub results are pending. No paid vendor call,
  live retry, multi-day paid soak, personal-vault launch or alternate-host
  qualification is claimed.

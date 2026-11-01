# Task: Trust plugin edits and explain failed request runs and costs

- Status: in progress
- Journey: edit request in CoForge → run workflow → inspect failure/recovery and AI costs.

## Why

The owner reported that a new CF-133 run triggered outside-change protection for
plugin edits, then failed Build without an understandable cause. They also
requested a separate AI-cost breakdown in request details.
The owner then clarified that ordinary coding dispatch should use a native agent
with coding tools in its dedicated worktree, without Docker preparation or a
manual command allowlist.

## Traceability

Owner decisions are recorded in BRIEF.md. The scaffold has no req/vi obligations.
No actual CF-133 failure cause is claimed without its run evidence. Current
connected tools do not expose that live record; source reproductions are separate.

## Acceptance

- Successful plugin writes round-trip without false external-change quarantine.
  Failed writes cannot establish trust. Duplicate/delayed events cannot overwrite
  newer state, and genuine external edits/reverts remain guarded. Preserve note
  IDs, unrelated frontmatter/body bytes and captured execution permissions.
- Failed native Builds retain bounded classified diagnostics where actually
  available. Activity, Sessions and workflow history expose cause and next step.
  Unknown ownership still requires original-execution recovery; no automatic replay.
- AI costs is an independent private request-detail tab, using canonical cost
  history scoped by both project and request. Show known subtotal, coverage,
  per-attempt source/status/provider/model and tokens. Unknown is never zero;
  failed charges and historical/manual provenance remain visible. Observing costs
  never edits charges, reconfigures a provider or starts a request.
- Literal, accessible failure/cost UI works at narrow/wide widths in both themes.
  Update authored view coverage and exact seven-tab navigation contracts.
- Future native edit-worktree admissions capture a normal native coding profile:
  the SDK runs in the owned worktree with its file, shell, test and native
  assistant tools. No Docker image/command grant is required. Existing admitted
  attempts keep their captured policy; classification/read-only scopes remain
  bounded. Provider permissions/current desktop rights are explicit, without an
  administrator or silent bypass fallback. Native descendant lifetime and
  cancellation must settle before worktree ownership is released.

## Plan

1. Dedicated integrity agent: reproduce write/parse/watch/commit boundaries and fix
   ownership recognition with red/green regression tests.
2. Dedicated provider agent: preserve safe failure classification through native
   transport and durable snapshots without weakening unknown-outcome safeguards.
3. Dedicated UX agent: visible failure summaries/actions and readonly AI-cost tab,
   behavioral tests and contained native qualification.
4. Root: evidence, documentation/catalogue integration, cross-review, required
   project/UI/Obsidian gates, then PR and merge only when green.
5. Native provider agent plus engineering review: simplify future coding
   dispatch, qualify actual installed SDK permissions and subprocess cleanup
   with zero-billing fixtures, and remove Docker prerequisites from the normal UI.

## Evidence

- Source audit confirms Sessions omits job.error, Activity buries it in a nested
  log, and durable/native layers replace distinct failures with generic messages.
- A synthetic own-write round-trip reproduces false quarantine after managed
  plan whitespace/CRLF normalization. This is not yet proof of CF-133's trigger.
- Further behavioral, host and final-head qualification is in progress.
- Write integrity: eight suites / 44 tests passed, including 10 new regressions;
  typecheck/lint/source caps passed. New and existing failure/cost UI related
  batch: 27 tests passed. Combined contained native batch: four files / four
  tests passed (65.12s), including real metadata/reload/external-revert and
  read-only failure/cost/seven-tab scenarios. Exact CF-133's historical cause
  remains unavailable: its empty log shows only the generic worker fallback.

## Untested scope

Do not open a personal vault, modify/retry real CF-133 or dispatch a paid provider
for qualification. Only contained vaults inside this worktree may be launched.

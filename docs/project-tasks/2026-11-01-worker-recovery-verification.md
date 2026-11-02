# Task: Repair worker, recovery and MCP verification

- Status: done
- Journey in BRIEF.md: durable execution, private retained evidence, explicit recovery and mandatory review.

## Why

The owner asked to fix the remaining worker/recovery/MCP failures and get full repository verification green. Previous qualification reported native timeouts, recovery failures and an MCP ownership/idempotency failure.

## Traceability

The design scaffold declares no requirement/interaction IDs. This repairs existing execution contracts; no product permission or recovery policy changes are authorized or needed.

## Acceptance

- Reproduce failures with detailed stacks on pinned Node 24.21.0 and npm 11.19.1.
- Repair causes without weakening assertions, timeouts, freshness, ownership, no-replay, privacy or filesystem guards.
- Keep earlier request-detail changes intact.
- Focused worker/recovery/MCP suites and full npm run verify:project pass, with real output recorded.
- Qualify host-related changes in the contained Obsidian sandbox; perform self-review.

## Plan

1. Reproduce narrow failure groups before the full gate.
2. Isolate Windows execution cost and MCP state races; add behavioral regressions before fixes.
3. Run focused and adjacent safety tests, then the complete gate with normal thresholds.

## Evidence

Pinned status reports ok; detailed logs under reports/verification-repair/.

- MCP failures reproduced as Windows `EPERM` atomic replacement locks. Journal writes now reuse the existing guarded, bounded-retry writer after schema, byte-budget and strict canonical-directory validation. New transient/permanent-lock regressions failed before the fix; 15 focused tests and scoped ESLint pass afterward.
- Windows identity reads skip only an OS-proven absent PID. Live reads reuse an already source/hash-validated controller when present, without compiling/repairing it or caching process identity. Missing cache uses the existing PowerShell fallback; permission/malformed-helper failures remain unverified. 14 identity/cache/client tests pass, including real termination.
- Git root/common/HEAD/ref proof now uses one fresh process; no metadata or file-byte cache. Snapshot index modes and hidden flags are queried together. Regressions prove later commit/pointer/byte/hidden-flag changes still reject or change the snapshot. Red query-count tests observed the redundant launches before repair.
- Worker/client/read/recovery/boundary batch: 5 files / 20 tests passed (107.98s). Git proof plus real EOL/hidden-index protection: 3 files / 8 passed (10.44s). Final materialization and whole-gate qualification pending.
- Final materialization/journal/replacement batch: 4 files / 28 tests passed (197.94s); previously slow materialization cases pass without increased timeouts. Typecheck passed. Independent backend review approved the repair diff, with no actionable ownership/freshness/privacy issues.
- Contained Obsidian: durable worker survival across real host quit/reconnect, vault MCP and plugin lifecycle all pass (3 files / 3 tests, 28.65s). `npm run test:ui-quality`: 8 passed (47.9s). Full gate, smoke and gallery results pending final collection.
- First repaired full gate completed all 567 files within its budget: 566 files passed; 2291 tests passed, 6 platform-specific skips and one 30-second aggregate configured-provider timeout. All original worker/recovery/MCP failures were gone. No scheduling/isolation change was needed.
- The remaining case performs five real native-stage cycles. Independent bounded Git reads now overlap in pairs and every launched read settles before return/error; no validation query was removed or cached. Its fixture uses the existing restricted Git wrapper and disables signing, preserving init/write/add/commit and all five-stage assertions. Controlled deferred regressions failed before the change, then the 3-file / 11-test batch passed. Scoped ESLint and typecheck passed. Independent review approved this final delta.
- Final full run: `reports/verification-repair/verify-project-final.log`. Native lifecycle/MCP and smoke repeat on the frozen final source; results pending collection.
- **Final full qualification passed:** `npm run verify:project` exited 0 on pinned Node 24.21.0 / npm 11.19.1. All five check gates passed (typecheck 30.7s, source lint 6.8s, zero-warning ESLint 241.1s, full product tests 1350.9s, maker types 37.8s); summary 5 passed / 0 failed / 0 skipped in 1667.3s. Product report: 568 files, 2294 passed, 0 failed, 6 existing Windows-inapplicable skips. Exact report preserved in `reports/verification-repair/full-product-tests.json`.
- The same command completed the production build (2192 modules) and 1 embedding test successfully. The repository's no-visual-definitions UI-effect skip remains explicitly labelled; no acceptance obligation was converted into a skip.
- Final contained host qualification: 3 files / 3 tests passed (30.24s), including original-worker survival across actual host quit/reconnect, MCP restoration and plugin unload/reload. Final `dev:obsidian --json --port 9338` passed with `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`. Screenshot, debug report and latest session log reviewed; session ended complete.
- `npm run test:ui-quality`: 8 passed (47.9s). `npm run ui:gallery`: 40 captured and reviewed on a contact sheet; no baselines changed. Final source review approved the backend repair and paired-read delta. `git diff --check` passes; no test configuration, isolation, timeout, permission, dependency or lockfile change.

## Untested scope

No live external provider or real billing invocation was performed. Native host validation was targeted rather than the entire Obsidian suite. The six pre-existing POSIX-only product cases remain skipped on Windows; all supported-platform product tests pass. No release action is included.

## Pull request integration (2026-11-02)

The owner authorized commit, push, pull request and merge after all CI checks pass. PR #69 integrates the work with upstream workflow-session completion (`7d4f08ff`). Both stopped-session recovery and fresh Git identity verification remain present. Post-rebase local typecheck passed; 10 focused product files / 43 tests passed (57.20s).

The first CI run passed the full project gate (5 gates in 435.8s), production build, local installation, submission checks (16 pass / 0 warn / 0 fail), Windows native lifetime and verification isolation. The full Obsidian run passed 69 of 70 tests, exposing a stale toast geometry assertion: the new full-height sidebar was treated as a horizontal header. The correction explicitly checks non-overlap with both header and responsive section navigation, retains footer clearance, and changes no runtime behavior, timeout or guard. The contained-host regression then passed (1 file / 1 test, 11.57s), with six measured feature/project cases across both themes and wide/narrow panes. Screenshot and geometry evidence reviewed under `reports/verification-repair/` and `reports/obsidian/cases/`.

The first full browser run passed 251 of 254 tests. Its two navigation failures exposed clipping under Linux's larger UI font; a 16px native-font fixture reproduced both failures locally. Narrow labels now use a consistent 12px while retaining 32px controls, 8px gaps, the 110px limit and every clipping assertion. The remaining project-switch failure came from inspecting the previous project's workflow before asynchronous navigation finished. Its test now waits for both project identity and the Settings destination, retains exact model/provider assertions, and adds return-trip project isolation checks. An independent finishing review approved these four changed files without findings.

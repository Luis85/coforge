# Task: Preserve CoForge data independently of plugin installation

- Status: implementation complete; final qualification and merge are tracked in [PR #73](https://github.com/Luis85/coforge/pull/73).
- Journey: BRIEF.md, Data it works with; owner request of 2026-11-02.
- Traceability: design/traceability.json declares no requirement or interaction IDs.

## Acceptance

Private records and machine-specific worker storage belong to the vault's
`.coforge-data/` and are ignored by Git. Editable Markdown remains visible and
unchanged. `data.json` retains settings only. Legacy journals and their recovery
generations migrate byte-for-byte; conflicting destinations preserve both records
and stop writers. Interrupted moves resume. Active worker generations retain their
original ownership and recovery route, with new Builds held until relocation.

## Plan

1. Red/green tests for migration, conflicts, interrupted moves and worker ownership.
2. Central private layout; update persistence adapters and private path policies.
3. Preserve MCP registrations and backup/recovery generations during relocation.
4. Product checks, real Obsidian migration/reload evidence and self-review.

## Evidence

- Initial behavioral run: 3 tests failed (missing migrated records, missing conflict rejection, missing interruption rejection).
- First green migration run: 1 file / 3 tests passed.
- Focused storage batch: 8 files / 33 tests passed. Focused privacy and migration
  batch: 6 files / 30 tests passed. Final worker transfer/admission batch: 2 files /
  8 tests passed, including cross-drive interruptions, changed staging bytes and
  exact binary retention after a lost commit reply.
- `npm run typecheck`: passed. Focused ESLint: exit 0, zero warnings.
- `npm run test:ui-quality`: `8 passed (2.0m)`.
- `npm run ui:gallery`: `Captured 40 screenshot(s)`; reviewed contact sheet and
  desktop/narrow details. Index: `reports/ui-gallery/index.json`; review sheet:
  `reports/vault-data/gallery-contact.png`. No baselines were changed.
- `npm run test:obsidian -- coforge-data-migration coforge-mcp-vault
  coforge-durable-worker-lifecycle plugin-lifecycle`: `4 passed (4)`, 51.52s.
  Covers migration/reload, exact settings/note bytes, MCP restoration and original
  worker continuation after real Obsidian quits, without second admission.
- Final `npm run -s dev:obsidian -- --json --port 9340`: `status: passed`,
  `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`; logs and debug report
  reviewed. The contained plugin directory has only data.json, main.js,
  manifest.json and styles.css.
- Final consolidated regression batch: `23 passed (23)`, `126 passed (126)` in
  34.99s. Includes every changed product test plus new migration/transfer tests and
  all 9 current readable-content parser tests. Targets:
  `reports/vault-data/focused-tests.json`; output:
  `reports/vault-data/focused-tests-final.log`.
- Final verification uses pinned Node 24.21.0 / npm 11.19.1.
  `npm run verify:project` exited 1 because the full product suite hit its
  1,800-second launcher deadline. Actual summary:

  ```text
  [ok]   typecheck    174.5s
  [ok]   lint          14.0s
  [ok]   eslint       625.1s
  [FAIL] test        1801.5s (TIMEOUT)
  [ok]   maker-types   42.2s
  Summary 4 passed, 1 failed, 0 skipped in 2657.4s
  ```

  Log: `reports/vault-data/verify-project.log`. The timeout output also contains an
  earlier readable-content assertion; all 9 cases pass in the fresh consolidated
  current-tree batch. A complete full-suite result is not available.
- `npm run verify:artifacts`: exit 0; production build passed and prototype
  embedding `tests 1`, `pass 1`, `fail 0`. The existing UI-effect script explicitly
  skips because this project declares no visual definitions. Output:
  `reports/vault-data/verify-artifacts.log`.
- Additional `npm run check:source` flags the unchanged existing
  `src/plugin/features/coforge/application/engine.ts` at 402/400 code lines;
  no source limits or rules were changed. The inventory reports no new violation
  in this task's files. `git diff --check` passes.
- Unrelated existing UI edits were preserved. One unescaped brace in their JSON
  regex prevented plugin load; it was corrected and its existing parser tests pass.

## Verification scope

Native evidence uses contained vaults and synthetic workers, without real paid
model requests or external account mutations. Private Git-ignored runtime data
still needs private vault backups. Editable/recovery Markdown stays visible.

## Improvement and polishing pass (owner request, 2026-11-02)

- Reject inherited object keys such as `__proto__` as unknown storage categories
  before any record moves.
- Remove an installed `.gitignore` only when its complete contents belong to one
  marked CoForge block. Preserve unmarked rules, empty user files and rules added
  outside that block exactly.
- Check prepared persistence instances for live journals, reservations or stream
  history recreated by an older plugin; stop affected writes without forking the
  migrated ledger. An integration test checks unchanged settings and note bytes.
- Normalize and escape installation paths in Git rules; actual Git checks cover
  Windows separators, trailing separators, spaces and bracket characters, and
  prove that worker credentials are ignored while code and unrelated files remain
  available.
- Use one hash map and folder set when validating partial archive copies, avoiding
  repeated scans of manifests that can contain 100,000 entries.
- Clear the reported source-size violation by moving the unchanged stage runtime
  admission policy into `stage-runtime-policy.ts`. Source-size and locale audit:
  passed (3,998 inputs; 226 translated keys). Workflow regression: 6 files /
  39 tests passed. Typecheck after extraction: exit 0.
- Initial red runs: 8 migration regressions and 2 actual-Git cases failed for the
  expected reasons. First green batch: 4 files / 23 tests passed.
- Broader storage regression: 28 files / 171 tests passed (117.43s). Final
  late-writer/shutdown test also passes, preserving both copies after stopping.
- Real Obsidian qualification: 3 files / 3 tests passed (37.36s), including exact
  preservation of human ignore rules during migration, MCP restoration and
  unload/reload. Smoke: passed, errors [], hostErrorCount 0, pluginConsole [].
- Final focused ESLint: exit 0, zero warnings. Post-extraction smoke: passed,
  errors [], hostErrorCount 0, pluginConsole []; logs/debug report reviewed.
- `npm run verify:project`: exit 1. Typecheck passed (153.4s), source lint passed
  (9.0s), ESLint passed (571.1s), maker types passed (21.0s); the full product suite
  reached its unchanged 1,800-second launcher deadline (1801.6s). Summary:
  `4 passed, 1 failed, 0 skipped in 2556.1s`. Captured output also contains a
  Herdr worktree failure; the unchanged file passes in isolation (6 passed,
  1 existing platform skip, 32.12s). Full-suite qualification remains outstanding.
- `npm run verify:artifacts`: exit 0; production build and embedding test passed
  (1 test, 1 pass, 0 failures). UI-effect generation remains explicitly skipped
  because the design declares no visual definitions.
- Final evidence is under `reports/vault-data-polish/`: `focused-tests.log`,
  `engine-tests.log`, `source-audit-final.log`, `typecheck-final.log`,
  `eslint-final.log`, `obsidian-tests.log`, `obsidian-smoke-final.log`,
  `verify-project.log`, `herdr-worktree-check.log` and `verify-artifacts.log`.
  No test configuration, threshold or dependency was changed. No UI components
  or styles were changed in this pass. `git diff --check` passes.

## PR integration and delivery

PR #73 is based on current main, including #70 and #71. The unrelated source
checkout remains preserved. Provider research/tool restrictions were retained while
adding the private-data exclusions. Newly added analytical host fixtures and stream
history recovery text now use the migrated data paths.

Integrated focused qualification: 7 files / 41 tests passed. Extracting the
unchanged configured-run revision/completion helpers also clears the source-size
violation introduced on newer main; 3 workflow files / 20 tests passed and the
source-size/locale audit passes (4,017 inputs; 226 keys).

The PR's latest-head CI checks are the final merge qualification: canonical project
verification, browser journeys/gallery, real Obsidian, Windows process lifetime
and workflow verification isolation. Earlier Windows full-suite timeouts remain
recorded above and are not claimed as passes. The user authorized opening the PR,
bringing checks green, merging, then updating local main and installing the local
plugin. Final CI and delivery results are maintained in the PR description.

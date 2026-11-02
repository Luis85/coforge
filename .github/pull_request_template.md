## Summary

Keep CoForge operational data independently of plugin installation in an organized vault-root `.coforge-data/` directory. `data.json` remains settings-only, editable Markdown stays visible, and machine-specific worker state is included in the ignored runtime subtree.

Migrate legacy records and backup generations without changing their bytes or replacing conflicts. Preserve original worker ownership while active generations settle; verify and resume cross-drive transfers before removing originals. Relocate only exact owned MCP registrations in the expected scopes. Keep private data excluded from public exports, agent tools and workspace captures.

The finishing pass preserves human ignore rules, escapes Windows installation paths literally, rejects inherited filename-map keys, holds saves when older instances recreate journals, and indexes large archive manifests. Extract the unchanged stage runtime policy and configured-run state helpers to satisfy the existing source-size rule.

## Traceability

Owner decisions: BRIEF.md, Data it works with (2026-11-02). Task/evidence: docs/project-tasks/2026-11-02-vault-data-directory.md. Storage contract: docs/coforge/DATA-STORAGE.md. The design scaffold declares no req-* or vi-* obligations; none were invented or marked complete.

## Validation

- Integrated with current main (#70 and #71), retaining its provider research/tool restrictions. Focused integrated run: 7 files / 41 tests passed.
- Configured-run helper extraction on newer main: 3 files / 20 tests passed; source-size/locale audit passed (4,017 inputs; 226 keys).
- Earlier Windows qualification: 28 storage files / 171 tests and 6 runtime-policy files / 39 tests passed; real Obsidian migration, MCP restoration and lifecycle: 3 passed. Smoke reported passed, errors [], hostErrorCount 0, pluginConsole [].
- Typecheck, source lint, zero-warning ESLint and maker types passed locally. Source-size/locale audit passed after policy extraction. Production build and embedding passed.
- The complete Windows product suite exceeded its existing 1,800-second launcher limit. A captured Herdr worktree failure passes unchanged in isolation (6 passed, 1 existing platform skip). This is not recorded as a full-suite pass.
- Merge qualification uses the canonical CI, browser journeys/gallery and real-Obsidian checks attached to this PR. The PR stays draft until these pass; no thresholds, timeouts, isolation, dependencies or baselines were weakened.

## Evidence and limits

Local evidence: reports/vault-data-pr/ (integrated checkout), reports/vault-data-polish/ and reports/vault-data/ (original checkout). CI artifacts carry exact product, browser/gallery and native evidence. No UI components/styles changed; one history recovery message and native fixtures use the new paths. Tests use contained vaults and synthetic providers, without paid inference or live account mutations. Active legacy workers require settlement before relocation. Original working edits remain preserved in their source checkout.

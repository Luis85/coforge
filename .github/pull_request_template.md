## Summary

Fix false external-edit protection on successful CoForge writes, retain useful native Build failure reasons, and add a dedicated read-only request AI costs tab.

Note observers now reconcile current disk bytes after the concrete transaction settles, using only the latest successful exact-byte receipt. Managed-value fingerprinting matches canonical read-back; failed writes, external reverts and a second concurrent edit do not gain trust. Human body/frontmatter and workflow/artifact identities are preserved.

Native failures carry a fixed safe cause/next-step catalogue through CLI parsing, durable handshakes, snapshots and recovery without losing ownership quarantine or known spend. Legacy runs whose cause was discarded explicitly remain unknown. Failure panels link only to the selected attempt's actual task/response/diff/recovery evidence. Request AI costs reads the canonical ledger scoped by project and request, including failed/manual charges and explicit unavailable values.

## Traceability

Owner CF-133 report and AI-cost panel request are recorded in BRIEF.md; no req/vi obligations are declared by the scaffold. Task: docs/project-tasks/2026-11-01-cf133-run-reliability-and-costs.md. The separately requested normal native-worktree coding profile is the next increment; it is not implemented by this PR and no execution authority is expanded here.

## Validation

- Guard/storage/atomic/integrity: eight suites, 44 tests passed, including ten red/green regressions for round-trip normalization, duplicate/stale events, failed note/data writes, external reverts/conflicts and receipt invalidation across reload.
- Failure backend: 11 suites, 53 tests passed, including actual fixture processes, streamed Claude budget failure, partial changes/cost retention, unknown process ownership and durable/backcompat recovery. Classification uses safe fixed text; no raw diagnostic/prompt/credential payload is persisted.
- UI-related batch: 27 tests passed. Exact seven-tab browser cases: two passed with original geometry/containment limits.
- Contained Obsidian batch: four files/four tests passed (65.12s): self-write/reload/external revert, legacy/typed failure resources and canonical cost history, request-object and Sessions. Final bounded UI confirmation: one passed (24.05s); captures reviewed at wide/narrow light/dark.
- npm run test:ui-quality: eight passed. npm run ui:gallery: 40 captures, zero failures, reviewed. Final Impeccable detector: no findings.
- Typecheck, zero-warning focused ESLint/source lint, source caps/locale and diff checks passed. Fresh contained load/reload passed on pinned Obsidian 1.14.4 / launcher 3.2.1, with errors [], hostErrorCount 0 and pluginConsole []; host stopped. Final full project/CI results are recorded before merge.

## Review boundaries

CF-133's actual empty execution log contains only the old generic worker fallback. That does not establish which provider failure occurred, and this change does not invent a historical diagnosis. The false-guard round-trip/race defects are independently reproduced, not asserted as the exact historical trigger. No real CF-133 request, personal vault or paid provider run was touched or retried.

Unknown execution ownership still requires original-execution recovery. Read-only inspection and cost views offer no retry, provider input or cost editing. Costs are retained reports/manual provenance, not billing invoices; unknown cost is not zero and native assistant observations add no duplicate charges.

Ignored evidence: reports/cf133-run-reliability/, reports/obsidian/, reports/ui-gallery/. No reports, private data, screenshots, dist or native caches are committed. Local Node is 24.20.0; CI uses repository pins. No dependency/global-auth change, safety-rule weakening or automatic acceptance/replay.

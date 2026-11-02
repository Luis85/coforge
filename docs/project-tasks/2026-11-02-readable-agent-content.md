# Task: Make agent content readable throughout the studio

- Status: done
- Journey in BRIEF.md: understand captured task context, inspect agent answers and review results before approval.

## Why

Captured JSON and Markdown currently appear as dense source text in Activity and other agent evidence views. Users need readable content while retaining exact captured evidence.

## Traceability

Owner request and screenshot, 2026-11-02. The design scaffold contains no req-* or vi-* obligations for this change.

## Acceptance

- Structured captured tasks and responses display labelled fields, nested sections and readable lists, with decoded text and formatted Markdown.
- All agent response surfaces use consistent safe reading presentation; code diffs, commands and terminal evidence preserve code formatting.
- Exact original text stays available through a keyboard-accessible disclosure. Rendering never changes retained data or starts provider work.
- Invalid, truncated, oversized and deeply nested content stays inspectable with honest display-limit notices. HTML, media and privileged links cannot execute.
- Both themes and narrow panes remain readable and keyboard accessible.

## Plan

1. Add failing rendering tests for nested task JSON, structured answers, Markdown, hostile content and limits.
2. Introduce a bounded shared reading component and audit every response, prompt and answer call site.
3. Verify product regressions, browser journeys, UI quality/gallery, contained Obsidian and full repository gates.

## Out of scope

Provider prompts, captured bytes, canonical notes, publication, tool execution and mandatory review gates remain unchanged.

## Evidence

- First browser batch: 27 passed (3.0m), including four shared-reader fixtures, Council/polishing flows and all eight UI-quality checks. Wide/narrow captures in both themes inspected.
- Initial shared-checkout fast gate: typecheck, source lint, zero-warning ESLint and maker types passed; full product step hit the fast gate's existing 600-second limit. A later browser retry hit the existing 120-second preview-server startup limit before any tests ran. No limits were changed.
- Concurrent vault-storage migration edits arrived in the shared checkout. Readability changes were copied into a managed isolated checkout based on d9a675db for final qualification; the original edits and migration work remain intact.
- Surface inventory and rationale: reports/readable-content/audit.md.
- Final isolated focused regression: 3 files / 16 tests passed (9.47s), including appended-response whitespace and deep nesting. Initial isolated checks also exposed and corrected the Markdown/JSON regex syntax and an old disclosure selector; all existing capture-byte and safety assertions remain.
- Final browser batch: 21 passed (4.1m): Design, all request sections, the shared reader and eight UI-quality checks. Earlier Council/polishing coverage passed in the 27-test batch. Both themes, 360/480/1280px panes, keyboard source inspection and axe checks passed.
- Native navigation passed in the first targeted run; the response fixture then passed after excluding a concurrent storage-path hunk from the isolated baseline (1 passed / 33.25s). Exact original text, immutable note bytes, read-only inspection, wrapping and both themes were verified. The migrated path remains intact in the shared checkout.
- Final contained smoke passed: errors [], hostErrorCount 0, pluginConsole []; debug report/log inspected and session ended complete. Native task/answer screenshots reviewed. Gallery: 40 captures, zero failures, both themes and 360/1280px; index and contact sheet reviewed. No baseline changed.
- SHA-256 comparison confirmed 30 UI/test files matched the shared checkout; only the native fixture storage-path adaptation differs. No application/domain/infrastructure, dependency, permission, timeout or test-configuration change belongs to this task.
- Final `npm run verify:project` exited 0 on pinned Node 24.21.0 / npm 11.19.1: typecheck 134.0s, source lint 8.9s, zero-warning ESLint 341.6s, full product suite 1741.4s, maker types 45.7s. Summary: 5 passed / 0 failed / 0 skipped in 2271.7s. Full product report: 581 files, 2372 passed, zero failed, nine unchanged Windows-inapplicable skips (five POSIX CLI, one Herdr symlink, three managed POSIX lifetime cases); no TODO acceptance added.
- The same command passed production build (2201 modules, 18.84s) and one embedding test. The repository explicitly skips UI-effect checks because it declares no visual definitions; that is not an acceptance pass.
- Final full run used Node's code-compilation cache under ignored reports. Two fresh processes read different live file observations using the same code cache. Test-result reuse, file/process isolation, assertions and all original limits remain unchanged. An earlier isolated full run hit the 1800-second product limit and observed a stale formatter transform after a late patch; the final rerun kept the complete source frozen and passed.
- Self-review completed: safe allowlisted Markdown rendering, bounded JSON projection, exact source retention, no writes/dispatch from reading, no unsafe casts, architecture/file-size rules and all existing human-review/privacy gates checked. `git diff --check` passed. No unrelated migration edit was reverted.
- Evidence retained in the shared checkout under reports/readable-content/isolated/: verify-project.log, full-product-tests.json, browser-final.log, focused-confirmation.log, obsidian-final.log, obsidian-context-final.log, obsidian-smoke.log, gallery-contact.png, host-answer-dark.png, host-task-narrow.png and source-match.json. Full gallery is in isolated/gallery/; host evidence is in isolated/host/. Earlier failed attempts remain labelled in the logs.
- All task-owned processes and preview servers finished. Archival was attempted after evidence export, but Codex returned "The task's primary checkout cannot be removed." The isolated checkout remains attached for review; source changes also remain in the shared checkout. No manual removal or protection bypass was attempted.

## Untested scope

No live provider request or real billing was exercised. Native verification targets the affected reader/navigation paths, not every host spec. Concurrent vault-storage migration code is excluded from isolated qualification and is preserved in the shared checkout.

## Summary

Agent prompts and answers now open as readable sections, lists and formatted Markdown throughout Activity, Sessions/Peek, Council, saved artifacts, workflow results, polishing and Herdr previews. JSON fields use human labels, encoded nested content is decoded for display, and exact retained source stays in closed keyboard-accessible disclosures. Commands and diffs keep literal code formatting. Keyboard inspection pauses session follow.

The shared renderer bounds reading previews, identifies missing/empty values, preserves unsafe numeric notation, handles incomplete captures honestly and retains appended-response separators. Rendering uses the existing allowlisted Markdown nodes; untrusted HTML, media and privileged links cannot execute. Reading does not write notes or dispatch work.

## Traceability

Owner request recorded in BRIEF.md and docs/project-tasks/2026-11-02-readable-agent-content.md. The design scaffold declares no req-* or vi-* obligations for this change; none were invented or changed.

## Validation: actual results

Final npm run verify:project exited 0 in an isolated checkout based on d9a675db, using pinned Node 24.21.0 / npm 11.19.1:

    [ok] typecheck    134.0s
    [ok] source lint    8.9s
    [ok] ESLint       341.6s (zero warnings)
    [ok] tests       1741.4s
    [ok] maker types   45.7s
    Summary: 5 passed, 0 failed, 0 skipped (2271.7s)

- Full product report: 581 files, 2372 tests passed, zero failed, nine existing Windows-inapplicable skips and no TODOs. Skips: five POSIX fake-CLI cases, one Herdr symlink case, three managed POSIX lifetime cases. No new skip was added.
- The same command passed the production build (2201 modules, 18.84s) and one embedding test. The repository explicitly skips UI-effect checks because it declares no visual definitions; that is not an acceptance pass.
- Final focused formatter/Activity/session batch: 3 files / 16 tests passed (9.47s), including byte preservation, hostile markup, encoded/fenced JSON, malformed input, appended replies, prototype-shaped keys, deep/large content and keyboard follow pause.
- Final browser batch: 21 passed (4.1m): Design, all detail sections, the shared reader and all eight UI-quality checks. Earlier Council/polishing batch: 27 passed (3.0m). Both themes, wide/narrow panes, keyboard inspection and axe checks passed.
- Native request navigation passed in the initial targeted batch. The captured-context case passed on rerun (1 passed, 33.25s) after removing a concurrent migration's storage-path hunk from the isolated fixture. Exact capture bytes, immutable request-note bytes and source disclosure keyboard access were verified. The migrated path remains intact in the shared checkout.
- Final npm run -s dev:obsidian -- --json --port 9350: passed; errors [], hostErrorCount 0, pluginConsole []. Logs, debug report and task/answer screenshots reviewed; session ended complete.
- npm run ui:gallery: 40 captures, zero failures; index/contact sheet reviewed. No baseline changed.
- Self-review and git diff --check passed. No application/domain/infrastructure, dependency, permission, timeout or test-configuration change belongs to this task.

## Qualification environment and evidence

Concurrent vault-storage migration edits arrived in the shared checkout during verification. The readability diff was qualified separately; 30 UI/test file hashes matched the shared checkout. Only the native fixture storage-path adaptation differs. No unrelated edit was reverted.

Final full run used Node's code-compilation cache, with fresh process/file-read behavior checked. Test-result reuse, process/file isolation, assertions and original limits remain unchanged. Earlier fast/full attempts hit their existing test budgets; a late formatter patch also exposed a stale transform in the earlier full run. The final source stayed frozen during the successful rerun.

Evidence is retained under reports/readable-content/isolated/: verify-project.log, full-product-tests.json, browser-final.log, focused-confirmation.log, obsidian-final.log, obsidian-context-final.log, obsidian-smoke.log, source-match.json and audit.md. Gallery: isolated/gallery/. Native: isolated/host/. Reviewed screenshots include host-answer-dark.png and host-task-narrow.png. Reports, compile caches, binaries and builds remain ignored.

## Untested scope

No live provider request or real billing was exercised. Host validation targets affected reader/navigation paths, not every native spec. Concurrent vault-storage migration code is excluded from this isolated qualification. No release operation is included.

## Integration qualification

Rebased onto 8d4ec0ef (#70, workflow agent refinement and task execution). Prior local results above qualify d9a675db plus the readability diff. The merged captured-configuration view preserves upstream analytical-tool evidence alongside readable CoWorker instructions. Full PR CI, including browser and real-Obsidian jobs, will qualify the integrated commit before merge. The owner explicitly requested opening this PR and merging after CI is green.

Post-rebase focused checks passed 4 files / 17 tests (26.87s). Initial CI passed the repository, browser, Windows lifetime, isolation and security jobs. The host suite passed 70/71 and exposed an old assessment-disclosure selector matching the new nested source disclosure. The corrected test scopes both disclosures explicitly and verifies original assessment bytes from the canonical note with keyboard access across both themes and widths. Local contained-host confirmation: 1 passed (37.42s). Existing data/privacy assertions and limits are retained. Final CI qualification is recorded on PR #71 before merge.

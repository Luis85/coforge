## Summary

Existing foreground Build attempts kept their short execution policy when retried; restarting to use the background runner repeated completed steps. **Retry Build in background** now creates a reviewed background attempt in the same run, preserving its definition, cursor, completed results, attempts and job history. It copies the actual reviewed partial work onto its original Git base in a fresh worker workspace.

**Improve & polish** is an optional workflow setting using either a saved CoWorker or manual provider/model/effort, instructions and limits. Card context menus and feature details open a required feedback modal in every bucket, including accepted requests. A separate one-step run polishes the current request, screening/RICE, Plan, Design, Markdown or code result; human Apply/Discard preserves main progress and genuine output history. Previously accepted requests earn no extra completion reward.

Code review binds full scoped bytes and retains original workspaces. Disclosed Git-ignored agent-blocked dependency/private directories are excluded; tracked descendants and allowed ignored source files remain verified. New copies use private receipts and explicit epochs, with no invented paid job. Unknown work is retained, known failed copies can receive an explicit fresh-copy retry, and late callbacks cannot write through a stopped host.

Full host qualification exposed an MCP reload race. Connection publication now belongs to its publishing instance, so delayed old shutdown cannot clear a replacement's authenticated descriptor. Startup saves its journal before publishing readiness, and runtime disposal closes the Apply fence before awaiting MCP cleanup.

## Requirements and traceability

Owner choices are recorded in BRIEF.md. This scaffold has no req-* or vi-* entries for the increment; no IDs were invented. Three implementation agents and independent cross-reviews executed the task and the eight-increment improvement/closeout plan in docs/project-tasks/2026-10-31-retry-build-in-background.md and docs/project-tasks/2026-10-31-background-retry-polishing-closeout.md.

## Validation

This draft records the implementation and focused integration results. Final combined-source outcomes are recorded in the PR checks and updated PR description before merge.

- After integrating main PR60: native/tool compatibility **8 files / 31 passed**; request-text guidance **7 suites / 22 passed**; Increment/polishing/navigation compatibility **7 files / 53 passed**. Global typecheck, scoped ESLint and diff checks passed. No production source is changing during qualification.
- Prior frozen increment source: `npm run test:e2e` **242/242 passed (37.2m)**; `npm run test:ui-quality` **8/8 passed (52.6s)**; `npm run ui:gallery` **40 captures, zero failures**, reviewed in both themes and narrow/wide layouts.
- Prior frozen increment source: full `npm run test:obsidian -- --no-build` **57/57 passed across 49 files (672.78s)**; **57 completed teardowns, 58 stopped owned sessions, zero retained scratch vaults, zero mismatched installed assets**. The fixed MCP reload case passed within this full run. Fresh contained smoke on Obsidian **1.14.4 / launcher 3.2.1** passed with `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`.
- The first full project run exposed two stale test fixtures and a lint preference: **1,826 tests passed, two failed, six existing Windows skips**. The actual workflow-name selector, runtime port factories and string-prefix check were corrected while preserving their assertions. A later native run exposed the MCP reload race, fixed with deterministic regression and actual Windows reload/RPC/note/shutdown confirmation. Main then advanced; this draft integrates it and retains the above runs as historical evidence.
- Full project and full combined-source browser/native qualification are required before merge; their final results will replace the historical snapshot in the PR description. No test or logging thresholds, baseline images, production permissions or platform skips were weakened.

## Evidence and limits

Controlled native Node/Git and private-receipt tests cover exact binary/untracked/deleted changes, original-base pinning, real workspace ownership versus a later failed executor, before-provider import, repeat confirmation, same-ID receipts, fresh-copy failures, Stop/reload, and source/copy mutation. Actual Vault tests cover unknown frontmatter/body preservation, private-write rollback, canonical recovery across reloads, no duplicate rewards and stopped-host fencing. UI proofs cover required feedback, stale context, scope/source disclosure, themes/widths, keyboard/Axe and retained current results.

No paid vendor call, live CF-135 retry, paid multi-day soak, personal vault, mobile or alternate Obsidian version was used. Foreground process cessation is operator-confirmed; unknown original workers/copies remain held. An old worker without reviewed-snapshot support blocks new admission. Converting a captured run that has a later foreground editing step is rejected before paid work. Preview/file bounds and provider-specific budget enforcement remain explicit; Git merge/release of generated feature code remains manual.

No dependencies, audit exceptions, logging-cap increases, baseline updates, weakened assertions or new platform skips were added. Local Node/npm are 24.20.0 / 11.21.1; CI uses repository pins 24.21.0 / 11.19.1. The draft PR is labelled e2e and only its exact green head may be squash-merged.

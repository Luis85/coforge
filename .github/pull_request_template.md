## Summary

Add thirteen MCP tools for maintained CoWorker discovery/delegation and current-vault assistance. Assistants can create retryable analytical tasks, review preflight, dispatch with captured definitions/provider/model, inspect durable runs/published contributions and cancel work.

Wrap sixteen official read-only Obsidian CLI commands with exact current-vault verification, bounded output/time and cancellation. Ordinary Markdown authoring uses Obsidian's atomic vault API with prior-content checks. Managed/watched/public notes retain dedicated service gates. Isolated Council sessions cannot access operator tools.

## Requirements and traceability

- Owner requests dated 2026-10-29 in BRIEF.md: roster, definition-based subagents, assistant capability review and current-vault CLI.
- Task/evidence: docs/project-tasks/2026-10-29-mcp-coworkers.md.
- Imported requirement/vi-* catalogue has no entries for this increment; generated traceability is unchanged.
- Existing Council definition/execution policies and final human code review remain authoritative.

## Validation

- npm ci: 691 packages added; 0 vulnerabilities.
- Focused regression suite: 6 files / 32 tests passed. Final CLI/process suite: 11 passed, including exact host content despite CLI newline formatting, custom configuration folders, legitimate note text beginning with Error and redacted native failures.
- Initial check:fast: typecheck, source lint, zero-warning ESLint and maker types passed; 2 synthetic project fixtures failed due to missing repository paths. Fixed and confirmed in the focused suite; 107 other files / 367 tests passed in the initial related run.
- Initial full verification found four existing view-catalog failures (275 files / 969 tests passed, 6 tests skipped). Fixed two abbreviated panel parent links and regenerated stale sitemap JSON from canonical notes. check:views and all 9 view-catalog tests now pass.
- Final npm run verify:project: exit 0; check: ok, 5 passed / 0 failed / 0 skipped gates (769.2s). Product tests passed, artifact build completed and prototype embedding passed (1 test). UI effects reports no declared visual definitions.
- git diff --check: clean. Manual self-review completed; no unsafe casts, weakened gates or oversized files.
- Final npm run typecheck and focused zero-warning ESLint on the completed tools/schema/tests: exit 0.

## UI evidence

No interface changes; test:ui-quality and ui:gallery not applicable.

## Obsidian evidence

- Pinned smoke: status passed, errors [], hostErrorCount 0; app/installer 1.14.4, launcher 3.2.1. Evidence: .obsidian-sandbox/logs/.
- npm run test:obsidian -- plugin-lifecycle: 1 passed.
- npm run test:obsidian -- coforge-mcp-vault: 1 passed; real HTTP MCP creates exact private CRLF bytes, handles identical retries/stale conflicts and writes no client registration.
- Native evidence: reports/obsidian/ (ignored). No personal vault or real client settings touched.
- Reused-sandbox final smoke: status passed, plugin errors []; hostErrorCount 2 from Obsidian core command-list callbacks (null parent/getContainer). Native MCP spec has no errors.

## Untested scope

No live billable provider, real client activation or operator-installed CLI invocation. CLI process behavior uses an injected port; native note writes/MCP lifecycle use the pinned host. Local Node 24.20.0 / npm 11.21.1 differs from pinned Node 24.21.0 / npm 11.19.1. No commit, push, release or deployment performed.

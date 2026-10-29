## Summary

Expose thirteen MCP tools for maintained CoWorker delegation and current-vault assistance. Assistants discover reusable definitions and project memberships, save retryable analytical tasks, review preflight, dispatch the captured definition/provider/model, monitor durable runs, retrieve published contributions and cancel work.

Wrap sixteen official read-only Obsidian CLI commands with explicit current-vault targeting, path verification, bounded execution and cancellation. Read replies separate exact host content from formatted CLI output. Ordinary Markdown authoring uses Obsidian's atomic vault API with prior-content checks. Managed/watched/public notes retain dedicated service gates; isolated Council sessions cannot access operator tools.

## Requirements and traceability

- Owner requests dated 2026-10-29 in BRIEF.md: roster, definition-based subagents, assistant capability review and current-vault CLI.
- Task/evidence: docs/project-tasks/2026-10-29-mcp-coworkers.md.
- No imported req-* or vi-* obligation applies; generated traceability is unchanged.
- Existing Council definition/execution policies and final human code review remain authoritative.
- Integrated main's Project settings/navigation changes. Corrected two Council panel parent links and regenerated the 92-view catalogue from canonical notes.

## Validation

- Before integration: npm run verify:project exited 0; check: ok, 5 passed / 0 failed / 0 skipped gates (769.2s). Product tests passed, artifact build completed and prototype embedding passed (1 test).
- Focused MCP regression suite: 6 files / 32 tests passed; final CLI/process suite: 11 passed, including exact read/edit preconditions, custom configuration folders, preserved Error-prefixed note text and redacted process failures.
- Final typecheck and focused zero-warning ESLint passed.
- After integration: check:views validates 92 contracts and the current sitemap. Integrated MCP/catalogue regressions and full CI qualification are running.
- git diff --check: clean. Self-review found no unsafe casts, weakened gates or oversized files.

## UI evidence

This PR changes no runtime interface. Project settings/navigation changes are inherited from main. UI-quality/gallery evidence for this PR is requested through the e2e CI label.

## Obsidian evidence

- Native MCP and lifecycle cases: 2 passed. Real HTTP MCP creates exact private CRLF bytes, handles identical retries/stale conflicts and writes no client registration.
- Fresh pinned smoke: status passed, errors [], hostErrorCount 0; app/installer 1.14.4, launcher 3.2.1.
- Reused-sandbox smoke: status passed, plugin errors []; two Obsidian core command-list callback errors (null parent/getContainer), recorded separately.
- Evidence: reports/obsidian/ and .obsidian-sandbox/logs/ (ignored). Full native CI requested through e2e.

## Untested scope

No live billable provider, real client activation or operator-installed CLI invocation. CLI process behavior uses an injected port; note writes/MCP lifecycle use the pinned real host. Local Node 24.20.0 / npm 11.21.1 differs from pinned Node 24.21.0 / npm 11.19.1; CI uses the pins. No personal vault or real client settings touched. No release publication requested.

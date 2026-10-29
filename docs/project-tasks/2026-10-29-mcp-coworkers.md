# Task: Give MCP assistants durable CoWorker delegation

- Status: done
- Journey in BRIEF.md: reusable CoWorkers and explicit, bounded Council execution; vault-wide MCP.

## Why

An external assistant can process request workflows, but cannot discover CoWorkers or delegate analytical work using their maintained definitions. It also lacks reconnectable task/run/result tools.

## Traceability

- Owner request: 2026-10-29, MCP roster, CoWorker subagents and assistant capability review.
- The imported design/traceability.json has no requirement entries or vi-* obligations. Existing Council DEF/EXEC policies apply; generated traceability stays unchanged.
- Behavioral tests: src/plugin/tests/project/coforge/mcp-coworkers.test.ts; transport integration: mcp-module.test.ts.

## Acceptance

- Discover project team memberships and canonical definitions with stable revisions; invalid/disabled definitions never become execution authority.
- Save private retryable tasks for a single CoWorker or council without execution; preserve conflicting notes exactly.
- Require a fresh preflight identity before dispatch; use the existing durable kernel and configured provider/model. Repeated submission never starts a second generation.
- Read project-scoped runs and only published artifacts; cancel explicitly. Pauses, unknown outcomes, human decisions and final review retain existing semantics.
- Isolated provider sessions keep their invocation-only dispatcher and cannot access the operator roster or global results.

## Plan

1. Behavioral failures for direct-agent authoring, then minimal schema extension and MCP adapters.
2. Compose with existing runtime services; no new feature registration/generator is needed.
3. Run project checks, native smoke and host tests. No interface changes; gallery/UI-quality gates are not applicable.

## Capability review

Existing MCP: project discovery, project briefs/workflow/request context, step reservation, queued polling, structured result submission, cancellation, bounded repository list/read/search, isolated Build writes/deletes.

Added MCP: roster, individual definition, task create/list, preflight/dispatch, run list/detail, published artifact retrieval and cancellation. Together these cover discover → prepare → delegate → monitor → collect → stop, including reconnects and truthful simulation/usage evidence.

Owner follow-up: wrap the official Obsidian CLI for the current vault. Added status, a structured read-command wrapper and atomic native note authoring. Every CLI operation pins/verifies the current vault; direct Markdown paths exclude links/metadata/credentials. Ordinary note edits use exact previous-content checks inside vault.process, with safe create and identical-content retries. Managed/watched/public note writes retain dedicated service gates. CLI operations are bounded, abort on MCP revocation, and do not accept executable, environment, vault or raw-argument overrides.

Human-owned controls stay in Obsidian: credentials, executor designation, global resume, uncertain-outcome recovery, budget extensions, definition permission changes, approval/checklists, final code acceptance, streaming/moderation and public publishing. No generic shell or arbitrary vault writer is introduced. Direct CoWorker work uses the existing analytical access profile; implementation continues through the screened request workflow.

## Evidence

- Initial tests failed because the adapter did not exist.
- Behavioral red run with the old task schema: 3 failed / 2 passed, target.kind expected one of council.
- `npm ci`: 691 packages added, 0 vulnerabilities.
- Focused regression suite: 6 files / 32 tests passed (12.27s), including real stdio/HTTP tool routing, source/definition freshness, deduplication, publication-only results, cross-project denial, scoped-session denial, vault mismatch, argument isolation, linked paths, atomic note conflicts and revocation.
- Final CLI wrapper/process suite: 11 passed (2.49s), including custom non-hidden host configuration and exact host content despite CLI newline formatting. Successful note text beginning with `Error:` stays intact; only process failures become redacted tool errors.
- `npm run check:fast`: initial run failed 2 fixture cases because their synthetic projects omitted a required repository path; 107 other files / 367 tests passed. Fixed the fixture inputs; the focused final suite passes. Typecheck, source lint, zero-warning ESLint and maker types passed in that initial run.
- `npm run -s dev:obsidian -- --allow-download --json`: pinned app/installer 1.14.4, launcher 3.2.1; status passed, errors [], hostErrorCount 0, view opened and reload succeeded.
- Final `npm run -s dev:obsidian -- --json` on the reused sandbox: status passed, plugin errors [], reload succeeded; two Obsidian core command-list checkCallback errors (`parent`/`getContainer` on null) were reported separately as hostErrorCount 2. The native MCP spec recorded no errors.
- `npm run test:obsidian -- plugin-lifecycle`: 1 passed; disable/re-enable restores commands/views without errors.
- `npm run test:obsidian -- coforge-mcp-vault`: 1 passed; restored active MCP in the scratch vault, discovered the new tools, created a private note through real HTTP MCP, preserved exact CRLF bytes, handled identical retries and stale conflicts, and wrote no client configuration.
- First `npm run verify:project`: typecheck, source lint, zero-warning ESLint and maker types passed; full tests reported 275 files passed / 1 failed, 969 tests passed / 4 failed / 6 skipped. The failures were existing view-catalog drift: two abbreviated parent links and a stale generated JSON sitemap. Corrected both panels to their owning Ask the Council page and regenerated the catalogue from canonical notes, preserving authored metadata. The nine view-catalog tests and check:views now pass.
- Final `npm run verify:project`: exit 0. `check: ok`; 5 passed, 0 failed, 0 skipped gates in 769.2s. Full product tests passed; artifact build completed; prototype embedding 1 passed / 0 failed. UI effects reports no declared visual definitions.
- Final `npm run typecheck`: exit 0. Focused zero-warning ESLint on the completed Obsidian tools/schema/tests: exit 0, including the last exact-content read change.
- No UI changes; UI-quality/gallery are not applicable. Native evidence is in reports/obsidian/ and .obsidian-sandbox/logs/; these remain ignored.
- Manual self-review: adapters use existing application contracts; only the direct-agent task schema changes domain behavior. Captured definitions, existing worker/review/recovery gates and scoped provider tools remain authoritative. No logging of note content, paths or native causes; no unsafe casts or threshold changes; new files remain below size limits. `git diff --check` is clean.

## Untested scope

Live billable provider calls, real client activation and invocation of the operator's installed CLI are not part of contained verification. CLI execution uses an injected process port in tests; native note authoring and MCP lifecycle use the pinned real host. The six existing skipped cases are Windows exclusions in the Claude fake-CLI orchestration and Herdr filesystem suites; no new test is skipped. No personal vault, global client settings or user CLI configuration was touched. Local commands use Node 24.20.0 / npm 11.21.1; the checkout pins Node 24.21.0 / npm 11.19.1.

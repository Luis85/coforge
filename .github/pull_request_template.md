## Summary

Windows build promotion rechecks the destination after compilation and retries transient rename locks. Persistent failures preserve the previous build, complete candidate and recovery backup. The repair is applied in C:\Projects\coforge, where the merged plugin built and installed successfully without changing plugin data.

Council native agents expose only invocation-scoped CoForge MCP action tools: captured task context, bound inputs and approved nudges. Built-in action tools and other MCP servers are disabled. Nudges enter the existing message authority after contribution persistence. Authentication is preserved; ordinary hooks, ambient memory/instructions and skill commands are disabled. Vault MCP adds starting guidance and structured task/queue hints.

Event triggers attach a saved project or Council workflow to application/project facts. Bindings pin definitions, reserve evidence before admission and bound causation chains. Missed/paused/cooldown/overlapping events skip with recorded reasons; uncertain outcomes require recovery without replay. Project workflow nudge steps create an independent task for one allowed team agent with inherited ceilings. Human decisions and code review remain authoritative.

## Requirements and traceability

- Owner requests and confirmations, 2026-10-28, recorded in BRIEF.md.
- Task: docs/project-tasks/2026-10-28-agent-tools-event-workflows.md.
- Generated traceability has zero pending req-* / vi-* obligations; no generated verification status was hand-edited.
- Surface: docs/components/views/council-events.md; sitemap regenerated. Guides: docs/coforge/THE-COUNCIL.md and MCP.md.

## Commands and evidence

- node --test tooling/tests/build.checks.mjs tooling/tests/build-promotion.checks.mjs: 9 passed, 0 failed. Includes transient/persistent locks, rollback, destination creation during compilation and installer recovery.
- Primary npm run build:local: production build and three-asset install succeeded; merged hashes matched. reports/mcp/install-primary-fixed.log.
- Targeted policy/session/server/provider/event tests: 15 passed. Workflow/UI/MCP compatibility tests: 13 passed. Native host admission integration passes for agent nudges and both workflow types, pinned definitions and private source preservation.
- npm run typecheck: exit 0, reports/mcp/typecheck-release.log.
- npm run check:source: line limits and locale parity passed; 2933 inputs, 226 translated keys.
- npm run check:views: 76 views documented; navigation coverage valid; sitemap current.
- npm run test:ui-quality -- --config reports/mcp/playwright.config.mjs tests/e2e/journeys/workflow-triggers.spec.ts: eight general WCAG/reflow/keyboard checks passed. New journey initially exposed an example-rendering bug and locator mismatch, both fixed. Final polished journey rerun: 2 passed (43.9s), both themes at desktop/360px, draft retention, revision review and zero axe violations. Port 4193 used because default 4181 was occupied; no gate was weakened.
- npm run ui:gallery: 40 screenshots captured; gallery/index and both event themes/widths reviewed. No baselines changed or committed.
- Native Claude Code 2.1.281 offline probe used dummy credentials and a local mock API. Initial safe mode suppressed explicit MCP servers. Final catalogue contains only mcp__coforge__coforge_invocation, mcp__coforge__coforge_read_input, mcp__coforge__coforge_nudge_agent and StructuredOutput; an actual invocation call succeeded. No paid model request. reports/mcp/native-policy-proof-fixed.log.
- Self-review heuristic: no findings in 85 changed files against origin/main b9f2a5d; git diff --check passed. Diff reviewed for authority, persistence ordering, privacy, typed boundaries, lifecycle and file limits.
- Earlier iteration failures and fixes remain recorded in reports/mcp/check-agent-events.log; final full verification follows below.

## Final verification

npm run verify:project: exit 0. Full check: 5 passed, 0 failed, 0 skipped in 782.2s. Production candidate built successfully; prototype embedding: 1 passed, 0 failed. Generated UI-effect checks are explicitly skipped because no visual definitions are declared. Final Council profile refinement: 10 targeted policy/session/provider tests passed and targeted ESLint passed. reports/mcp/verify-agent-events.log and final-policy-tests.log.

Verified test build installed to C:/Projects/coforge/.obsidian/plugins/coforge. All three asset hashes match; five existing non-asset files are byte-for-byte unchanged. Source remains on local branch codex/agent-tools-event-workflows; the primary checkout has the build hotfix. reports/mcp/install-verified-build.log.

## UI and Obsidian evidence

reports/ui-gallery/index.json and gallery.html; reports/workflow-triggers/form-{light,dark}-{1280,360}.png.

npm run -s dev:obsidian -- --json and npm run test:obsidian report obsidian-launcher 3.2.1 is not provisioned. Nothing was downloaded or launched. In-memory Obsidian tests cover canonical definitions, reviewed admissions, private source notes and inherited limits. Real host rendering/reload remains unqualified.

## Untested scope

Live model reasoning, real-account authentication and billing were not exercised. Administrator-managed Claude policy remains authoritative. Structured-output/completion controls are provider primitives, distinct from arbitrary action tools. External clients retain their own tool/history/model policy; Council uses its own narrower profile. No live Twitch/OBS/Herdr sessions. Windows retains six Unix-only fake-CLI skips. Local Node v24.20.0; .nvmrc pins v24.21.0. Reports, scratch files and assets remain ignored. Current feature changes are local; no new PR opened or merged.

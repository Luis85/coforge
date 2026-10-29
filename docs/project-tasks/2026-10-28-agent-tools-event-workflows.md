# Task: Enforce CoForge-only agent tools and automate workflows from events

- Status: implemented and locally installed
- Journey in BRIEF.md: Agent tools and event automation.

## Why

Agents need a small, discoverable CoForge API and a host-enforced tool boundary. The streamer also needs repeatable workflows launched from application/project facts, including explicit agent-task nudges.

## Acceptance

- Build/install merged b9f2a5d locally without changing plugin data; compare the three installed asset hashes.
- Native Council launches expose only scoped CoForge MCP action tools. No native tools, unrelated MCP servers, prior independent opinions, other projects, review approval or arbitrary workflow admission is available through that session.
- Invocation context and authorized inputs are discoverable; nudges are validated drafts committed only after contribution persistence. Cancel/unload revokes the session and retains uncertain run evidence.
- Bind named application/project events to either workflow type. Use explicit request subjects for v1/Idea workflows; do not create requests or widen permissions from event payloads.
- Persist reservations before effects, deduplicate events, skip paused/missed/overlapping work, preserve snapshots and enforce bounded causation chains.
- Add an explicit agent nudge action with prompt and recipient validation. Preserve existing workflow semantics and final human review.
- Polish agent setup, MCP readiness/errors and workflow trigger configuration using existing UI conventions; keep drafts and clear recovery states.

## Traceability

Owner requests and confirmations, 2026-10-28. Generated traceability has no req-* or vi-* entries.

## Plan

1. Failing policy/session and event-routing tests; then minimal scoped transport and durable event service.
2. Wire existing execution kernels and message authority; add trigger/nudge configuration and setup guidance.
3. Product checks, browser quality/gallery, contained host evidence where provisioned, self-review and final local install.

## Evidence

- Merged b9f2a5d: production build passed and three assets installed in this checkout's `.obsidian/plugins/coforge`; user data and Restricted Mode preserved.
- Installed Claude Code: 2.1.281; flags checked against native help and official documentation.
- Windows destination race reproduced with EPERM; build/installer regression suites pass 9 tests. Repaired primary checkout build/install succeeded.
- Native offline mock-API probe confirms exactly three scoped CoForge tools plus StructuredOutput and a successful invocation call, with no paid model request. Safe mode suppressed explicit MCP servers; replaced it with restricted settings/tool isolation while retaining authentication.
- Event UI browser checks pass both themes and desktop/360px widths (2 passed); eight general UI quality checks pass. Gallery captured 40 screenshots and was reviewed.
- Native host admission integration passes for one allowed agent, inherited ceilings, both workflow types, pinned definitions and private source preservation.

## Untested scope

Full verification passed: check 5/5, production build and embedding test passed. Final native-profile tests 10/10 and targeted ESLint passed. Test build installed in C:/Projects/coforge/.obsidian/plugins/coforge; asset hashes match and five non-asset files are unchanged. Native Obsidian launcher is unprovisioned locally; agents do not download it. Live provider reasoning/billing and real host reload remain unqualified. Detailed evidence is in .github/pull_request_template.md.

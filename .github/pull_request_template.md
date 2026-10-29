## Summary

The Stream chat contributor count included all 48 profiles loaded by the sample workspace. Scope chat messages and contributor counts to Twitch by default and to simulator data during explicit local testing. Ending a local test restores Twitch history and keeps the draft and stored data.

## Requirements and traceability

- Owner bug report (2026-10-29): example workspace contributors remain in the local Twitch chat contributor count.
- BRIEF.md: sample data and local testing require explicit actions; stream chat and community are shared across projects.
- No imported req-* or vi-* obligation applies: design/traceability.json has no requirements or interactions. Generated traceability is unchanged.
- Updated the Stream chat view contract in docs/components/views/stream.md.

## Validation

- Before the fix: chat-panel-ui.test.ts had 3 failed tests, reproducing sample-history leakage, the mixed contributor count and local-test selection behavior.
- npm test -- src/plugin/tests/project/coforge/chat-panel-ui.test.ts src/plugin/tests/project/coforge/twitch-controls.test.ts src/plugin/tests/project/coforge/example-cleanup.test.ts: 3 files passed, 14 tests passed.
- npm run verify:project: exit 0. npm run check: 5 passed, 0 failed, 0 skipped in 859.7s (typecheck, lint, zero-warning ESLint, full product tests, maker types). Production build completed; prototype embedding: 1 passed, 0 failed. test:ui-effects explicitly skipped because the project declares no visual definitions.
- npm run check:views: 92 views documented; navigation coverage valid; sitemap current.
- git diff --check: clean.
- Self-review: source filtering happens before the 100-message limit; empty state and auto-scroll use the same source; bot identity is excluded from contributor counts. No storage writes, note changes, host API changes, unsafe casts or weakened gates.

## UI evidence

- npm run test:ui-quality: 8 passed (1.2m), exit 0.
- npm run ui:gallery: captured 40 screenshots; failures []; exit 0. Reviewed desktop light and narrow dark studio captures in reports/ui-gallery/. The gallery covers the existing clickdummy; focused component tests verify the changed runtime chat projection.
- Component regressions cover all 48 saved sample profiles, a real Twitch contributor amid more than 100 example messages, and entering/leaving a local test with unchanged stored state and draft.

## Obsidian evidence

- npm run -s dev:obsidian -- --allow-download --json provisioned pinned Obsidian app/installer 1.14.4 and launcher 3.2.1 inside this checkout. Plugin loaded/reloaded with errors [], but the first host startup had two core command-list errors and could not open a tab group.
- Repeated npm run -s dev:obsidian -- --json using the saved sandbox workspace: status passed, view.opened true, errors [], hostErrorCount 0, pluginConsole []. Exit 0.
- Reviewed .obsidian-sandbox/logs/last-run.png and read dev.log/debug-report.json. The smoke opens the public Kanban; sample contributor behavior is covered by component tests.
- Full test:obsidian not run: no lifecycle or host API changes.

## Untested scope

No personal vault or live Twitch connection was used. The fix is built and installed only in the contained sandbox; the user's personal local plugin was not updated. Node 24.20.0 / npm 11.21.1 differs from the pinned Node 24.21.0 / npm 11.19.1. The owner authorized pushing a PR, merging after green CI, and then updating the repository-root local plugin. No release publication requested.

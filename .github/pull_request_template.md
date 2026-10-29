## Summary

Add Service Design to Build & Improve. Each project owns one Service Blueprint with ordered journey steps, five core layers, actors, touchpoints, systems, pain points and opportunities. The grid and searchable entity editor save canonical frontmatter-plus-Markdown notes with stable IDs and wikilinks in a configurable private vault root.

## Requirements and traceability

- Owner-approved scope and storage decisions are recorded in BRIEF.md (2026-10-29).
- No imported req-* or vi-* applies: design/traceability.json contains no requirements/interactions and is unchanged.
- Acceptance and the researched six-increment improvement plan are in docs/project-tasks/2026-10-29-service-design*.md.
- The new view contract and generated sitemap document navigation and recovery.

## Validation

- npm ci: 691 packages added, 692 audited, 0 vulnerabilities.
- Domain/vault suite: 2 files, 17 tests passed; all kinds/ownership, graph validation, input capture, exact Markdown/unknown properties, stale/atomic conflicts, write failures, retained roots, invalid settings, reserved paths and Git-ignore protection.
- Component suite: 4 passed; all kinds, links, ordering, focus, search/count behavior, per-project retained drafts, replacement confirmation, stale edits and captured in-flight project.
- Integration/startup/public policy: 3 files, 26 tests passed; both overlapping configuration orders and failed-write reservation release covered while Council watched request notes remain compatible.
- Project typecheck and focused source/test ESLint: passed with zero warnings.
- Merged-main focused regression run: 5 files, 40 tests passed (12.26s), covering domain, vault, UI, integration and startup/disposal.
- npm run verify:artifacts: production build passed (7.89s); prototype embedding 1 passed, 0 failed. test:ui-effects explicitly reports no declared visual obligations.
- Merged-main typecheck passed; npm run check:source passed for 3221 inputs and 226 translated keys.
- npm run check:views: 102 views documented; navigation coverage valid; sitemap current. Normalized two incoming Council view parent references to the existing catalogue schema.
- git diff --check: clean.
- Pinned CI npm run verify:project: 5 gates passed, 0 failed, 0 skipped in 252.9s; production build and prototype embedding passed. Community review: 16 pass, 0 warn, 0 fail. Qualification receipts are linked from PR #43.
- Local full product-test stage exceeded its 600-second process deadline; typecheck, both lint gates and maker types passed. The reported Herdr worktree case passed in isolation (5 passed, 1 existing Windows-only symlink skip). No test assertions, timeouts or output limits were relaxed; pinned CI qualified the complete suite.

## UI evidence

- npm run test:ui-quality -- --config .nq/service-design-ui.config.ts: 8 passed (46.1s), no skipped/unexpected tests. The ignored wrapper uses isolated port 4281 because another process owns 4181; assertions are unchanged. Report: reports/e2e/service-design-ui-quality.json.
- npm run ui:gallery: 40 captures, failures []; desktop light and narrow dark studio captures reviewed. This covers the existing clickdummy plus new navigation; feature-native captures are separate.
- Focused real-host Service Design spec: 1 passed, exit 0, complete create/link/configure/reload/conflict/reopen path and clean teardown.
- Five native WCAG 2.1 A/AA scans: zero violations. Wide/narrow and light/dark maps have 32px gutters, 24px editor-heading spacing and zero page/editor overflow; narrow table scrolling stays inside its region.
- Stable captures and geometry/Axe JSON: reports/service-design-review/. A fresh independent reviewer inspected all five captures and returned ship for the captured UI/product scope, with no material findings.
- The owner's layout feedback exposed a missing shared page-frame selector. Fixed the gutters, section spacing and table alignment, and added measured host regressions. Mechanical detector: [] findings.
- The extra destination exposed 14px of navigation overflow in a 740px pane. Two compact-only outer-padding changes recover 16px; labels, fonts and control targets stay intact. The focused navigation/focus/workspace/view-intent batch passed all 33 tests, with zero overflow in light and dark. Results and reviewed captures: reports/navigation-space/.

## Obsidian evidence

- npm run test:obsidian: 24 files passed, 31 tests passed, 365.52s, exit 0. Includes lifecycle, privacy, navigation, MCP and Service Design. Reports: reports/obsidian/.
- Pinned Obsidian CI after latest-main integration: 25 files, 32 tests passed (208.66s), followed by a successful agent-loop smoke.
- After the compact-navigation correction, the final local Service Design/navigation rerun completed all three test bodies, but exited 1 from OBSIDIAN_STOP_TIMEOUT during Windows session cleanup. This is recorded as a failed local command; final-head native qualification is provided by CI.
- Pinned contained host: Obsidian app/installer 1.14.4, launcher 3.2.1.
- npm run -s dev:obsidian -- --allow-download --json: status passed, errors [], hostErrorCount 0, pluginConsole [], exit 0. Read dev.log/debug-report.json and reviewed last-run.png. Its Windows shutdown reported OBSIDIAN_STOP_TIMEOUT after the successful summary; the full suite later completed cleanly.

## Review and untested scope

Independent subagents reviewed product/method coverage, UX/accessibility, data integrity, privacy/reliability and integration boundaries, then a fresh reviewer checked the corrected renders. Findings drove graph/concurrency checks, private-root reservations, focus, stable totals, indexed cells, searchable relationships, Markdown preview and service-scenario guidance.

No personal vault, credentials, live Twitch/OBS session or AI provider was used. Dedicated visual evidence covers a populated three-step map and a wide dark recovery editor; it is not an exhaustive visual state matrix. No multiple blueprints, deletion/cascades, directional arrows, AI authoring or diagram export is introduced. Local Node 24.20.0/npm 11.21.1 differ from pinned CI Node 24.21.0/npm 11.19.1; CI qualifies the pinned toolchain. Global PRODUCT.md has a pre-existing legacy schema and was preserved. check:presentation exited 0 and reported two pre-existing concerns in unmodified VaultFilePicker.vue.

Latest main is integrated. PR #43 is the live qualification and merge ledger; merge requires green checks on its current head.

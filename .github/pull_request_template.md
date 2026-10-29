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
- npm run check:source: code-line limits and locale parity passed; 3181 inputs, 226 translated keys.
- npm run check:views: 93 views documented; navigation coverage valid; sitemap current.
- git diff --check: clean.
- Final npm run verify:project: running. The draft is not ready for merge until this and CI qualification finish.

## UI evidence

- npm run test:ui-quality -- --config .nq/service-design-ui.config.ts: 8 passed (46.1s), no skipped/unexpected tests. The ignored wrapper uses isolated port 4281 because another process owns 4181; assertions are unchanged. Report: reports/e2e/service-design-ui-quality.json.
- npm run ui:gallery: 40 captures, failures []; desktop light and narrow dark studio captures reviewed. This covers the existing clickdummy plus new navigation; feature-native captures are separate.
- Focused real-host Service Design spec: 1 passed, exit 0, complete create/link/configure/reload/conflict/reopen path and clean teardown.
- Five native WCAG 2.1 A/AA scans: zero violations. Wide/narrow and light/dark maps have 32px gutters, 24px editor-heading spacing and zero page/editor overflow; narrow table scrolling stays inside its region.
- Stable captures and geometry/Axe JSON: reports/service-design-review/. A fresh independent reviewer inspected all five captures and returned ship for the captured UI/product scope, with no material findings.
- The owner's layout feedback exposed a missing shared page-frame selector. Fixed the gutters, section spacing and table alignment, and added measured host regressions. Mechanical detector: [] findings.

## Obsidian evidence

- npm run test:obsidian: 24 files passed, 31 tests passed, 365.52s, exit 0. Includes lifecycle, privacy, navigation, MCP and Service Design. Reports: reports/obsidian/.
- Pinned contained host: Obsidian app/installer 1.14.4, launcher 3.2.1.
- npm run -s dev:obsidian -- --allow-download --json: status passed, errors [], hostErrorCount 0, pluginConsole [], exit 0. Read dev.log/debug-report.json and reviewed last-run.png. Its Windows shutdown reported OBSIDIAN_STOP_TIMEOUT after the successful summary; the full suite later completed cleanly.

## Review and untested scope

Independent subagents reviewed product/method coverage, UX/accessibility, data integrity, privacy/reliability and integration boundaries, then a fresh reviewer checked the corrected renders. Findings drove graph/concurrency checks, private-root reservations, focus, stable totals, indexed cells, searchable relationships, Markdown preview and service-scenario guidance.

No personal vault, credentials, live Twitch/OBS session or AI provider was used. Dedicated visual evidence covers a populated three-step map and a wide dark recovery editor; it is not an exhaustive visual state matrix. No multiple blueprints, deletion/cascades, directional arrows, AI authoring or diagram export is introduced. Local Node 24.20.0/npm 11.21.1 differ from pinned CI Node 24.21.0/npm 11.19.1; CI qualifies the pinned toolchain. Global PRODUCT.md has a pre-existing legacy schema and was preserved. check:presentation exited 0 and reported two pre-existing concerns in unmodified VaultFilePicker.vue.

Delivery remains pending final project verification, integration with latest main and green PR checks.

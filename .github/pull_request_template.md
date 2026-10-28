## Summary

CoForge previously required manually copying work between specialists. The Council adds reusable Markdown agents, project teams/councils, watched note intake, bounded messages, explicit v2 workflow composition, private execution evidence and repairable source-note publication. Validated plans can be handed to the existing request workflow while preserving its permissions, worktree isolation and final code review.

## Requirements and traceability

- PRD: DEF-01–06, COU-01–08, INB-01–07, MSG-01–07, WF-01–07, OPS-01–05.
- Owner accepted all 12 section-14 defaults; recorded in BRIEF.md.
- design/council-traceability.json records requirement families and evidence. The existing generated traceability contains no req-* or vi-* obligations.
- Independent product, security/reliability and UX reviews plus fixes are recorded in docs/project-tasks/2026-10-28-the-council-review.md.

## Commands run

- [x] npm ci: added 690 packages; audited 691; 0 vulnerabilities reported.
- [x] npm run check through npm run verify:project: 5 passed, 0 failed, 0 skipped gates in 498.1s. Typecheck, source lint, zero-warning ESLint, product tests and maker types passed.
- [x] npm run verify:project: exit 0; production candidate built; prototype embedding 1 passed, 0 failed. Generated UI-effects check explicitly skipped because this project declares no generated visual definitions.
- [x] npm run test:ui-quality: 8 passed (48.3s).
- [x] npm run ui:gallery: 40 screenshots captured and reviewed.
- [x] npm run check:source: code-line limits and locale parity passed; 2856 inputs, 226 translated keys.
- [x] npm run check:self-review -- --json: clean; no findings or approval exceptions.
- [x] git diff --check: exit 0.

## UI evidence

reports/ui-gallery/gallery.html and index.json contain the final gallery. reports/council/ contains wide/narrow, light/dark definitions, preflight, monitoring, workflow/message, publication, unknown-outcome, checkpoint and draft captures. All twelve feature scenarios passed across the combined run and affected reruns. Fresh UX review closed U1–U5 with a scope-specific ship verdict. Evidence was reviewed; no baselines were accepted or committed.

## Obsidian evidence

npm run -s dev:obsidian -- --json and the new contained native Council spec could not launch: exit 1, real-Obsidian tooling not provisioned. Nothing was downloaded. The owner explicitly requested continuing with native verification unavailable. In-memory Obsidian integration and lifecycle/event tests passed.

## Untested scope

Real Obsidian rendering/event semantics, live Claude/Herdr calls and native 10,000-note performance are unqualified. Herdr Council execution is intentionally gated when typed-session isolation cannot be enforced; no permissive fallback is used. Pre-existing Unix fake-CLI orchestration tests remain skipped on Windows. Checks ran on installed Node v24.20.0; .nvmrc requests v24.21.0. Browser simulation and mocked telemetry do not constitute live-provider qualification.

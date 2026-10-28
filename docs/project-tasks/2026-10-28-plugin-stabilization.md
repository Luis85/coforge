# Task: Stabilize CoForge views and user journeys

- Status: implementation, review and local verification complete; merge qualification tracked by the PR checks
- Journey in `BRIEF.md`: review every private, native-settings and public display view for a clear user goal and next action; preserve explicit execution, privacy and host review gates.

## Why

The Council extends an already broad studio. Streamers need a predictable place for each task, consistent page structure, and documentation that can be checked against the running plugin.

## Traceability

- Existing `design/traceability.json` has no generated req-* obligations; no new business requirement is introduced.
- Council PRD: OPS-01–03 and AC-26; BRIEF.md streaming workspace review and final improvement-pass obligations.
- User request (2026-10-28): one frontmatter/Markdown file per view, generated sitemap, complete journey review, focused pages/subpages and consistent UI seams, followed by polishing and a green merged PR.

## Acceptance

- Every supported view and task-oriented subpage is documented by a single file under `docs/components/views` with one primary goal, entry/exit paths, states, scope and source.
- A deterministic command generates the sitemap from those documents and detects stale output or incomplete route coverage.
- Views with competing tasks gain focused subpages without losing drafts or weakening execution gates.
- Shared layout, controls, spacing, empty/error states and keyboard navigation follow the existing Obsidian-compatible system.
- Independent review covers product/journeys, UI/accessibility, privacy/reliability and maintainability; concrete findings are fixed and recorded.

## Plan

1. Three parallel agents own view catalog/sitemap, journey/navigation, and shared UI consistency; root reviews integration, privacy/reliability and validation.
2. Capture representative current UI, write behavioral regressions, implement focused changes, then inspect a final wide/narrow/light/dark gallery.
3. Run independent second-pass reviews, address findings, run required gates and self-review, open a PR with actual evidence, bring CI green and merge.

## Evidence

- Initial `node bin/app status`: status ok; 0 pending acceptance obligations; dependencies missing.
- `npm ci`: added 691 packages, audited 692, 0 vulnerabilities.
- Local Node is v24.20.0; `.nvmrc` requests v24.21.0. CI uses the pinned version.
- Final authored inventory: **73** frontmatter/Markdown contracts; `npm run check:views` reports navigation coverage valid and sitemap current.
- Findings, repairs and independent polishing are recorded in the adjacent journey, UI, reliability, independent-review and product-polish reports.
- Initial full gate caught the new timer test's DOM/Node overload mismatch, direct setup-prop mutation, tests still mounting the old moderation container, and sitemap output observed during active documentation edits. All require final rerun evidence; the initial result is not a passing qualification.

### Final local qualification

- `npm run verify:project`: exit 0. Nested check: **5 passed, 0 failed, 0 skipped in 526.0s**; release candidate built; prototype embedding **1 passed, 0 failed**.
- Full browser exploration: **133 passed, 9 failed in 21.1m**. The failing cases drove real Public displays wrapping and Setup shortcut repairs, plus navigation/restyle test corrections. This initial run is not a passing final result.
- Rebuilt affected browser suite (`npm run test:e2e -- --grep 'guided OBS|live studio and scene|focused broadcast|Council authoring|streamer preparation|offline channel|(Statistics|AI costs|Schedule|Project settings|The Council): shared operating'`): **19 passed in 5.4m**, covering every prior failure and all new task subpages.
- `npm run test:ui-quality`: **8 passed in 1.7m** on the final source-backed build.
- `npm run ui:gallery`: **40 captures**, no capture failures. Representative gallery variants plus all operating-view/subpage families were reviewed; scoped UI verdict is recorded separately.
- `npm run check:source`: code-line limits and locale parity passed, 2869 inputs / 226 translated keys. `npm run check:views`: **73 views**, valid coverage, current sitemap.
- `npm run check:self-review -- --json`: clean, no findings or approval exceptions. `git diff --check`: exit 0.
- Three contained native specs now follow the focused pages; Node syntax, source limits and diff checks pass. No host download occurred. CI retains the new operating-view/subpage screenshots alongside existing browser artifacts and reruns the complete browser/native suites before merge.

### Review records

- [Journeys and page boundaries](2026-10-28-stabilization-journeys.md)
- [Shared UI and accessibility](2026-10-28-stabilization-ui.md)
- [Privacy, reliability and maintenance](2026-10-28-stabilization-reliability.md)
- [Independent release review](2026-10-28-stabilization-independent-review.md)
- [Fresh product and content polish](2026-10-28-stabilization-product-polish.md)

## Untested scope

Real Obsidian is not provisioned locally: both the dev loop and native suite exit 1 without downloading or launching anything. The PR's existing real-Obsidian CI job supplies native qualification. Live Twitch/OBS/provider sessions, production vault scale and OS screen-reader behavior remain unqualified. Six existing Unix fake-CLI tests are skipped on Windows; Linux CI exercises its platform-supported suite. Browser examples are explicitly simulated, and the generated UI-effects check declares no visual definitions rather than claiming acceptance.

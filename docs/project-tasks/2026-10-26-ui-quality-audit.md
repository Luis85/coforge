# Task: Restore passing UI quality and dependency audit checks

- Status: done
- Journey in `BRIEF.md`: operate the studio board and configure integrations accessibly.

## Why

The studio fails accessibility and keyboard checks, and native settings overflow a narrow pane.
Five audit findings remain in transitive tooling dependencies after the Dependabot updates.

## Traceability

- Requirement keys and interaction IDs: none; the imported traceability files declare no obligations.
- Existing regression coverage: `tests/e2e/ui-quality.spec.ts` and the project studio tests.
- Added collapsed-pane navigation coverage: `tests/e2e/journeys/studio-accessibility.spec.ts`.

## Acceptance

- Both surfaces pass all eight existing browser quality checks without exceptions or weaker assertions.
- Accessible button names include visible labels, search has visible keyboard focus, and settings reflow at 360px.
- An audit of every installed dependency category reports zero vulnerabilities.
- Project checks, release build, dependency policy, and contained Obsidian validation pass before merge.

## Plan

1. Use the four failing checks and audit report from main as regression evidence.
2. Correct accessible naming, theme-derived text contrast, focus styles, and settings wrapping.
3. Pin patched transitive dependencies, retaining the current lint plugin and all its rules.
4. Run the full gates; review the UI gallery and contained Obsidian evidence; merge a reviewed PR.

## Out of scope

New product behavior, a visual redesign, and changes to personal vaults.

## Evidence

- Baseline: `test:ui-quality` reported 4 failed, 4 passed on main; gallery captured 40 screenshots.
- Baseline audit: 5 findings (4 moderate, 1 high).
- `npm ci --no-fund --no-audit`: added 690 packages; exact lockfile accepted.
- `npm run verify:project`: exit 0; `Summary 5 passed, 0 failed, 0 skipped in 115.9s`; release build succeeded.
- `npm run test:ui-quality`: `8 passed (38.8s)`.
- `npm run test:e2e -- tests/e2e/journeys/studio-accessibility.spec.ts`: `1 passed (13.8s)`.
- `npm run ui:gallery`: captured 40 screenshots; no capture failures. Reviewed desktop and narrow panes in both themes.
- `npm run check:security`: `found 0 vulnerabilities`; `Security check: passed. All installed dependency categories included.`
- `npm run check:dependencies`: exact installed versions, source hashes and transform regression passed.
- `node tooling/quality/self-review.mjs --base origin/main`: no findings after registering the new browser test.
- Impeccable detector: zero findings; `git diff --check origin/main`: no output, exit 0.
- [Contained Obsidian validation](https://github.com/Luis85/coforge/actions/runs/40403126120): 4 tests passed; smoke `status: passed`, `errors: []`. Reviewed the real-host screenshot.
- `node tooling/testing/suites.mjs --check`: reports existing catalog defects (missing shell npm scripts, an absent guide and an unclassified existing helper). Confirmed these are present on main; the new journey is classified and the diff self-review passes.

Security fixes: fast-uri 3.1.9 and undici 8.12.2 satisfy their existing parent ranges.
The lint tool's `obsidian@1.12.3` pins Moment 2.29.4, so a version-scoped override selects Moment 2.31.0,
which is already used by the direct Obsidian API package. No lint rules or audit categories were removed.

## Untested scope

Local Obsidian is not provisioned; use the repository's contained CI host workflow for host evidence.
Generated UI-effect checks have no visual definitions to exercise. Other host versions, third-party themes and platforms were not qualified.

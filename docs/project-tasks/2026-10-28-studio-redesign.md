# Task: Rebuild the studio around user goals

- Status: in progress
- Journey in `BRIEF.md`: all private, native-settings and public-display journeys; the complete community-to-reviewed-increment loop.

## Why

The documented surfaces need a coherent information architecture and a stronger visual hierarchy. Streamers must distinguish channel work from project work, find the next decision, and understand what the displayed data can actually establish.

## Traceability

- Owner request: overhaul `docs/components`, redesign every documented view, review from all product perspectives, polish, open a PR, bring CI green and merge.
- `design/traceability.json` and `design/visual-traceability.json` contain no open generated requirement or interaction obligations. Existing BRIEF journeys and the 73 authored view contracts govern this work.
- Owner visual direction: more expressive studio, stronger color, larger summaries and more visual emphasis (2026-10-28).

## Acceptance

- Every existing destination remains reachable through coherent task groups. Channel-wide pages identify their actual scope; project pages retain stable project identity.
- Summary and insight data derive from current canonical services. Missing measurements, financial currencies, reported cost coverage and simulated examples remain explicit.
- Every view family receives a deliberate composition/state review, including focused dialogs, native settings and public captures. Private fields never enter public projections.
- Navigation preserves guarded drafts and never starts external effects. Review, confirmation and uncertain-outcome recovery remain explicit.
- Both themes and narrow Obsidian leaves retain readable, operable content and keyboard focus.
- Cleanup previews removable sample/simulator content and related history, preserves manual/Twitch requests even with simulated AI, and keeps ambiguous legacy requests by default. Temporary example surfaces can be exited explicitly.

## Plan

1. Capture incumbent views; record the architecture and visual direction.
2. Add failing assertions for changed navigation, real-data summaries and decision shortcuts.
3. Implement shared contracts and visual foundations, then each view family in parallel.
4. Run product, browser, catalog, artifact and provisioned-host checks.
5. Independently review product/data, UX/accessibility and privacy/reliability/maintenance, then repair concrete findings.
6. Publish the reviewed PR, resolve CI findings, and merge after required checks pass.

## Evidence

- `node bin/app status`: status ok; zero pending acceptance obligations; dependencies initially missing.
- `npm ci`: 691 packages added, 692 audited, zero vulnerabilities.
- Baseline captures: `reports/stabilization/operating-views/` (generated during this task; not baselines).
- `npm run verify:project`: exit 0; check summary **5 passed, 0 failed, 0 skipped in 628.2s**, production build complete, prototype embedding **1 passed, 0 failed**. Later cost-cleanup additions receive targeted checks and the exact-commit CI gate.
- Initial `npm run test:e2e`: **140 passed, 4 failed (24.4m)**. Found community summary overflow, two obsolete navigation/settings-copy assertions and one cumulative capture timeout. Repaired the overflow and contract assertions; split the long capture into two cases without removing checks or increasing timeouts.
- Affected browser pass including new temporary-example tests: **45 passed, 2 failed (7.0m)**. All four original failures are resolved. New cleanup tests exposed missing origin markers in the browser seed; fixed the harness fixture before the final cleanup rerun.
- `npm run check:source`: code-line limits and locale parity passed, 2902 inputs / 226 translated keys. `npm run check:views`: **74 views documented; navigation coverage valid; sitemap current**.
- `npm run check:self-review -- --json`: clean, no violations or approval exceptions. `git diff --check`: exit 0.
- Impeccable detector: exit 0; one verified false positive on the unchanged, unrounded chart-legend line in `statistics.css`. No suppression or weakened rule.
- `npm run -s dev:obsidian -- --json` and `npm run test:obsidian -- coforge-example-cleanup`: exit 1, pinned native tooling is not provisioned. Nothing downloaded or launched. The existing real-Obsidian CI job will qualify the contained host.

## Review and improvement pass

The original 73 surfaces and new cleanup panel have explicit coverage. Findings and repairs are recorded in:

- [Architecture and all-view product/data review](2026-10-28-studio-product-review.md).
- [Build view redesign](2026-10-28-build-view-redesign.md).
- [Stream, analytics, native and public review](2026-10-28-stream-design-review.md).
- [Channel views and visual foundations](2026-10-28-channel-view-redesign.md).
- [Independent engineering review](2026-10-28-studio-engineering-review.md).
- [Independent visual review](2026-10-28-studio-visual-review.md).
- [Cleanup behavior and test-first evidence](2026-10-28-example-cleanup.md).

The pass corrected misleading scope/provider/backup labels, incompatible retained filters, optional-capability promises, card gutter overlap, icon grid placement, late workflow decisions, narrow community overflow, public website contrast and timed refresh. Cleanup added trusted provenance, exact-note receipts, durable interruption recovery, postcommit trash warnings, replay protection and native admission guards.

## Untested scope

Live Twitch/OBS/Claude/Herdr sessions and personal vaults are outside local verification. Only contained fixtures and explicitly simulated examples are used.

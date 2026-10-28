# Task: Reusable agents and recoverable council sessions

- Status: done; native/live-provider qualification remains unavailable as recorded below
- Journey in `BRIEF.md`: The Council owner decisions, 2026-10-28

## Why

Let the operator submit a Markdown note to reusable specialists, collect independent
opinions and solution proposals, and recover committed results without duplicate calls.

## Traceability

The supplied PRD uses DEF-01–06, COU-01–08, INB-01–07, MSG-01–07,
WF-01–07 and OPS-01–05, with AC-01–26 release gates. The existing generated
`design/traceability.json` contains no requirements; new acceptance evidence is
tracked separately until the product design compiler supports these definitions.

## Acceptance

Use the supplied PRD's 26 scenarios. Preserve all v1 behavior. A three-member
council retains six attributed contributions; opinions share one snapshot and solutions
see the complete opinion collection. Publication repair never repeats a model call.
Definitions, submissions, messages, permissions and historical evidence remain private.

## Plan

1. Characterize v1 input selection, history, checkpoints and final review.
2. Add typed subjects, explicit bindings, durable execution and publication primitives.
3. Add Markdown definitions, protocol compilation, shared intake and bounded messaging.
4. Integrate providers, runtime, editors, monitoring and lifecycle through existing facades.
5. Run failure/recovery, UI and contained host checks, self-review and release gates.

## Evidence

- `node bin/app status`: status ok; dependencies missing; 0 existing acceptance obligations.
- `npm ci`: added 690 packages; audited 691; found 0 vulnerabilities.
- Initial `npm run check`: typecheck, source lint, product tests and maker types
  passed; ESLint found two issues during concurrent implementation, subsequently fixed.
- Council vault composition: three-member, six-contribution simulation passed;
  every solution binds all opinions; the original source stays byte-exact.
- V1 handoff: two tests passed, including stale-target rejection and final code-review state.
- 10,000-note / 500-inbox indexed-routing test passed; simulated arrival admission
  respects the stability window and performs no steady-state vault rescan.
- `npm run test:ui-quality`: 8 passed (1.7m).
- Council browser journeys: 3 passed, including complete three-agent UI setup;
  light/dark and 1280/360 screenshots, zero axe WCAG findings and no horizontal overflow.
- `npm run ui:gallery`: captured 40 screenshots; reviewed under `reports/ui-gallery/`.
- Impeccable mechanical detector over Council surfaces and CSS: `[]`, exit 0.
- Final `npm run verify:project`: exit 0. Nested `npm run check`: **5 passed,
  0 failed, 0 skipped** gates in 498.1s; production build completed; prototype
  embedding test: **1 passed, 0 failed**. Generated UI-effects check explicitly
  skipped because this project declares no generated visual definitions; authored
  Council interactions have separate product/browser tests.
- Final `npm run test:ui-quality`: **8 passed (48.3s)**.
- Final `npm run ui:gallery`: **40 screenshots captured**; representative current
  wide/light studio and narrow/dark settings reviewed, alongside Council captures.
- `npm run check:source`: **code-line limits and locale parity passed**, 2856 inputs,
  226 translated keys.
- `npm run check:self-review -- --json`: **clean**, no findings or approval exceptions.
- `git diff --check`: exit 0.

## Independent review and polishing

The owner explicitly requested a thorough review from all product perspectives,
followed by an improvement/polishing pass. Fresh product coverage, UX/accessibility,
security/privacy, reliability, performance and maintainability reviews completed.
All material findings were repaired and regression-checked; independent verdicts
closed product P1–P8, security S1–S9 and UX U1–U5. The UX verdict is scope-specific
ship. Details and qualification limits are in `2026-10-28-the-council-review.md`.

## Untested scope

Native Obsidian tooling is not provisioned: both the dev-loop and new native spec
attempt exited 1 without downloading or launching anything. The owner explicitly
requested continuing with native verification unavailable. Live Claude/Herdr calls
were not made; deterministic and mocked transport evidence is not live-provider
qualification. Checks currently use installed Node v24.20.0; `.nvmrc` requests v24.21.0.

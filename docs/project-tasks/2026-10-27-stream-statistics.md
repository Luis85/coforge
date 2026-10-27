# Task: Inspect and compare recorded streams

- Status: implemented; final verification and merge evidence in the pull request
- Journey: select a stream, inspect its metrics over time and compare earlier sessions.
- Traceability: owner request and BRIEF; no generated req-/vi-* declarations exist.

## Acceptance

- Dedicated Statistics navigation and a link from Stream studio's history panel.
- Select a stream and a recorded audience/growth, engagement/community or OBS health metric.
- Overlay up to three earlier completed sessions from the same channel, aligned by elapsed minutes.
- Clear dates/titles, units, source coverage and comparison summaries; zero differs from unavailable.
- Never draw through missing samples/gaps or extrapolate shorter streams. Exact samples remain accessible
  in a paginated table and keyboard/pointer chart inspector. Bound rendering for large histories.
- Read-only history access preserves JSON bytes. Loading/error/empty/refresh/live-update states and stale
  asynchronous reads cannot mix sessions. No new permissions or chart dependency.
- Accessible light/dark desktop/narrow UI, contained Obsidian evidence, full checks and self-review before merge.

## Implementation

Extend the existing CoForge contracts/view rather than applying the maker preview's unrelated new note aggregate.
Write failing projection/geometry tests first; add guarded history reads and the statistics UI; verify and polish
in bounded screenshot batches. Retain the incumbent Obsidian-token design language.

## Review and evidence

Owner confirmed audience/growth as the leading metric group. Pure projection, chart reduction and UI tests cover
zero/null distinction, gaps, growth baselines, final intervals, empty recordings, comparison eligibility, bounded
rendering, exact inspection and a delayed read that must not replace a newer selection. Native test compares
real contained-vault histories and checks their exact bytes before/after reading.

- `npm run check:fast`: 5 passed, 0 failed, 0 skipped (557.3s).
- `npm run verify:project`: 5 passed, 0 failed, 0 skipped (467.7s); 1278 modules built (5.96s).
- Projection/geometry: 2 files, 7 tests passed (1.30s). Focused UI stale-read test: 1 passed (28.55s).
- `npm run test:e2e`: 31 passed (3.6m), including two new theme/360px statistics journeys.
- Bounded visual review caught missing optional theme colours and keyboard-inaccessible scroll regions;
  fallbacks, visible focus and assertions for every plotted stroke address both issues.
- Manual Impeccable scan ran once: one heuristic warning on `.cf-series-mark`'s 3px top border. This is an
  intentional line/dash legend swatch, without rounded-card styling; no suppression or threshold change.
- `git diff --check`: clean. Generated traceability has no req-/vi-* declarations to update.

UI-quality/gallery and final contained Obsidian CI results are recorded in the PR. Local host evidence is
reported as unavailable if the launcher is not provisioned; no agent download or personal vault is permitted.

## Summary

Kanban cards now show a separate saved Improve & polish state alongside their main workflow hint. Queued, running, finalizing, stopping, disconnected, attention and human-review states survive reload; Apply/Discard clears the settled indicator. Auxiliary jobs no longer replace the primary card status. Native ownership recovery uses the shared settlement policy before a card can claim stopped or ready for review.

Inbox's Add control and wrapped column text previously offset its first card. Shared content-sized rows align every column, and bounded inner tracks keep cards and footer controls within their own columns. Native board button and avatar contrast defects found during qualification are also corrected with existing theme tokens.

Engine-backed tests verify that polishing uses the existing scheduler, runners, background coordinator and AI Costs service. Concurrent confirmations and repeated reconciliation produce one admission/result/cost row. Genuine failure charges and usage remain recorded; unavailable provider USD stays unavailable.

## Requirements and traceability

Owner requests are recorded in BRIEF.md and docs/project-tasks/2026-11-01-polishing-card-feedback.md. The accepted scaffold has no req-* or vi-* entries for this increment; no identifiers were invented. Three subagents implemented, exercised and independently reviewed the change. Main PR62 (077c1a4) was integrated before final compatibility qualification.

## Validation

- Full local verify:project on the implementation source before PR62 integration: five gates passed in 1848.1s; 1898 product tests passed, six existing Windows skips, zero failures. Production build and prototype embedding passed.
- Focused card/Design product tests: three files / 16 passed. Shared execution/cost lifecycle: four files / 14 passed.
- After main integration: 14 compatibility files / 44 passed. Native ownership regression red: two failed / five passed; guard green: seven files / 28 passed; final helper: seven passed. Merged typecheck and scoped ESLint pass with zero warnings.
- Final browser presentation: two passed (1.1m), light 360px / dark 1440px. Checks cover all states, full-board Axe, reduced motion, 150% zoom, wrapped text, <=1px column alignment, card/column bounds, footer control containment, unchanged main checkpoint/bucket and zero provider calls.
- test:ui-quality: eight passed (49.4s). ui:gallery: 40 captures, zero failures; representative gallery and targeted browser/native board captures reviewed. Evidence: reports/polishing-card-feedback/, reports/ui-gallery/ and reports/obsidian/cases/.
- Pinned contained Obsidian 1.14.4 smoke: passed, errors: [], pluginConsole: []. Final card native spec passed; after main integration it passed again (one file / one test, 21.01s). Native checks include both themes, every state, zoom, geometry and Axe.
- Source lint: 2094 files passed. Mechanical design detector: []. No dependencies, audit thresholds, platform skips, assertions or image baselines were weakened or changed.

The exact PR head must pass full verify:project, browser/native E2E and isolated workflow verification before merge. Final CI results are recorded in this PR's checks and description.

## Evidence and limits

The initial native run exposed contrast defects, and visual review exposed a 48.7px card overflow; both received production fixes and stronger assertions. No paid vendor call, live user workflow mutation, worker restart or live plugin reload was performed. Cost telemetry was supplied through controlled provider ports. Multi-day paid execution and manual screen-reader use were not exercised. Local Node/npm are 24.20.0/11.21.1; CI uses repository pins 24.21.0/11.19.1.

## Summary

Council intake now selects a Council directly and shows the participating CoWorkers,
providers and discussion rounds. Visible workspace tabs replace the advanced-tools
disclosure; setup guidance and project activity make configuration and progress easier
to follow.

Workflow settings adds Ask Council. It admits one child task, waits for complete
published answers and supplies attributed Markdown to later steps. Confirmed children
survive reload; uncertain admission, stale answers and cancellation retain recovery
boundaries without automatic replay.

## Requirements and traceability

- Owner requests dated 2026-10-29 in BRIEF.md: Council usability and Ask Council workflow action.
- Review, acceptance and evidence: docs/project-tasks/2026-10-29-council-experience.md.
- No imported req-* or vi-* obligation applies; generated traceability is unchanged.
- Canonical Markdown, stable IDs, explicit review, executor designation, finite limits,
  private evidence and final human code review remain authoritative.

## Validation

- Focused experience/editor/execution/integration suite: 4 files, 13 tests passed.
- Final admission and workflow safety suite: 2 files, 9 tests passed.
- Typecheck and focused zero-warning ESLint passed.
- Initial npm run verify:project: typecheck, source lint, ESLint and maker types passed;
  the product test process hit the wrapper's 600-second timeout. No passing full-gate
  claim is made from that attempt.
- npm run check -- --timeout 1200000: 4 gates passed, 1 failed. The full suite reported
  279 files passed / 1 failed; 995 tests passed / 1 timed out / 6 pre-existing skips.
  The unchanged 10,000-note intake scale test exceeded its 60-second test budget.
- Unmodified scale-test recheck: 1 passed in 45.35s, with the same assertions and
  timeout. No repository test limits or checks were weakened. A clean full-gate run
  is still required before merge; the isolated pass does not turn the failed gate green.
- Final recovery stability recheck: 8 passed, including unchanged run revisions when
  checking the same held result repeatedly.
- npm run verify:artifacts: passed build and prototype embedding (1 passed). Generated
  UI-effect checks report the expected skip because no visual definitions are declared.
- check:views: 92 views documented, navigation coverage valid, sitemap current.
- git diff --check: clean.

## UI evidence

- npm run test:ui-quality: 8 passed (both themes, 360px reflow and keyboard focus).
- Council intake and board-assessment journeys: 4 passed; corrected prompt-order
  navigation journey rerun: 2 passed. Both themes and wide/narrow leaves were captured.
- npm run ui:gallery: 40 captures, no failures. Reviewed the studio narrow capture and
  Council-specific intake/history, setup and native workflow captures.
- reports/council-review/: numbered before/after screenshots and command logs.
- reports/council-ask/, reports/council-prompt-order/, reports/ui-gallery/: ignored QA evidence.
- Design detector identified one existing thick accent border; reduced it to 1px.

## Obsidian evidence

- Latest pinned smoke: status passed, plugin errors []; Obsidian 1.14.4 and launcher
  3.2.1 in the contained sandbox. The reused sandbox reports two Obsidian-core
  command-list callback errors (null parent/getContainer), also seen in the initial
  smoke. An earlier clean smoke reported hostErrorCount 0. The native journey has no errors.
- npm run test:obsidian -- coforge-council-ask: 1 passed. Saves and reviews a question,
  runs an explicit mixed-order simulation, retains history through reload, checks cost
  attribution, then saves an Ask Council workflow step with visible recipients and no
  new run during setup.
- reports/obsidian/ and .obsidian-sandbox/logs/ contain ignored evidence.

## Untested scope

No billable provider call or personal vault was used. Workflow answers use the existing
16000-character Markdown contract; larger reports stay complete in the child run and
hold the parent. Full assistive-technology certification is outside this review.
Local Node 24.20.0 / npm 11.21.1 differ from pinned Node 24.21.0 / npm 11.19.1.
No release, publication or pull request was requested.

## Summary

Native Obsidian button styling centered each step’s number and text independently, producing the large ragged indent shown in the owner’s screenshot. The outline now uses a scoped number/text grid, compact bucket grouping and responsive role/count context. Selected actions fit on one line, and the outline measures the actual space above the settings save bar so its tools stay reachable.

The saved workflow, step identities, explicit save/recovery boundaries and execution rules retain their existing behavior.

## Requirements and traceability

Owner screenshot/follow-up on 2026-10-31. No req-* or vi-* entries exist in the scaffold; no IDs were invented. Plan and evidence: docs/project-tasks/2026-10-31-workflow-outline-polish.md.

## Validation

- npm run verify:project: 5 passed, 0 failed, 0 skipped in 1221.8s. Product report: 1,580 passed, zero failures/TODOs and six existing platform skips. Release build and embedding passed; UI effects explicitly skip without visual definitions.
- After final viewport/footer adjustments: typecheck and targeted ESLint passed with zero diagnostics/warnings; 7 focused editor/layout product tests passed, including the new resize/disposal case.
- Final Playwright bucket/long-list regressions: 7 passed (1.7m), with actual number/title position assertions and keyboard/focus checks.
- npm run test:ui-quality: 8 passed (1.1m). npm run ui:gallery: 40 captures, failures []. Native light/dark and wide/narrow panel captures plus gallery reviewed; no screenshot baselines accepted.
- npm run test:obsidian -- coforge-workflow-outline: 1 passed (18.05s), covering eight steps in four theme/size combinations. Asserts row alignment/density, normal bucket labels, one-line actions, footer clearance, accessible keyboard return and zero Axe A/AA findings. Electron uses the established in-page Axe mode; no rules are suppressed.
- npm run -s dev:obsidian -- --json: passed on pinned Obsidian 1.14.4 after reload; errors [], hostErrorCount 0, pluginConsole [].
- Impeccable detector: []. Token audit passed (968 observed / 133 reviewed). Diff, architecture, line-limit, draft and privacy self-review passed.

The native alignment test failed before the fix. Native review also caught a wrapped toolbar and a footer measurement binding before the footer mounted; both were repaired and the original assertions retained. The complete GitHub gate will include the newly added product/native cases.

## Evidence and limits

Ignored evidence: reports/workflow-buckets/outline-*, reports/workflow-outline/, reports/ui-gallery/, reports/obsidian/ and .obsidian-sandbox/logs/. The e2e label qualifies the full browser and native suites before merge.

No billable model call, personal vault or live external service mutation. Local Node/npm are 24.20.0/11.21.1; CI uses the repository pins. The durable-build session uses its independent worktree/sandboxes; the shared plugin install stays on the prior merged version until this polish qualifies.

Initial Linux native qualification passed 52/53 cases and caught a wrapped output label exceeding the existing row-density limit. Scoped row typography/border resets now retain that limit across font metrics; the 68px bound and all alignment/overflow/Axe assertions are unchanged. The fresh local native matrix passed (17.74s). Final-head CI requalifies the complete suites.

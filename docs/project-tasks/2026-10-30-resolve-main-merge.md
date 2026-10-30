# Task: Resolve the local merge with main

- Status: done; conflicts resolved and applicable project gates passed.
- Journey in BRIEF.md: use CoForge's Idea board to develop this plugin.
- Traceability: no req-* or vi-* obligations are declared for merge reconciliation.

## Acceptance

Resolve the 38 unmerged paths between local `e804756` and incoming `e2370b2`.
Retain the released individual project-feature controls, music retirement and
focused OBS/Show plan surfaces. Preserve independent local changes. The resulting
tree must have no unmerged entries or conflict markers and pass applicable gates.

## Resolution

The local commit includes preliminary versions of work subsequently qualified
and merged upstream. Conflicted implementations, tests and their documentation
use those later released versions. Retired audio UI and its view documentation
stay deleted. Local ignore rules, public export changes, historical-operation
logging adjustment and the additional Broadcast/Show plan ordering assertion stay.
Both index stages and conflicted working files were backed up under the ignored
`reports/merge-resolution-2026-10-30/` directory before resolution.

## Plan and evidence

1. Inspect both merge sides and preserve independent changes: complete.
2. Resolve and stage the 38 paths: complete; `git ls-files -u` is empty.
3. Typecheck: exit 0. `git diff --cached --check`: exit 0.
4. `npm run test:ui-quality`: 8 passed (57.8s). `npm run ui:gallery`:
   40 captures, no failures; wide dark and narrow light studio captures reviewed.
5. `npm run -s dev:obsidian -- --json`: passed, errors [], hostErrorCount 0,
   pluginConsole []. Screenshot reviewed. Focused `npm run test:obsidian --
   coforge-project-features coforge-show-plan coforge-obs-music`: 3 files / 3 tests
   passed (39.83s), including canonical-note persistence and reload without replay.
6. Self-review found the imported optional-feature fixture missing from the suite
   manifest. Registered it in the existing helper list; `npm run check:self-review`
   now reports no findings. No runtime behavior or test assertions changed.
7. `npm run verify:project -- --timeout 1800000`: exit 0. Check summary:
   5 passed, 0 failed, 0 skipped in 882.2s. Product tests: 360 files, 1,410
   passing tests, 0 failures, 6 existing skipped tests. Build and embedding
   passed (1 test). UI effects skipped because no visual definitions exist.
   npm did not forward the outer timeout option to check; the standard process
   budgets completed successfully, without changes to any test limits.
8. Local merge completion follows this qualified source tree; no push requested.

The optional full suite-inventory check exits 1 and reports existing missing shell scripts,
documentation and older unclassified helpers in this generated project. The new
helper classification is fixed; unrelated framework inventory is outside scope.

No new product behavior or dependency changes are introduced by this resolution.
No live Twitch/OBS mutations or billable AI calls are part of validation.

## Summary

The Idea board had hardcoded buckets while Agent workflow edited a separate flat
step list. Projects can now configure the ordered board buckets and the AI/human
steps inside each bucket in one editor. The shared detail panel aligns left, and
the board pipeline shows the saved buckets as its main process.

- Add, rename, describe and reorder intermediate buckets with their complete step
  segments; remove them once empty. Inbox and Accepted retain lifecycle roles.
- Add all existing step kinds and presets contextually, move steps between
  buckets, and retain stable identities, prompts, providers, dependencies and
  explicit Save/Discard, conflict, copy/import/export and recovery boundaries.
- Capture grouped definitions for future runs. Legacy definitions retain their
  exact execution sequence and acquire grouping only after explicit Save.
- Keep historical buckets discoverable and Design ready until Build starts,
  including through manual checkpoints. Bucket position never grants screening,
  public visibility or acceptance. Public viewer/capture columns remain unchanged.
- Provide actionable validation, keyboard reorder/focus restoration, accessible
  descriptions, long-label wrapping and stacked narrow-pane layouts.

## Requirements and traceability

Owner request recorded in BRIEF.md on 2026-10-31. The traceability scaffold has no
declared req-* or vi-* obligations for this feature; no IDs were invented.

Research, findings, specification, test-first plan and evidence:
`docs/project-tasks/2026-10-31-bucket-workflows.md`.

Three research agents reported before the spec and implementation. Three agents
then implemented the domain/persistence, editor and board increments, with
independent product/reliability reviews and a final integration/polishing pass.

## Validation

- `npm run verify:project`: passed. Check summary: **5 passed, 0 failed, 0 skipped
  in 1203.0s**. Product tests: **1,580 passed, zero failed, six existing platform
  skips, zero TODOs**. Release build passed; prototype embedding **1 passed**.
  UI effects explicitly skip because no visual definitions are declared.
- Focused Playwright bucket/editor/long-list/template journeys: **14 passed
  (3.6m)**, including light/dark, 360px reflow, computed left alignment, keyboard
  focus, long authored labels, explicit saving and no automatic acceptance.
- `npm run test:ui-quality`: **8 passed (1.4m)**. `npm run ui:gallery -- --json`:
  **40 captures, failures []**. Wide/light and narrow/dark editor screenshots and
  representative gallery captures reviewed. No screenshot baselines accepted.
- `npm run test:obsidian`: **51/52 passed**. Its sole failure was the new test
  looking for the board-only pipeline while still on settings. Corrected the
  assertion's navigation order; fresh `npm run test:obsidian --
  coforge-workflow-buckets`: **1/1 passed (23.11s)**. It proves bucket save/reload,
  pipeline labels, captured run/history placement, preserved body bytes,
  Design-ready behavior and mandatory Build review. Existing 51 cases passed.
- `npm run -s dev:obsidian -- --json`: **passed** after reload on pinned Obsidian
  **1.14.4**, `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`.
- View catalog: **110 views; navigation coverage valid; sitemap current**.
  Token check: passed (**968 observed / 133 reviewed**). Impeccable detector:
  **[]**. Self-review and `git diff --check` passed.

Initial TDD cases failed on missing bucket behavior. Qualification repaired
accessible-name markup without relaxing Axe checks. An intermediate parallel
browser run hit a shared trace-directory collision; separated final outputs
passed. The earlier shared-checkout check was interrupted when unrelated work
started there; the complete gate above ran in an isolated feature worktree.

## Evidence and limits

Ignored local evidence: `reports/workflow-buckets/`, `reports/ui-gallery/`,
`reports/obsidian/` and `.obsidian-sandbox/logs/`. GitHub qualification uses the
`e2e` label for the full browser and real-host jobs; merge requires every check
to finish green on the final head.

No billable vendor calls, live OBS/Twitch mutations, personal-vault launch,
mobile qualification or alternate Obsidian version. Local Node/npm:
**24.20.0 / 11.21.1**; CI uses repository pins **24.21.0 / 11.19.1**. Exact `npm ci`
preserved the lockfile and reported its existing 27 moderate advisories; this
change adds no dependencies or audit exceptions.

Concurrent durable-build changes in the original checkout were preserved and
excluded, including their shared BRIEF/schema edits. This PR contains only the
bucket workflow increment. Public bucket customization and durable background
Build execution remain outside this change.

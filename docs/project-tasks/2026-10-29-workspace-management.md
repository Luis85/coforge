# Task: Simplify project work and manage CoWorkers directly

- Status: implemented and locally verified; CI qualification and delivery tracked in the PR
- Journey: owner workspace, Council, multi-project

## Why

Repeated board summaries take space from the work. Reusable CoWorkers need their
own inventory, and navigation and documentation should explain the actual tasks.

## Traceability

Owner requests recorded in BRIEF.md on 2026-10-29. The imported traceability
catalogue has no requirement or interaction obligations for these corrections.

## Acceptance

- Board has no decision-summary section; review and moderation tabs still work.
- Main navigation says Build & Improve, with independently collapsible groups.
  CoForge localStorage restores their state; unavailable/corrupt storage does not
  prevent navigation. Toggle controls remain keyboard accessible in narrow panes.
- CoWorkers has a dedicated Build & Improve page with searchable inventory and
  create/edit/manage actions. Canonical definition IDs, memberships, revisions and
  enforced CoForge MCP tool access are preserved. Failed saves retain drafts.
- Ask the Council can select vault files and append a wikilink list to its input
  without losing text or automatically submitting work.
- View docs describe actual ownership and entry points; sitemap and source
  coverage are current, with no invented routes or missing parent references.

## Plan

Write focused behavior regressions, implement through existing stores and
application contracts, review both themes and narrow panes, verify in contained
Obsidian, self-review, then complete the existing green-merge/local-install flow.

## Evidence

Delivery and full qualification: [PR #34](https://github.com/Luis85/coforge/pull/34).

Board removal, group persistence, clickable parents/ownership and deferred initial
refresh all reproduced failing regressions before their fixes. Core editor and
catalogue checks: 19 passed; group persistence: 5 passed; final readiness and file
picker checks: 4 passed. Layout, question intake and UI quality: 14 passed. The
CoWorker light/dark fixtures were rechecked after restoring theme across reload.

The pinned Windows host verified canonical edits after note rename, metadata/body
preservation, explicit simulation and history after reload, navigation persistence,
card actions and lifecycle. A fresh sandbox smoke opened successfully with errors
[] and hostErrorCount 0. Final native and full canonical results are recorded in
the PR before merge. No live model requests are part of UI verification.

The final qualified local verify:project exited 0: 5 check steps passed, 0 failed,
0 skipped, plus artifact build and prototype embedding. Full native CI passed
29 tests. The remaining browser assertion was updated to recognize the new first
group collapse control while retaining keyboard/short-pane accessibility coverage.

# Task: Define project services with canonical Service Blueprints

- Status: implementation and independent review complete; delivery ledger in PR #43
- Journey in BRIEF.md: Service Design (owner decisions, 2026-10-29)

## Acceptance

- A project can create one blueprint, ordered journey steps, all five blueprint
  layers, actors/roles, touchpoints/channels, systems, pain points and opportunities.
- The main-navigation editor displays the blueprint grid and supports linked entity
  creation/editing. Switching projects retains separate drafts and data.
- Each entity is a Markdown note with stable identity, project/blueprint ownership,
  typed frontmatter, wikilinks and authored Markdown.
- A configurable vault root affects new notes; old roots remain searchable.
- Failed/stale writes preserve notes and editor drafts. Metadata edits preserve
  unrelated properties and exact body bytes. Invalid cross-project links do not write.

## Plan

1. Add failing behavioral service and vault-adapter tests.
2. Implement a framework-free service and canonical vault repository.
3. Add the navigation destination, per-view store, composable and blueprint UI.
4. Run required checks, UI gallery, contained Obsidian and self-review.

## Traceability

The imported design has no requirements or interaction entries. This task records
the owner-approved incremental acceptance; tests live in the product test suite.

## Evidence

- `node bin/app status`: ok; dependencies initially missing, no pending obligations.
- Feature maker preview/apply: bare feature README only; no conflicts. Apply kept
  source, but checks encountered incomplete dependencies during `npm ci`; rerun required.
- `npm ci`: 691 packages added, 692 audited, zero vulnerabilities.
- Domain/vault 17 tests, UI 4 tests and integration/startup/public-policy 26 tests
  passed. After merging main, the five focused feature/regression files passed
  all 40 tests in one run.
- `npm run test:obsidian`: 24 files and 31 tests passed, including lifecycle and
  the Service Design create/link/configure/reload/conflict journey.
- Five native accessibility scans found zero violations. A fresh reviewer inspected
  the corrected wide/narrow light/dark maps and recovery editor, returning ship
  for that captured scope. User-reported spacing is covered by measured 32px
  gutters, 24px editor header gap and zero page/editor overflow.
- UI quality: 8 passed (46.1s), using an isolated local port. UI gallery: 40 captures,
  failures empty; desktop light and narrow dark baseline screenshots reviewed.
- Merged-main typecheck, code-line/locale checks and production artifact build
  passed. Prototype embedding: 1 passed. View catalogue: 102 views, sitemap current.
- Local full `verify:project` passed four gates; its product-test process reached
  the 600-second deadline. Isolated Herdr worktree tests passed afterward.
- Pinned CI `verify:project` then passed all five gates (0 failed, 0 skipped,
  252.9s), built the plugin and passed embedding. Pinned native CI passed 25 files
  and 32 tests in 208.66s, plus the smoke loop.
- Browser qualification found 14px of short-pane navigation overflow. Recovered
  16px from compact-only outer padding and retained all control sizes. The
  navigation/focus/workspace/view-intent regression batch passed 33/33; light/dark
  740px panes now have zero overflow. Reviewed their screenshots and 460px scrolling.
- Independent storage, product/UX, integration and final visual reviews completed;
  all material findings were implemented and tested. Canonical qualification and
  delivery are tracked in [PR #43](https://github.com/Luis85/coforge/pull/43).

## Untested scope

No personal vault or live integration was used. Local Node/npm differ from the
pinned CI toolchain, which passed the canonical gate. Local full product execution
remains limited by the process timeout; final-head checks and merge are recorded
in the linked PR. Visual
evidence covers a populated three-step map and wide recovery editor, not every
possible authored-content state. See the improvement plan for excluded features.

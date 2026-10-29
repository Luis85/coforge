# Task: Define project services with canonical Service Blueprints

- Status: implemented; CI qualification in progress
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
- Independent storage, product/UX, integration and final visual reviews completed;
  all material findings were implemented and tested. Canonical qualification and
  delivery are tracked in [PR #43](https://github.com/Luis85/coforge/pull/43).

## Untested scope

No personal vault or live integration was used. Local Node/npm differ from the
pinned CI toolchain. Full local product qualification remains limited by the
process timeout; the PR must pass the pinned canonical gate before merge. Visual
evidence covers a populated three-step map and wide recovery editor, not every
possible authored-content state. See the improvement plan for excluded features.

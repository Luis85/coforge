# Task: Define project services with canonical Service Blueprints

- Status: in progress
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

## Untested scope

Implementation and verification in progress.

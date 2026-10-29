## Summary

Project settings now lives at the bottom of main navigation and owns Agent workflow, including Workflow runs, Herdr workspaces and Workflow settings. Settings is organized into General, Requests, Repository, Agent workflow, Runtime and Data & examples, with readable fields, responsive local navigation and explicit save boundaries.

Project drafts survive local settings navigation. Unsaved workflow edits block leaving their editor, validation checks the complete project draft, and errors retain edits with recovery guidance. Sample replacement remains an explicit confirmation; private backups are labelled as covering all projects. Navigation neither saves nor dispatches work.

Runtime links directly to Repository and Herdr workspaces. Workflow authoring puts the event-trigger action with its heading; request controls share the form width. Captured request-field saves now reflect the existing busy guard, preserving edits until the studio is idle instead of accepting a click that the handler ignores.

## Requirements and traceability

- Owner request dated 2026-10-29 in BRIEF.md; task: docs/project-tasks/2026-10-29-project-settings.md.
- No imported req-* or vi-* obligation applies; generated traceability is unchanged.
- View catalogue now checks all six settings subpages and nested workflow ownership. Regenerated sitemap includes the owner metadata already present on main.
- Dedicated implementation, navigation/testing, product/privacy/reliability and independent visual-review agents contributed.

## Validation

- TDD reproduced old sidebar/group ownership and missing subpages: 5 failing navigation assertions before implementation.
- Focused navigation: 4 files / 13 tests passed. Final settings/request regressions: 3 files / 11 tests passed. Catalogue: 9 tests passed. Busy-save and Runtime-link regressions failed before their fixes.
- Project typecheck, source lint and focused ESLint passed; git diff --check passed.
- npm run docs:views and npm run check:views: 91 view contracts valid, sitemap current.
- npm run ui:gallery: 40 screenshots captured, no capture failures.
- npm run test:ui-quality: 8 passed. Dedicated final settings/layout/error-flow browser checks: 4 passed, both themes and pane widths, no Axe violations.
- Latest native smoke: status passed; plugin loaded/enabled; view opened; errors []; hostErrorCount 0. Focused native navigation/privacy/cleanup: 4 passed; request-object save: 1 passed after the busy-guard fix.
- The final aggregate verify:project, browser and real-Obsidian results, including local Windows teardown limitations, are recorded in [PR #35](https://github.com/Luis85/coforge/pull/35). Merge requires green CI for the final revision.

## UI evidence

- reports/project-settings/: 30 final captures of six categories, nested workflow authoring and invalid-draft recovery in light/dark themes at wide/narrow pane widths.
- reports/ui-gallery/index.json and gallery.html: standard 40-capture review gallery.
- reports/navigation-space/: bottom navigation and short-pane evidence.
- Independent visual/product review and the requested second UI/UX/documentation pass both concluded SHIP. Component documents, action labels, scopes and generated sitemap match the final source. No screenshot baselines or thresholds changed.

## Untested scope

No live provider/model calls or external-service mutations were invoked. Canonical storage schemas and write services are unchanged. Merge is gated on final green CI, including opt-in browser and real-Obsidian jobs; the local repository plugin build will be updated after merge.

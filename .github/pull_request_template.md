## Summary

Project settings now lives at the bottom of main navigation and owns Agent workflow, including Workflow runs, Herdr workspaces and Workflow settings. Settings is organized into General, Requests, Repository, Agent workflow, Runtime and Data & examples, with readable fields, responsive local navigation and explicit save boundaries.

Project drafts survive local settings navigation. Unsaved workflow edits block leaving their editor, validation checks the complete project draft, and errors retain edits with recovery guidance. Sample replacement remains an explicit confirmation; private backups are labelled as covering all projects. Navigation neither saves nor dispatches work.

## Requirements and traceability

- Owner request dated 2026-10-29 in BRIEF.md; task: docs/project-tasks/2026-10-29-project-settings.md.
- No imported req-* or vi-* obligation applies; generated traceability is unchanged.
- View catalogue now checks all six settings subpages and nested workflow ownership. Regenerated sitemap includes the owner metadata already present on main.
- Dedicated implementation, navigation/testing, product/privacy/reliability and independent visual-review agents contributed.

## Validation

- TDD reproduced old sidebar/group ownership and missing subpages: 5 failing navigation assertions before implementation.
- Focused navigation: 4 files / 13 tests passed. Settings draft/validation/first-run sample coverage: 4 tests passed. Catalogue: 9 tests passed.
- Project typecheck, source lint and focused ESLint passed; git diff --check passed.
- npm run docs:views and npm run check:views: 91 view contracts valid, sitemap current.
- npm run ui:gallery: 40 screenshots captured, no capture failures.
- Initial native smoke: status passed; plugin loaded/enabled; errors []; hostErrorCount 2 from Obsidian core command enumeration. Fresh smoke and full qualification are pending.
- Full npm run verify:project, browser/UI quality and real-Obsidian suites are in progress. Initial broad runs exposed stale navigation locators and pre-fix layout/accessibility defects; final results will replace this paragraph before merge.

## UI evidence

- reports/project-settings/: six categories in light/dark themes at wide/narrow pane widths.
- reports/ui-gallery/index.json and gallery.html: standard 40-capture review gallery.
- reports/navigation-space/: bottom navigation and short-pane evidence.
- Independent visual review awaits final refreshed captures. No screenshot baselines or thresholds changed.

## Untested scope

No live provider/model calls or external-service mutations were invoked. Canonical storage schemas and write services are unchanged. Merge is gated on final green CI, including opt-in browser and real-Obsidian jobs; the local repository plugin build will be updated after merge.

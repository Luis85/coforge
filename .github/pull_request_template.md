## Summary

Expanded studio navigation is 240px wide instead of shrinking to 181px in intermediate leaves. Navigation uses a scoped 32px control-size token and compact spacing in short panes, keeping complete labels and destinations visible at a 740px desktop leaf height. Smaller panes retain reachable scrolling.

Remove the repeated project-work-context banner from Board, Council, Workflow and Project settings. Project name/ID and private visibility remain in the sidebar switcher, and dirty-draft navigation remains guarded. Remove the unused banner component/composable/styles and update the affected privacy/layout assertions and design guidance.

## Requirements and traceability

- Owner requests, 2026-10-29, recorded in BRIEF.md and DESIGN.md.
- Task: docs/project-tasks/2026-10-29-navigation-space.md.
- Generated req-* / vi-* obligations unchanged. View catalogue/sitemap regenerated; 88 view contracts remain covered.
- No user vault data or backups are part of this PR.

## Validation

- Regression first reproduced the narrow navigation width. The final geometry test explicitly fixes the studio to 740px height, exercises the long disconnected status, checks single-line labels, all destinations without overflow, and reachable scrolling at 460px.
- Targeted browser layout, keyboard focus and private-project/capture tests: 8 passed, both themes.
- General UI quality: 8 passed (WCAG, reflow and keyboard reachability).
- Native Obsidian: 3 files / 4 tests passed, including both navigation themes, private-project publication and lifecycle.
- Unit tests: 2 files / 5 tests passed; typecheck passed.
- Impeccable detector: [] findings. Source limits/locale parity, view catalogue and git diff --check passed; self-review clean.
- npm run verify:project: exit 0; check summary: 5 passed, 0 failed, 0 skipped; artifact build and prototype embedding: 1 passed. UI-effect generator reports no declared visual definitions.
- npm run ui:gallery: captured 40 screenshots; reviewed desktop dark and mobile light plus the focused short-pane screenshots in both themes.
- npm run -s dev:obsidian -- --json: status passed, view opened, errors [], hostErrorCount 0, pluginConsole []. Pinned Windows app/installer 1.14.4, launcher 3.2.1.

## UI and native evidence

reports/navigation-space/sidebar-{light,dark}-{980,1280}.png, reports/obsidian/cases/, and reports/ui-gallery/. No screenshot baseline changed. CI e2e checks qualify the complete browser/native suite.

## Untested scope

No live external services/model sessions were invoked. User project/agent data is excluded from source changes. The navigation may scroll in genuinely short panes or enlarged text settings; controls stay accessible.

# Task: Consolidate project configuration and agent workflow

- Status: in progress
- Implementation: complete; release qualification and installation evidence: [PR #35](https://github.com/Luis85/coforge/pull/35).
- Journey in `BRIEF.md`: project setup, multi-project workflow configuration and request-to-recognition.

## Why

Project configuration is spread between a long settings form and a separate Agent workflow destination. Give the owner one persistent place to configure a project and inspect its workflow while keeping execution and destructive actions explicit.

## Traceability

- Owner request dated 2026-10-29, recorded in `BRIEF.md`.
- `design/traceability.json` has no imported requirement or interaction obligations for this owner correction; generated traceability stays unchanged.
- Regression coverage: settings page grouping/draft tests, workflow navigation, destination ownership and browser/Obsidian navigation evidence.

## Acceptance

- Project settings appears once at the bottom of main navigation, remains reachable when task groups collapse, and stays current throughout nested workflow tasks.
- General, Requests, Repository, Agent workflow, Runtime and Data & examples are distinct local tasks.
- Agent workflow retains Workflow runs, Herdr workspaces and Workflow settings. Existing workflow locators open this same nested workspace.
- Local navigation neither saves nor dispatches work. Dirty project and workflow drafts survive guarded transitions; errors remain actionable and failed writes retain edits.
- Visibility boundaries, request schemas, canonical note bytes, active-run snapshots, implementation authorization and external-effect recovery remain authoritative.
- Native themes, keyboard focus, narrow panes, empty projects and clear project versus vault scope remain usable.

## Plan

1. Add failing behavioral regression assertions for bottom navigation, settings ownership and retained drafts.
2. Consolidate settings navigation and redesign focused form surfaces while preserving existing application services.
3. Review product, usability, accessibility, privacy, reliability and maintenance concerns with dedicated agents.
4. Run project, browser/gallery and contained Obsidian checks; self-review and qualify the PR before merging and updating the contained local plugin build.
5. Revisit the corresponding component documents against the final source, then review layout, spacing, padding, fidelity, interaction flow and information architecture in both themes and pane widths.

## Evidence

- `npm run docs:views`: `91 views documented; navigation coverage valid; sitemap generated.`
- `npm run check:views`: `91 views documented; navigation coverage valid; sitemap current.`
- `npx vitest run --config configs/testing/vitest.project.config.mjs src/plugin/tests/project/coforge/view-catalog.test.mjs`: `Test Files 1 passed (1); Tests 9 passed (9).`
- `npm run test:ui-quality`: `8 passed`.
- `tests/e2e/journeys/project-settings.spec.ts`: `2 passed`; all six categories in light/dark and 1280px/480px panes, keyboard operation, no horizontal overflow and zero Axe violations.
- Dedicated final settings captures: 24 PNGs in `reports/project-settings/`; standard `npm run ui:gallery`: 40 screenshots in `reports/ui-gallery/`.
- Independent visual review: `SHIP`. Final document audit aligned labels, component ownership, first-run sample copy, draft/busy states and private scope with the source. Additional screenshot review found coherent layout, spacing, wrapping and action boundaries in General, Requests, Data & examples and nested Agent workflow.
- Focused contained Obsidian navigation/privacy/cleanup checks: `4 passed`. Latest smoke reported `errors: []`, `hostErrorCount: 0`.
- Captured request-field save handling now preserves authored edits while another studio action is pending and enables explicit save again when idle; its component contract records that state.
- Final improvement pass: Runtime now links directly to Repository and Herdr workspaces without a write or dispatch, missing repository guidance uses normal text, the event-trigger action follows workflow heading context, and Request Object controls align to the shared 720px form width. Corresponding component documents and the generated sitemap were revisited after these source changes.
- Aggregate `verify:project`, browser/native qualification, CI, merge and local plugin-build evidence are recorded in PR #35. Local Windows host teardown limitations are reported separately from product assertions.

## Untested scope

Live provider/model calls and external-service mutations are outside this navigation redesign.

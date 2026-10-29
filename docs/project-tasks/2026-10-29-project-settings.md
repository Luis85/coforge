# Task: Consolidate project configuration and agent workflow

- Status: in progress
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

## Evidence

- `npm run docs:views`: `91 views documented; navigation coverage valid; sitemap generated.`
- `npm run check:views`: `91 views documented; navigation coverage valid; sitemap current.`
- `npx vitest run --config configs/testing/vitest.project.config.mjs src/plugin/tests/project/coforge/view-catalog.test.mjs`: `Test Files 1 passed (1); Tests 9 passed (9).`
- Remaining product, UI/gallery and native qualification is recorded by the integrating agent before completion.

## Untested scope

Live provider/model calls and external-service mutations are outside this navigation redesign.

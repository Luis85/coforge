# Task: Choose each workflow step's provider/model and clarify every view

- Status: implemented; final-head CI and merge evidence are recorded in the pull request.
- Journey: per-project agent workflow configuration and streamer operation, BRIEF owner requests 2026-10-27.
- Traceability: generated requirement/interaction arrays are empty; owner acceptance below is authoritative.

## Acceptance

1. Screen, Score, Plan and Build each offer independent provider/model overrides, with visible inheritance from project defaults.
2. Use the currently implemented Claude Code and Simulation runners. Unsupported values fail validation; simulation does not make a real model call.
3. The parent project and selected stage govern manual, automatic and background dispatch, CLI/workspace/implementation gates and effective previews.
4. Queue records capture provider/model for the attempt and history/cost attribution. Later selection of another project does not retarget work.
5. Project Markdown stores sparse overrides; reset removes owned fields, preserving note IDs, unknown properties and exact body bytes. Legacy notes inherit defaults.
6. Saving configuration is blocked while that project's work is queued/running; errors retain drafts and emit no committed configuration event.
7. Every view has an evidence-based goal/primary-action review. Improve confirmed hierarchy, navigation, wording, empty/error, keyboard and layout findings in a bounded polishing pass.
8. Resolve the main checkout's existing merge conflicts, preserve private note bytes and public documentation, and keep private local history out of the feature PR.
9. Verify project/build, UI quality, gallery, native-host behavior and final-head CI/GitGuardian; merge only green.
10. Every explicit streaming ribbon/Open action creates a fresh native Obsidian window; main workspace remains unchanged, stable titles/privacy guards remain, all owned windows close on unload.
11. Kanban actions render as a proper themed floating menu, with groups, disabled reasons, keyboard/mouse access, viewport collision handling and no review bypass.
12. Native status is compact inline text, with no bloating button; actual host overlap cannot cover the offline chat configuration controls.
13. Idea board is first in navigation, followed by clear task groups and predictable ordering.

## Work split

- Core domain/application + focused behavioral tests: step_agents_core.
- Fresh whole-view audit/evidence + focused shared UI polish: ui_intent_review.
- Main checkout merge resolution and privacy preservation: main_conflicts.
- Configuration UI, provider-aware projections, integration, final review/checks/PR/merge: parent agent.

## Evidence

- `npm run verify:project`: five check steps passed, zero failed/skipped (688.2s); release build and embedding regression passed.
- `npm run test:e2e`: 78 passed (9.9m). An added short-pane setup regression reproduced clipping; the corrected chat layout plus panel/Markdown regressions passed 3/3 (1.3m).
- `npm run test:ui-quality`: 8 passed (1.1m).
- `npm run ui:gallery`: 40 current screenshots captured and reviewed, in addition to the illustrated 24-step view-intent review.
- Native dev loop reported tooling unavailable locally; no download/launch. Native capture/menu/layout/persistence coverage runs in contained CI before merge.
- Main checkout conflicts resolved locally; five private notes preserved byte-for-byte, untracked and ignored; only two public documentation paths were carried into this branch. Private recovery refs stay local.

Review: `2026-10-27-view-intent-review.md`. Browser/Obsidian QA uses contained fixtures and synthetic data; no live broadcast or paid agent request.

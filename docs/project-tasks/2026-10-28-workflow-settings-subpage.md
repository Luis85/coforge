# Workflow settings inside Agent workflow

- Status: documentation complete; parent task owns final implementation qualification and merge.
- Owner request, 2026-10-28: Workflow settings must be a subpage of Agent workflow.
- Journey: configure the selected project's process, then monitor its captured execution without changing workspaces.
- Traceability: existing `workflow`, `workflow-runs`, `herdr`, `workflow-settings`, `workflow-step` and `workflow-transfer` view contracts; no new requirement or view ID.

## Acceptance and composition

Agent workflow owns the global navigation entry, H1, selected-project context and page frame. Its local navigation exposes Workflow runs, Herdr workspaces and Workflow settings. The settings editor starts at H2 inside that frame. Unsaved workflow drafts block local task changes, global navigation and project changes until saved or discarded.

The internal `studio.view = workflow-settings` locator remains a guarded compatibility alias. It selects `workflowTool = settings`, renders the same parent workspace and keeps Agent workflow current in the sidebar. It does not add a global destination, host tab or canonical view.

`workflow-settings.md` is a `subpage` of `workflow` and covers both the studio alias and local workflow state through an array of coverage mappings. The catalog retains **74 canonical view IDs**. The information architecture, view-authoring guide and composition conventions describe the visible hierarchy and compatibility boundary.

## Evidence

Before this follow-up, commit `6eb2348` passed CI run `40755524520`: **155 browser tests passed (7.3m)** and **40 gallery screenshots captured**. That is baseline evidence for the earlier revision; the parent task runs fresh checks on the updated hierarchy.

- `npm run docs:views`: **74 views documented; navigation coverage valid; sitemap generated.**
- `npm run check:views`: **74 views documented; navigation coverage valid; sitemap current.**
- Catalog regression run: **1 file / 6 tests passed**, 3.25 seconds.
- Documentation-only `git diff --check`: exit **0**.

Browser, dirty-draft and native-host evidence for the new hierarchy belongs to the parent PR qualification.

The CI gallery review also found that the large unavailable-viewer label exceeded the narrow live-summary column. The polishing fix renders nonnumeric viewer states at a readable status size while preserving larger, tabular numeric readings.

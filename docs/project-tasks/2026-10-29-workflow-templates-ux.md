# Task: Understand, design and operate agent workflows

- Status: in progress
- Journey: BRIEF configurable workflows; owner requests on 2026-10-29.
- Base: f1d166a (PR37). Branch: codex/workflow-templates-ux.

## Why

The operator needs reusable Markdown answer formats attached to individual steps,
and a workflow interface that explains the process, its next action and its
configuration without requiring knowledge of execution internals.

## Traceability

No imported req-* or vi-* IDs apply: design/traceability.json contains empty
requirement and interaction arrays. Acceptance comes from the owner's request and
the configurable-workflow decisions in BRIEF.md. Generated traceability stays unchanged.

## Review scope and evidence

Review the workflow entry, ordered request workflow editor, execution monitor,
manual checkpoints, v2 agent/council editor, transfer, triggers and Herdr recovery.
Review UX, accessibility, product consistency, privacy, data integrity, execution
safety, testing, performance and maintenance. Source observations below are
provisional until correlated with fresh rendered captures; screenshots alone do
not establish accessibility compliance or provider behavior.

Initial source findings:

1. AI settings lead with contract/access/provider rather than the step's purpose.
2. The step list repeats several controls per row and exposes many add actions.
3. Run metadata precedes the selected request's state and next action.
4. The advanced editor presents long forms together and exposes raw binding IDs
   and internal terminology in ordinary authoring tasks.
5. Templates have no canonical library, project controls or captured run guidance.

Fresh source-backed captures were saved and inspected under
`reports/workflow-audit/before/` on 2026-10-29:

| Step | Capture | Health and confirmed finding |
| --- | --- | --- |
| 1. Select and monitor request | `01-workflow-runs.png` | Functional entry and explicit Start, but large gaps separate the next action, process and empty attempt history. Improve current-step/next-action guidance. |
| 2. Design standard workflow | `02-workflow-settings.png` | Functional draft/save controls, but 1694px captured editor leads with technical settings and only three of four standard steps fit its scroller. Purpose and ordinary editing need priority. |
| 3. Edit in compact pane | `03-workflow-settings-compact.png` | Layout stacks, but the captured editor reaches 2223px. Group advanced controls and keep step selection/add/save discoverable. |
| 4. Manage Herdr workspaces | `04-herdr-workspaces.png` | Honest host-unavailable browser state with explicit example action. The host is required to assess actual workspace/recovery behavior. |
| 5. Author council proposal process | `05-council-workflows.png` | About 2000px of simultaneously open forms for two steps. Numbered collapsible steps, plain binding labels and captured prompt inspection make the process easier to scan and review. |

These captures confirm hierarchy/reflow findings, not real provider behavior or
full accessibility. Component, browser and contained-host tests verify state,
keyboard operations, persistence, snapshots and recovery separately.

## Acceptance

1. Each project has a private Markdown template library with plugin list/create,
   read/open, rename/content edit and explicit confirmed deletion through Obsidian's
   native file manager. Stable IDs,
   project ownership and unrelated note properties are preserved. Stale external
   edits fail without losing the draft or overwriting the note.
2. Each applicable AI step can choose or clear one template. Other projects'
   templates cannot be selected or resolved. Missing templates are actionable;
   no agent starts with an unresolved reference.
3. Run admission captures template identity, revision and Markdown. Future edits
   and deletion cannot change existing runs or retries. Guidance cannot replace
   validated schemas, grant tools, disclose private data or bypass review.
4. Workflow entry distinguishes monitoring, designing and Herdr administration.
   Ordered steps expose purpose and outcome first, with advanced controls grouped.
   Adding, selecting, duplicating, replacing, reordering and removing steps remain
   discoverable and keyboard accessible.
5. Runs emphasize current state and the next valid operator action. Checkpoints,
   history and recovery retain their authoritative checks and clear explanations.
6. Advanced workflow authoring uses numbered, manageable step sections and readable
   collection bindings. Definition formats and execution semantics remain compatible.
7. Drafts survive failures and stale saves; navigation never dispatches work.
   Controls have labels, visible focus and usable narrow-pane reflow in both themes.
8. Final project, UI quality/gallery, focused browser journeys and contained-host
   checks pass, self-review is complete, and required CI is green before PR merge.

## Increments and ownership

1. **Review and plan (parent + UX + validation):** fresh baseline captures,
   prioritized findings, product decisions and concrete acceptance.
2. **Canonical templates (template agent):** failing tests, domain/storage ports,
   Markdown CRUD/CAS/privacy, step references and immutable execution snapshots.
3. **Workflow authoring (UX agent + parent wiring):** purpose-first editor, template
   management/selection, compact ordered process, advanced editor and safe transfers.
4. **Workflow operation (UX agent):** entry task descriptions, actionable run status,
   checkpoints, history and recovery sequence; behavioral and UI regression tests.
5. **End-to-end evidence (validation agent + parent):** real source-backed browser
   journeys, gallery, Obsidian smoke/specs, full project gates and CI.
6. **Review and polish (all, overseen by parent):** one comprehensive findings pass,
   fix concrete issues in a batch, confirm affected journeys, docs and PR evidence;
   merge the final checked revision.

## Scope boundaries

Linear workflow behavior and existing council protocols remain authoritative.
No branching language, new external provider, paid invocation, automatic publication,
personal vault access or release/tag operation is needed for this increment.

## Evidence

The owner's additional research-informed second review and its approved
subagent increments are tracked in
[the second review plan](2026-10-29-workflow-second-review.md).

- node bin/app status: status ok; acceptance 0 pending; dependencies missing.
- Maker output-template dry run: no conflicts; reviewed file plan recorded in session.
- Initial npm ci failed locally (ENOTEMPTY); environment qualification is in progress.
- Environment repair: `npm ci --ignore-scripts` exit 0, 691 packages added,
  692 audited, 0 vulnerabilities. Pinned Windows Node 24.21.0 checksum-verified
  against the official archive; npm 11.19.1 integrity-verified in ignored `.nq/toolchain/`.
- Source-backed baseline clickdummy build passed; five captures above reviewed.
- Temporary browser template CRUD test: 1 file passed, 1 test passed (4.42s).
- Runtime wiring and temporary preview CRUD: 2 files passed, 2 tests passed (36.32s).
- Pinned `npm run typecheck`: exit 0 during implementation; full final check pending.
- Backend storage, race guards, v2 vault admission and runtime: 3 files passed,
  12 tests passed (110.06s); pure v2 compiler 2 tests passed separately.
- Frontend usability/editor/subpage/template: 5 files passed, 14 tests passed;
  followup draft/project-race coverage: 2 files passed, 6 tests passed (18.29s).
- Template event/runtime regressions: 2 files passed, 2 tests passed (56.46s).
  The first event integration run caught `INVALID_LOG_CATALOG`; the new template
  facts now use the existing tools catalog, preserving its 100-code limit.
- Source-backed browser diagnostic: 3 scenarios passed (v1 light/dark CRUD,
  keyboard/reflow/axe/checkpoint flow; v2 shared template and preflight invalidation).
  Standard browser startup timed out twice under concurrent local build load;
  this diagnostic used an ignored prebuilt-server configuration with the same
  committed assertions. The required standard command is still pending.
- View contracts: 93 views documented; navigation coverage valid; sitemap current.

## Untested scope

Implementation and end-to-end validation are in progress. No success claimed yet.

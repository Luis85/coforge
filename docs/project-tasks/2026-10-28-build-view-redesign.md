# Task: Make project work and review decisions clear across Build views

- Status: implemented; integrated qualification tracked in the parent task
- Journey in `BRIEF.md`: request → screening → planning → implementation → final streamer review; reusable Council collaboration; multi-project configuration.

## Scope and direction

The selected project is explicit in every Build workspace. An expressive native theme adds larger decision counts, status surfaces, a clear authoring catalogue and a legible evidence hierarchy. Real request states drive the board summary; attempt history never substitutes for accepted work. Definitions, execution and review retain their existing authority boundaries.

## Traceability

`design/traceability.json` declares no requirement or interaction IDs. Existing product behavior is retained; behavioral additions are verified by `board-decisions-ui.test.ts`, `project-work-context.test.ts` and `screening-provenance-label.test.ts`.

## Acceptance

- Project decision counts include only the selected project's requests, including historical legacy request IDs.
- Review and moderation summary actions select the existing filters without writes or agent execution.
- Change project respects unsaved workflow and settings guards.
- Missing selected-project state does not fabricate project statistics.
- Historical screening labels identify the stored provider, including Herdr.
- Request creation displays the selected project's name and stable ID.
- Optional workflow planning and code changes are described honestly in request empty states.

## Reviewed view contracts

- `projects`: Project rows give the stable project ID, request count, review workload and automation state distinct visual roles. Unavailable project notes have an explicit restore instruction beside disabled actions.
- `project-create`: The inline creation form is a separate authoring surface with the same labelled-field and action hierarchy as workflow configuration. Paths and URLs keep their existing validation and write semantics.
- `board`: A project context band identifies the canonical project. The decision summary counts current project requests awaiting screening, moderation or final review; review and moderation counts open their existing filters without running work. Accepted totals count request state, not agent attempts.
- `idea-create`: The creation heading names the selected project and its stable ID before any input. The dialog retains labelled fields, protected focus and the existing submission-failure draft.
- `idea-detail`: The request heading is a distinct project-work surface; evidence sections use a larger reading hierarchy. Overview, plan, increment and activity keep their existing local navigation and review gates.
- `idea-overview`: Screening provenance distinguishes Simulation, Claude Code and Herdr from the stored screening record. The evidence surface and vote count have clearer visual priority; moderation remains an explicit decision.
- `idea-plan`: The empty state describes an optional configured planning step rather than assuming every workflow has the standard stage order. Plan, acceptance criteria and risk sections retain their authored Markdown.
- `idea-increment`: The empty state explains that a workflow may finish without code changes. Changed-file counts, verification evidence and literal diffs retain separate reading roles before final review.
- `idea-activity`: The timeline and attempt sections share the request evidence heading scale. Attempt logs remain literal source text and do not imply successful implementation.
- `workflow`: The selected-project band precedes execution navigation. A prominent automation strip, selected request heading and captured-step sequence separate control state, work in progress and durable attempt evidence.
- `workflow-runs`: The request title and current run state lead the execution workspace. Completed and current steps have distinct surfaces, while attempt details remain expandable and failures remain visible.
- `workflow-settings`: The selected project and saved or unsaved state precede a dedicated step catalogue and authoring area. Configuration, import preview and save actions retain separate visual levels and existing draft guards.
- `workflow-step`: A distinct step catalogue gives selected steps a shared accent surface; the editor keeps its stable reference and AI or manual controls. At narrow pane widths catalogue and editor stack.
- `workflow-transfer`: Import and export use a focused inspection surface with literal JSON. Import still replaces only the editor draft after preview; save remains explicit.
- `herdr`: Connection configuration is a distinct workspace surface, separate from observed workspaces and agents. Unconfirmed actions receive a recovery surface; delivery remains separate from completion.
- `herdr-recovery`: Recovery receives the shared attention surface while preserving exact task evidence and explicit acknowledgement. No interface change retries an uncertain external action.
- `council`: The selected-project band grounds reusable collaboration in the current project. Definition authoring, submission, watched intake, execution, messages and folder administration retain independent local tasks.
- `council-definitions`: The saved-definition catalogue is a separate, searchable surface beside focused definition authoring; selected entries use the shared accent treatment. Narrow panes stack the catalogue above the editor.
- `council-definition-transfer`: Transfer uses the Council disclosure and inspection hierarchy, preserving literal source and its explicit preview and apply decisions.
- `council-submit`: Submission fields and preflight evidence use the Council authoring hierarchy. The execution prerequisite has a visible attention surface and working route to Run monitor.
- `council-inboxes`: Inbox routing uses the Council authoring hierarchy and explicit admission preview. The executor prerequisite remains visible before any watched intake can be changed.
- `council-monitor`: Run records and expandable evidence use a consistent execution ledger. Attention and recovery controls remain close to the inspected run; no count is presented as proof of a successful provider effect.
- `council-execution`: Execution controls remain separate from editable definitions. Executor designation and paused state retain their existing explicit actions, using the shared Council control spacing.
- `council-plan-handoff`: Plan handoff remains inside the inspected run, with the Council evidence hierarchy and existing explicit target-request selection. It does not approve implementation.
- `council-recovery`: Recovery disclosures group allowance, export and uncertain-outcome tools under the inspected run. Expanded controls use the shared form spacing and retain their explicit acknowledgement requirements.
- `council-workflows`: The proposal workflow shares the catalogue and authoring workspace visual language with reusable definitions. Its typed input and checkpoint controls remain separate from ordinary project workflow execution.
- `council-proposal-transfer`: Proposal transfer uses the Council inspection disclosure hierarchy, literal source and explicit draft replacement. Imported definitions never start execution.
- `council-messages`: Team selection, authored message and bounded dispatch controls share Council form grouping. Context delivery remains distinct from recipient activation and completion.
- `council-folders`: Folder configuration uses a focused disclosure, labelled fields and preview grouping. Saving still reconciles definitions without moving or deleting authored files.
- `settings`: Project identity is visible above the form. Brief, repository, workflow location, runtime evidence and data tools have distinct section hierarchy; changing projects uses the existing unsaved-draft guard.
- `settings-repository`: Repository configuration shares the larger project-settings section heading and spacing while paths retain literal formatting and existing permission boundaries.
- `settings-runtime`: Runtime observations use an aligned evidence list with tabular numeric treatment. Observed capabilities remain separate from saved configuration.
- `settings-data`: Backup and sample tools occupy a distinct data surface. Destructive sample replacement retains its exact-target confirmation and pending-work guard.

## Evidence

- Incumbent wide screenshots reviewed: `reports/stabilization/operating-views/{board,workflow,council}-light-1280.png`.
- RED: board-decision UI assertion failed because `Project request decisions` did not exist; 4 other assertions passed.
- GREEN: targeted Vitest run, 3 files passed, 6 tests passed.
- Improvement review cleared incompatible board filters before decision shortcuts, scoped the automation badge to requests, and repaired five unmatched CSS selectors. The filter regression failed with the previous behavior and passed after the fix.
- Remaining integrated type, UI, gallery and host evidence is recorded in the parent architecture redesign task and PR.

## Untested scope

The targeted tests do not exercise live external providers, actual game repositories, or public publication. Integrated qualification and screenshot evidence remain required before the parent task is complete.

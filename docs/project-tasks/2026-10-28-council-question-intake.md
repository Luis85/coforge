# Ask the Council and retain task sources

- Status: backend and canonical documentation implemented; parent task owns final UI/native qualification and merge.
- Owner request: The Council first page must invite a new task or question and show the history of ingested tasks.
- Journey: ask for advice or opinions without manually creating a source note, then inspect attributable execution evidence.
- Traceability: Council PRD DEF-01, INB-01 and WF-02; canonical `council-ask` and `council-task-history` views extend the existing Council workspace.

## Acceptance

Saving a title, question, project and explicit council creates a canonical private analytical note with the existing `submission/v1` identity and separate `coforge_task` metadata. It creates no Idea, viewer, reward, run or provider invocation. Saving does not require executor designation; admission and execution retain their existing gates. Preflight reviews the saved source and submission remains an explicit subsequent action.

The UI retains one idempotency key per draft. Retrying the same key and content returns the existing note, including after an uncertain successful write. Changed content, changed notes, conflicting destinations or duplicate identities fail without overwriting bytes or creating another source. Renaming within the private task folder preserves identity. Questions preserve authored bytes.

The dedicated `CoForge/CouncilTasks` folder is private and cannot overlap watched inboxes, preventing note creation from automatically dispatching work. Canonical saved notes remain discoverable after reload even without a retained run. All-project task history joins stable source identities to retained direct/watched runs, includes failed and uncertain outcomes and labels latest inbox observations separately. Absence of a retained run does not prove a note was never ingested.

## Implementation

- Framework-free `CouncilTasks` validates input and selected project/council/team, then delegates note storage through a typed port.
- `VaultCouncilTaskNotes` protects privacy before writing, uses deterministic draft-key paths and exact existing-byte comparison, and lists only the private task folder. Unknown write outcomes can be retried safely.
- Native `CouncilActions` exposes `createTask` and `listTasks`; the browser example implements the same contract in memory. Existing preflight, typed note subjects, review, admission and execution semantics remain authoritative.
- Observer subscription/publication and private-path policy were extracted from the near-limit Council module by responsibility; each observer still receives its own snapshot and cannot alter execution through an exception.

## Evidence

- Initial backend behavior run: **4 failed**, because `createTask` was absent.
- First backend run: **4 passed**, 4.03 seconds, covering private exact bytes, reload, idempotent retries, uncertain write recovery and validation boundaries.
- Expanded task/source/privacy run: **3 files / 19 tests passed**, 6.84 seconds, including filename identity, duplicate copies and legacy watched-inbox overlap.
- Task/module/startup-disposal run after responsibility extraction: **3 files / 12 tests passed**, 8.66 seconds. A saved task passes existing preflight without admission; live submit remains executor-gated, admits a queued typed note, and repeated reviewed submission does not create another run.
- Source gate after extraction: code-line limits and locale parity passed, **2916 inputs / 226 translated keys** at that revision.
- Scoped backend ESLint and full project typecheck: exit **0** after the completed native/browser task contract.

Final UI, catalogue, cost-attribution and contained Obsidian results are recorded in the parent PR qualification. Tests use contained in-memory vaults; no personal vault or live provider was accessed.

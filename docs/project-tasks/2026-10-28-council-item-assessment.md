# Task: Ask the Council to assess a board item

- Status: implemented; parent qualification pending
- Journey: owner-requested Kanban card action for advice, next steps and open gaps.

## Behavior

The private card menu offers **Send to the Council** for screened, clear requests, including accepted/shipped items. Inbox, flagged and archived items show an actionable screening/restore reason. Navigation authors a local Ask draft only. The streamer explicitly chooses the project's team and Council, saves, reviews admission, and submits or selects the existing explicit simulation destination. An occupied composer names the existing and incoming drafts and offers **Keep current draft** or **Replace draft with item assessment**.

## Source and safety contract

Optional `linkedIdea: { ideaId, revision }` is retained on task input, metadata, history records and preflight source. Native creation rereads the canonical request note, compares it to current trusted state, and appends host-generated assessment context. Context uses the item's captured Request Object class/schema/values, named human context, screening/RICE/plan/review and increment summaries. It excludes account/voter IDs, runtime paths and full diffs. Vote count is explicitly a capture-time fact; later votes do not invalidate the semantic revision or idempotent save retry.

Admission creates a real Idea subject with the task note's source revision and an independent `ideaRevision`. A private, protected source registry binds the linked subject to source identity/path and the exact context block. Removing editable metadata cannot turn that source into generic note work. Create, preflight, immediate admission and each native provider boundary verify the current canonical request and its screening/integrity. Human proposal/custom-field/substantive summary changes block further execution; no snapshot acknowledgement overrides the underlying item check. Explicit publication reassignment retains immutable original linked evidence and existing source acknowledgement gates. Provider outputs remain task-note contributions; this action does not change status, plan, build or review decisions.

Absent links retain existing generic-note behavior. Existing executor designation, paused queue, demo-only explicit simulation policy, budget limits, independent opinion/fan-out execution, unknown recovery and explicit human workflow handoff are preserved.

## Evidence

- Focused helper/native/UI tests: 3 files, 7 tests passed. Covers keep/replace, local-only navigation, canonical capture, vote arrivals, captured custom fields, raw identity exclusion, metadata stripping, real Idea subject through simulation, and actual attention transition before provider response after a canonical note edit.
- Existing Council controls/task creation plus linked native regression: 3 files, 19 tests passed.
- Existing Ask UI/flow plus linked native regression: 3 files, 10 tests passed.
- Scoped ESLint passed. Full project typecheck passed with zero errors after the final linked-item and Economy graph changes.
- Source gate: passed, 3052 inputs and 226 translated keys in the final project snapshot.
- Browser and real-Obsidian journey evidence: parent-owned; local Obsidian is unprovisioned.
- Parent browser journey: **2 passed**, light 8.6s and dark 6.3s. It exercises right-click and keyboard menus, keep/replace of an authored draft, captured item context, saved-task history, narrow reflow and Axe, then verifies the complete original card text is unchanged. Two captures are in `reports/council-card-assessment/`; no provider is invoked by the journey.

# Task: Configure board buckets and the work inside them

- Status: in progress
- Journey in `BRIEF.md`: request → screen → score → plan → design → build → review → recognition.
- Owner request: research through subagents, write a spec and implementation plan, implement through subagents, qualify, push, open a PR and merge only when green.

## Why

The Idea board presents five hardcoded buckets while Agent workflow edits an unrelated flat step sequence. The owner needs to configure one understandable process: first its buckets from Inbox to Accepted, then the dedicated AI/human steps inside each bucket. The current step sidepanel also needs a consistent left edge.

## Research and missing capabilities

Three independent research agents covered product/lifecycle/privacy, UX/accessibility, and architecture/persistence/reliability. All reported before this spec and implementation began. They inspected BRIEF, the empty traceability scaffold, workflow/domain/engine/persistence code, editor/board components, tests, and existing native/browser captures. Existing captures are prior evidence, not verification of this increment.

| Perspective | Finding and response |
| --- | --- |
| User goals / IA | Flat steps do not explain the board process. Present ordered buckets containing ordered steps, with a shared detail area. |
| Design | Preserve the native Obsidian studio, concise copy and existing controls; introduce a bucket outline rather than a second wide Kanban editor. |
| Accessibility | Native nested lists, labeled buttons/selects, retained focus, mutation announcements, and stacked narrow layout; no drag-only operations. |
| Product semantics | Board progress is distinct from evidence-driven status. Bucket labels/order cannot screen, publish, accept or ship work. |
| Reliability | Validate complete membership, bounded unique identities, contiguous execution order and producer-before-consumer dependencies. |
| Compatibility | Legacy definitions and runs must parse unchanged. Group legacy drafts without rewriting notes or captured history. |
| Recovery | Keep invalid/stale/failed drafts; preserve held requests, unknown outcomes, partial diffs and final human review. |
| Discoverability | Visible Add bucket and contextual Add step controls, local reorder, destination selector, empty bucket meaning and removal explanation. |
| Historical work | Retain occupied earlier-workflow buckets when current definitions remove/rename them; never lose a card. |
| Privacy | Private configuration does not widen public projections. Public/capture boards retain their existing screened lifecycle columns and whitelist. |

Sources and their application (these are design inferences, not claims of identical product behavior):

- [Atlassian: Configure columns](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/) separates coarse board columns from statuses and warns that unmapped work can disappear. CoForge keeps total membership and historical fallback.
- [Linear: Project status](https://linear.app/docs/project-status) supports configurable labels/order within lifecycle categories. CoForge keeps Inbox/Accepted endpoint roles.
- [Atlassian: Workflow migration](https://support.atlassian.com/jira-software-cloud/docs/move-issues-to-new-statuses-while-updating-your-workflow/) supports explicit handling of affected work; populated buckets cannot be silently deleted.
- [GitHub: Board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout) illustrates grouping by a configured field. CoForge retains evidence-driven transitions rather than adding arbitrary card dragging.
- [W3C: Rearrangeable lists](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/) informs focus retention/announcements; CoForge uses native lists because rows contain multiple controls.
- [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), and [status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) inform move buttons, narrow layout and polite feedback.

## Traceability

`design/traceability.json` has no requirement entries and `design/visual-traceability.json` has no interaction obligations. This task and dedicated behavioral tests trace the owner's request; no req-* or vi-* IDs are invented and generated visual traceability is not edited.

## Specification

### Definition and execution

1. Extend v1 definitions additively with optional `buckets: WorkflowBucket[]` and optional `bucketId` on steps. A bucket has stable `id`, `name`, `description`, and `role: inbox | process | accepted`. Keep the existing flat `steps` array as the single execution authority.
2. Definitions with buckets have 2–12 buckets: exactly one Inbox role first and one Accepted role last; intermediate roles are process. IDs are unique. Every step belongs to one existing nonterminal bucket, and step order is contiguous/nondecreasing in bucket order. Existing step/dependency/access/limits validation remains authoritative. Accepted has no executable steps.
3. Default editor grouping: Inbox contains Screen/Score; Up next contains Plan; Design contains Design; In progress contains Build; Accepted is the outcome. Legacy/custom sequences keep their exact step order, using deterministic nondecreasing grouping when their semantic outputs differ from the standard sequence. Empty buckets remain visible and execute nothing.
4. Keep default/legacy resolver definitions byte-equivalent until explicit editor adoption/save. Parsing legacy notes, runs and transfer objects never inserts metadata or changes revisions. New saved grouped definitions are captured by existing run admission; the execution kernel still runs the captured flat sequence.
5. Save/import/copy never starts work or rewrites existing runs. Existing atomic save/precondition and project scope remain. JSON transfer/copies carry bucket metadata, and destination-owned references retain current repair requirements. No new permission, provider, acceptance or publishing path.

### Authoring

1. The Idea Board Workflow pane explains: configure buckets top to bottom, then work within each bucket. Show an ordered bucket outline with names, counts, lifecycle endpoint context and nested steps. Use a shared detail panel for a selected bucket or step.
2. Add intermediate buckets before Accepted; rename all bucket labels and edit descriptions. Move intermediate buckets with explicit up/down buttons, moving their complete step segments. Inbox/Accepted cannot be removed/reordered. Remove only empty intermediate buckets, with an actionable explanation for populated buckets.
3. Add AI, Council, nudge, approval/checklist and presets to the selected nonterminal bucket. A step destination selector moves it to the end of another nonterminal bucket. Up/down reorders within its bucket; duplicates remain in it. Stable IDs, complete step data and dependencies survive all mutations.
4. Moving a bucket/step can invalidate dependencies: preserve that draft, identify the problem and block Save until repaired. Do not strip required inputs or auto-save. Retain import preview, conflict guard, project-switch guard, independent template save and shared settings/limits draft.
5. After moves, keep focus on the moved row's surviving control and announce its new position. Selecting a step reveals the detail form; Step list returns to that row. Removing the current empty bucket selects a surviving bucket. Add/select actions never dispatch.
6. Detail headings, fields, input text, help, summaries and empty states align left/start. Utility controls wrap without distributing the title across the panel. The outline/detail stack in narrow leaves, preserving usable controls, long names and footer behavior in both themes.
7. The project pipeline strip shows saved buckets as its main process when the definition has bucket metadata, retaining legacy step labels otherwise. Activity highlights only a matching captured revision/bucket; the strip remains project configuration, not a reinterpretation of a selected historical run. Existing pause and final review controls keep their authority.

### Board projection

1. Use one private domain helper for configured columns and placement. Current saved buckets define the main board order. Existing filters/ranking/search/create remain; use stable column keys rather than titles.
2. For a valid current request revision, a grouped run uses its captured definition and cursor/attempt state. A pending step normally projects into its bucket. Exception: after successful Design with pending Build, keep the card in the preceding Design bucket until Build actually starts (the existing owner rule). Failed/waiting/running work stays discoverable in its captured bucket. A finished no-code run stays in its last executed process bucket, never Accepted.
3. Stopped/operator-held and flagged requests project to current Inbox; rejected requests remain in Archived; only shipped requests project to current Accepted. Stale request revisions ignore captured progress and use lifecycle fallback. Review of preserved diffs remains available and mandatory.
4. Missing bucket metadata keeps the established status-based placement. Match a compatible current bucket by stable default identity/endpoint role; append occupied missing/renamed historical process columns labelled Earlier workflow when needed. Existing captured bucket labels/order are never silently reinterpreted. Each visible request appears exactly once.
5. Public viewer/capture schemas and five lifecycle columns remain unchanged. Bucket definitions, prompts, assignments and descriptions remain private; current screening/privacy exclusions continue to apply.

## Acceptance and test-first plan

1. Domain agent: failing tests for strict schema/endpoints/limits/membership/order/dependencies; legacy exact round trip; deterministic compatibility grouping; save/note/copy/import metadata retention and source preservation. Implement separate bucket domain helpers plus additive schema, leaving the kernel unchanged.
2. UX agent: failing DOM/draft tests for nested selection/add/reorder/move/duplicate/remove, explicit save/discard/conflicts/no dispatch, validation repair and focus. Implement outline/detail and composables/CSS, preserving current step controls. Read Impeccable craft floor before UI edits.
3. Projection agent: failing tests for custom board order/labels, captured and historical columns, no card lost/duplicated, Design readiness/Build start, stopped/stale/flagged/archive/shipped/no-code cases and public exclusions. Implement private domain projection and board binding.
4. Integrate and independently review the final diff across product, UX/a11y, privacy/reliability and maintenance. Repair concrete findings in one bounded pass and rerun affected tests.
5. Add focused browser/native tests for bucket configuration → Save → board → reload, captured execution order/no automatic acceptance and computed left alignment/reflow in light/dark wide/narrow panes. Keep screenshot evidence under ignored reports only.
6. Run check:fast during implementation, then npm run check / verify:project, test:ui-quality, ui:gallery and visual review, contained dev:obsidian JSON and applicable native suite. Run the Impeccable detector once over changed targets and the self-review skill. Fill the PR template with real results and limitations.
7. Commit/push, open the PR with e2e qualification, inspect all final-head GitHub checks, repair failures and merge only when green. Confirm merged state.

## Out of scope

Branching/nested workflow engines, arbitrary status dragging, new AI capabilities, WIP limits, public board schema changes, automatic acceptance/shipping, or silently migrating active runs.

## Evidence

- Initial `node bin/app status`: status ok, zero pending generated acceptance obligations.
- Research: three subagents completed before specification/implementation.
- Local toolchain: Node v24.20.0, npm CLI 11.21.1; `.nvmrc` asks for 24.21.0 and packageManager for 11.19.1. The session provisioning helper does not support Windows archives, so its attempt could not provision the pinned Node. Report local toolchain honestly; GitHub uses repository pins.
- Exact `npm ci` in the isolated worktree: added 691 packages / audited 692, exit 0. The unchanged lockfile reports 27 moderate advisories; no dependency update or audit-rule exception is introduced.
- Independent implementation reviews repaired intact Design-evidence correlation, readiness through intervening manual steps, stable historical-column ordering, reserved UI key collisions, explicit legacy adoption, field-specific validation repair and keyboard focus restoration.
- Browser qualification found a label/content mismatch in bucket controls. The structural repair puts secondary context outside the name-only action button, preserving accessible descriptions. No Axe rules or thresholds were relaxed. Corrected focused journeys passed 14/14 before isolation; final qualification reruns against the isolated feature below.
- A concurrent durable-build task began editing the shared checkout during qualification. Only this feature's 50 owned paths were copied into the managed `bucket-workflows` worktree from the original base, separating the shared BRIEF/schema edits by responsibility. Its unrelated runtime/tests/decisions are excluded. Shared source edits were preserved because that checkout is actively used by the other task.

## Untested scope

Qualification pending. No billable provider or live Twitch/OBS mutation is required.

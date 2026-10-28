# Studio engineering review — 2026-10-28

Review perspectives: privacy, reliability, maintainability and faithful data presentation. Reviewed the final navigation/scope contract, shell bindings, root community/viewer/operations changes, stream/broadcast/statistics/finance/cost changes, public capture CSS and the Build workspace composition. This is a code and targeted-test review; the parent task records visual and host qualification.

## Findings fixed in the improvement pass

1. **Decision shortcuts retained incompatible filters.** A project-wide count could open an empty board when a previous query, category or request type excluded the counted requests. The dedicated decision action now clears those filters and then selects review or moderation; ordinary toolbar filters retain their semantics. The regression starts with a mismatching query, checks the two review cards, and verifies no writes or agent invocation. RED observed the old query remaining; GREEN passed.
2. **Ambiguous automation scope on Council.** The shared context now says Request automation paused/resumed. Council executor designation and pause remain independently owned by Council execution controls.
3. **Five Build selector mismatches.** Replaced the nonexistent board-column, column-heading, Herdr-workflow-recovery and idea-code-block selectors with actual `cf-kanban-column`, `cf-column-header`, `cf-herdr-recovery` and `cf-idea-code` markup; corrected the board-toolbar sibling relation. A source scan finds every remaining Build class, including `cf-markdown` produced by the typed Markdown renderer.
4. **Provider provenance.** Historical screening now identifies Herdr instead of labelling every non-demo record Claude screening. It derives from the stored screening provider and does not depend on mutable project settings.
5. **Workflow assumptions in request empty states.** Plan and increment copy now permits custom workflows and successful processes without code changes.

The independent product reviewer also found the all-project backup under a Project data heading; that reviewer owns the clarified heading and canonical goal.

## Boundaries checked

- New navigation and decision actions only update local state. Existing guarded navigation owns unsaved settings/workflow transitions. Tests exercise the workflow guard; no new application mutation, vault adapter or provider call is introduced by the redesign.
- The destination registry centralizes root identity, ownership and scope without moving canonical data or changing project selection. Public roots continue to consume `StreamSurfaceSnapshot` through their existing projection; they do not receive the private workspace summary.
- Financial actuals and recurring estimates remain separate. Cost totals disclose missing and pending coverage; request acceptance is never inferred from attempt status. Statistics use existing summaries and series, preserving missing observations.
- Viewer registration-gap and retained-uncertainty actions are reversible local filters. Existing pagination watchers reset on filter changes. Retained uncertainty is explicitly historical and does not acknowledge or replay effects.
- New components use composable bindings, per-leaf stores and typed contracts. No singleton, unsafe cast, new credential handling, extra logging or note serialization change was added.
- Source inspection confirms the execution, authoring, request-evidence, recovery, settings and catalogue selectors affect actual markup. The Build stylesheet remains below the 400-code-line limit.

## Evidence

- `npx vitest run --config configs/testing/vitest.project.config.mjs src/plugin/tests/project/coforge/board-decisions-ui.test.ts src/plugin/tests/project/coforge/project-work-context.test.ts src/plugin/tests/project/coforge/screening-provenance-label.test.ts`: 3 files passed, 6 tests passed, including the filter regression.
- Targeted ESLint for new Build components/composables/tests: passed, exit 0, no output.
- Parent integrated checks and current gallery evidence remain authoritative for full-project, visual and host claims.

## Remaining limits

No outstanding new high-priority engineering defect was identified in this bounded review. Real provider delivery, OBS/Twitch effects, external repository execution, note writes, public export and host lifecycle are not proven by these targeted UI tests; the redesign preserves their existing service boundaries and relies on the parent qualification gates. Screenshot and accessibility verification must still pass before merge.

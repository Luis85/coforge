## Summary

Add project-scoped Markdown answer/output templates with plugin create, read/preview/open, edit and confirmed delete controls. Request AI steps and proposal agent/council steps select one template; admission retains its exact content and revision for existing runs and retries. Missing templates produce a visible automatic-admission hold without creating a run or provider attempt.

Overhaul workflow authoring and operation: purpose-first steps, manageable proposal sections, visible agent/access/automation summaries, actionable field-repair links, explicit next actions, captured configuration/history, dependency-aware deletion, and predictable keyboard focus. Complete a second research-informed improvement plan and independent review, fixing measured accessibility, reflow and note-integrity defects.

## Requirements and traceability

- Owner requests on 2026-10-29; BRIEF.md records project ownership, Markdown CRUD, full workflow UX review, researched subagent increments and merge only after green checks.
- No imported req-* or vi-* obligation applies: the arrays are empty; generated traceability is unchanged.
- Plans and linked primary-source research: docs/project-tasks/2026-10-29-workflow-templates-ux.md and docs/project-tasks/2026-10-29-workflow-second-review.md.
- Updated workflow view contracts and generated sitemap: 102 views documented, valid navigation coverage.
- Integrated current main without force: preserved Twitch operations and the owner's later documentation ownership/order edits; only unsupported shorthand links were expanded to canonical clickable links.

## Validation

Final current-revision aggregate results and merge status are recorded on [PR41](https://github.com/Luis85/coforge/pull/41). Required CI must be green before merge; result lines below are from commands actually run.

- Pinned local Node 24.21.0 / npm 11.19.1 provisioned in ignored .nq using checksum/integrity verification. npm ci --ignore-scripts: 691 added, 692 audited, 0 vulnerabilities. No dependency or lockfile changes.
- Combined-runtime npm run verify:project in CI: 5 passed, 0 failed, 0 skipped in 165.6s; release build and prototype embedding passed. Later full diagnostics showed 1119 passed / 4 failed, all four caused by concurrently updated catalogue links. After canonicalization, focused catalogue: 1 file / 11 tests passed, including all four failing assertions; final aggregate CI requalifies the final revision.
- Backend second pass: 13 focused tests passed; exact captured-source regression passed. Canonical storage, cross-project rejection, stale edits, immutable v1/v2 snapshots, automatic admission holds and explicit recovery covered.
- Final Markdown codec integrity: 4 storage tests passed after reproducing indented YAML corruption. Indentation/comments and unknown properties are retained; the assembled note is validated before write; unsupported root flow layout leaves original bytes unchanged.
- Frontend focused regression: 7 files / 20 tests passed; exact checklist repair 3/3; focus/discard regressions 2 files / 9 tests; contextual action-label regressions 4/4. Targeted ESLint passed with zero warnings.
- Dependency query, late project response, runtime wiring and lifecycle subset: 4 files / 7 tests passed. Source line limits/locale parity passed; git diff --check clean.
- JSON and JUnit reports now supplement the original reporters; CI retains them without changing assertions, warning behavior, timeouts, isolation or output limits.

## UI evidence

- Requested source-backed browser flows: 4/4 passed, covering template CRUD/attachment, project references, manual checkpoint/keyboard behavior in both themes, shared proposal templates/review invalidation and long-name reflow.
- Actual 320px proof with valid 100-character names: selected source, captured source and whole run page each clientWidth 224 / scrollWidth 224; overflowingElements []. The prior measured 1121px overflow was corrected.
- Proposal axe verified the contextual button-label fix; labels include the visible Duplicate step / Remove step words. No additional measured defect remains.
- npm run test:ui-quality -- --config .nq/playwright-isolated.config.ts: 8 passed (53.6s), exit 0. Only local port/baseURL changed to 4183 because an unrelated job owned 4181; tests, timeouts and retries unchanged. CI keeps the default config/port.
- npm run ui:gallery: exit 0, 40 captures. Reviewed representative gallery frames, final light/dark library/editor images, captured/selected Markdown, native completed run and exact narrow-pane geometry. No baselines updated or committed.
- Proofs: reports/workflow-output-templates/; catalogue gallery: reports/ui-gallery/. CI uploads current proof images and JSON alongside the existing reports.

## Obsidian evidence

- Pinned app/installer 1.14.4 and launcher 3.2.1, contained vaults/profiles only.
- Combined branch native CI: 32 tests passed; reload smoke passed with errors [] and hostErrorCount 0 after the native test waited for actual settings-save completion. Runtime navigation/draft guards stayed intact.
- Local native project subset: 3/3 passed (30.50s); the previously failing request case passed in 13.426s. Actual template CRUD/edit/delete/reload/snapshot journey also passed locally (21.742s), and its completed-run screenshot was inspected.
- Captured current/prior run template content is displayed from snapshots only, including exact source; no live note lookup or provider dispatch is introduced by inspection.

## Self-review and limitations

Canonical notes retain stable IDs and unrelated frontmatter. Conflicts retain drafts. Named project facts follow successful writes; observer failure cannot turn a successful save into a retry. Private folders and public projections remain separate. Host permissions, finite execution limits, uncertainty recovery, validated output contracts and final human code review remain authoritative.

Local preliminary aggregate/browser runs hit unchanged time budgets under host load; one legacy light proposal journey still timed out locally after its business assertions, while its dark counterpart and all four requested flows passed. These are distinguished from required full current-head CI results. No test, lint rule, timeout, output bound or screenshot baseline was weakened. Native deletion follows the user's Obsidian preference with exact-content/target rechecks; the host has no atomic compare-and-delete API.

No paid model, live Herdr/Twitch/OBS service or personal vault was used. No release/tag/global install was requested. The plugin build is produced locally and in CI; the personal installed plugin is not modified.

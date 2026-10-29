## Summary

Workflow steps lacked reusable Markdown answer formats, and the editor put technical settings before the task. Add a project-scoped template library with create, preview, edit, open and delete controls, attach templates to request and proposal workflow steps, and retain their exact contents for existing runs.

Overhaul workflow authoring and monitoring: purpose-first steps, visible configuration summaries, actionable validation, manageable proposal steps, explicit next actions, captured configuration, dependency-aware deletion, and reliable keyboard focus and narrow-pane reflow.

## Requirements and traceability

- Owner requests (2026-10-29): project-scoped Markdown Answer/Output Templates and a comprehensive workflow UX overhaul, researched second review, subagent-driven implementation, end-to-end polish and merge after green checks.
- BRIEF.md records the scope and preserves explicit saves, project ownership, validated result contracts, host permissions, recovery and final human review.
- No imported req-* or vi-* IDs apply: the traceability arrays are empty and generated traceability is unchanged.
- Plans: docs/project-tasks/2026-10-29-workflow-templates-ux.md and docs/project-tasks/2026-10-29-workflow-second-review.md. The second plan links primary-source research and maps each finding to acceptance and ownership.
- Updated workflow view contracts and generated sitemap: 93 documented views, valid navigation coverage.

## Validation

Draft qualification is in progress. This PR must not merge until final local validation and required GitHub CI are green.

- Exact local toolchain provisioned inside ignored .nq: checksum-verified Node 24.21.0 and integrity-verified npm 11.19.1. npm ci --ignore-scripts: 691 packages added, 692 audited, 0 vulnerabilities.
- Template backend second-pass suite: 13 focused tests passed; final exact captured-source regression: 1 passed. Storage, native-vault v2 admission, immutable snapshots, conflicts, project isolation, missing-template holds and explicit recovery are covered.
- Frontend focused regression: 7 files / 20 tests passed; subsequent exact checklist-repair focus regressions: 3 passed.
- Template focus/reactivity regressions: 2 files / 8 tests passed. Initial raw-record observability defects were reproduced, corrected and rechecked.
- Template dependency query, late project response, runtime wiring and lifecycle regression subset: 4 files / 7 tests passed.
- Source line caps and locale parity passed (3201 inputs, 226 translated keys); scoped ESLint passed with zero warnings; git diff --check clean. No thresholds, lint rules, assertions or screenshot baselines were weakened.
- Preliminary npm run verify:project: typecheck, source lint, zero-warning ESLint and maker types passed; full product test step hit its unchanged 600-second limit under concurrent local load. An existing Herdr Git test also exceeded its 5-second test budget. Final verification is running serially against frozen source.
- Self-review: canonical notes preserve stable IDs and unrelated frontmatter; conflict errors retain drafts; template note writes precede named project-scoped events; observer failures do not turn successful writes into retries. Missing references create no provider attempt. Snapshots are private, and current host permissions still revalidate on every attempt.

## UI evidence

- Fresh source-backed before/after workflow captures inspected in reports/workflow-audit/. Research-informed focus diagnostics reproduced lost focus; explicit action handoffs now have behavioral tests.
- Focused source-backed browser diagnostic: 3 scenarios passed (request template CRUD/attachment/manual checkpoint in light and dark; shared proposal template and reviewed-preflight invalidation). The diagnostic used an ignored prebuilt-server config after standard startup timed out under local load; assertions were unchanged.
- Preliminary full standard browser run was interrupted at 51/198 after 47 passes and 4 timeouts (two old multi-goal Council journeys, two unrelated economy catalog journeys). Council tests were split by user goal without removing assertions or changing the 30-second limit. Final full standard run, UI quality and final gallery remain pending.
- Baseline gallery: 40 captures, exit 0. Final confirmation captures are pending; baseline images are never committed or accepted to silence a failure.

## Obsidian evidence

- Pinned app/installer 1.14.4 and launcher 3.2.1 provisioned inside this checkout's contained host directories.
- Initial native template journey failed to load after new event codes exceeded the existing logging catalog cap. The runtime integration test reproduced it; routing those events into the existing tools catalog fixed it without raising the limit. Runtime regression is green.
- Final contained-host suite and reload smoke are pending the final production build. No personal vault was opened or modified.

## Untested scope

No paid model call, live Herdr service, live stream/OBS/Twitch integration or personal vault was used. Browser data is explicitly temporary; native Markdown and reload tests qualify actual persistence. Platform-specific Unix tests may skip on Windows; final Linux CI is required. No release, tag or global installation is requested.

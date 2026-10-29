## Summary

CoWorkers now has a dedicated vault-wide inventory under Build & Improve, with role/name/ID search, availability filtering, retained drafts, create/edit/save, duplicate, archive, canonical-note access and dependency information. Council Definitions focuses on project teams and councils and links to CoWorkers. Existing agent/v1 identities, memberships, captured revisions and the enforced CoForge MCP-only policy remain compatible.

Build & Improve comes before Stream, Community and Insights. Each group has an accessible collapse control and restores its state from CoForge localStorage, including a safe fallback for malformed or unavailable storage. The normal 740px desktop navigation still fits without unnecessary scrolling.

Remove the board decision-summary section and its unused component/helper/styles; review and moderation remain in the filter tabs. Ask the Council gains a searchable vault file picker that appends a deduplicated wikilink list without replacing input, reading file contents or submitting work.

Review all 90 view contracts: parent properties are clickable vault links, generated tools receive stable parent IDs, route ownership is checked against the source navigation contract, and stale Council/project-band documentation is corrected. Initial Council reads wait for an idle, ready runtime so startup cannot silently skip history refresh.

## Requirements and traceability

- Owner requests dated 2026-10-29 in BRIEF.md and DESIGN.md.
- Task: docs/project-tasks/2026-10-29-workspace-management.md.
- Imported requirement/vi-* catalogue has no outstanding obligation for these owner corrections; generated traceability is unchanged.
- No user vault notes, settings, jobs or cleanup backups are included.

## Validation

- Regression failures reproduced for board removal, collapse persistence, parent ownership and deferred initial reads; corresponding focused tests pass.
- Core editor/catalogue tests: 6 files, 19 passed. Navigation groups: 5 passed. Final readiness/file-picker checks: 4 passed.
- Browser layout, Council intake, CoWorker flows and UI quality: 14 passed. Corrected light/dark theme restoration after reload: 2 passed. Complete Council example flows on the pinned runtime: 2 passed.
- Native canonical note editing/rename and human-byte preservation, card menus and lifecycle passed. Final initialization/history scenario passed after the ready-runtime fix; the remaining final native recheck is pending.
- Fresh native smoke: status passed, view opened, errors [], hostErrorCount 0; app/installer 1.14.4, launcher 3.2.1.
- Source limits/locale parity and source lint passed. All 90 view contracts validate; git diff --check and self-review are clean.
- Full npm run verify:project is rerunning after the final regex lint fix. Final results and CI evidence will be recorded here before merge. Verification uses Node 24.21.0 and npm 11.19.1.

## UI evidence

Reviewed desktop/mobile CoWorker captures in both themes, reports/navigation-space/, and the 40-screenshot reports/ui-gallery/. Browser checks cover WCAG 2.1 A/AA, keyboard operation and reflow. No screenshot baseline or test threshold changed.

Local browser runs used a freshly built clickdummy.html served by an ignored loopback helper after Windows hit preview startup timeouts. CI retains the standard build-and-test commands.

## Untested scope

No live provider/model or external-service sessions were invoked. Existing canonical wire schemas and storage locations are preserved. Final full/native qualification and green CI gate merging and local installation.


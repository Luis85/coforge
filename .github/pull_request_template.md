## Summary

Owner submissions from the studio or verified connected Twitch broadcaster skip screening. Viewer intake still screens. Configured runs record an honest skip without a provider job or charge, retain explicit screening input evidence, and show the first step that will actually execute. Captured runs keep their saved policy; viewer context and external edits revoke the exemption.

Add Delete request to private card menus, detail headers and table rows. Confirmation identifies the request and project, initially focuses Keep request, and moves the original using Obsidian's deletion preference. An exact private recovery copy, proposal/results, votes, execution and cost evidence remain available. Active work and unresolved recovery block deletion; worktrees and code are retained.

## Requirements and traceability

Owner decisions recorded in BRIEF.md on 2026-11-01. The design scaffold declares no req-* entries; no generated vi-* obligations changed. Plans: docs/project-tasks/2026-11-01-board-request-deletion.md and docs/project-tasks/2026-11-01-worker-session-journal.md.

## Validation: actual results

- Final focused product batch: 12 files passed, 64 tests passed. Separate atomic-command batch: 4 files passed, 20 tests passed.
- Owner red/green coverage: trusted entrypoints, real Twitch adapter ID prefix, display-name impersonation, explicit screening inputs, skipped/unavailable providers/CoWorkers/templates, empty screening-only runs, viewer context, forged Inbox/Flagged owner metadata, field edits, canonical persistence and final-review gating.
- Deletion red/green coverage: exact target and stale previews, active work, failed data commits, exact note bytes/name, retained history/native and Herdr cost attribution, interrupted preparation/committed recovery, trash failure, immutable restored evidence, private projection exclusion, recovery-journal exclusion and valid legacy increments.
- npm run typecheck:project: exit 0 on current source. The canonical increment validator was extracted unchanged for use by both active and retired evidence; strict provider-output contracts remain unchanged.
- Changed-source lint: status passed, 51 owned files; explicit-config ESLint including changed native specs: exit 0, zero warnings. The full gate also passed whole-source lint and ESLint.
- npm run test:ui-quality: 8 passed (57.6s). npm run ui:gallery: 40 screenshots captured and reviewed on current source, including both themes and widths. No baselines were accepted or changed. Fresh native deletion captures were reviewed in light and narrow dark layouts.
- npm run test:obsidian: final complete rerun passed all 57 files and 66 tests (858.85s), with 0 failures and 0 skips. Includes owner screening, recoverable deletion, Sessions/Peek, original-worker survival across real host quit/reconnect and plugin lifecycle. Earlier owner fixtures were updated to execute Score and verify the skip; the screening-conversation fixture uses actual viewer intake.
- The preceding native run had 65 passes and one launcher failure before plugin launch (Database is not open). Teardown verified the process stopped and scratch cleaned; the entire suite was then rerun in a fresh process, producing the complete green result above. No retries were added to tests and no assertion was relaxed.
- Native deletion proves cancellation leaves exact bytes unchanged, Keep receives focus, only the selected card disappears, local trash retains the original note and reload does not resurrect it. Card-menu closure now releases its focus scope before opening the confirmation.
- npm run -s dev:obsidian -- --json --port 9335: final source rerun passed with errors [], hostErrorCount 0 and pluginConsole []; pinned Obsidian 1.14.4 / launcher 3.2.1, build 25,722ms and reload 666ms. The screenshot, latest dev.log session and debug report were reviewed; the contained session ended complete.
- npm run verify:project: passed, including all 5 check steps, complete production build (2,142 modules) and 1 prototype-embedding test. UI-effect checks are explicitly skipped by the repository script because no visual definitions are declared.
- Code-line limits and locale parity: passed, 3,861 inputs and 226 translated keys. git diff --check passed.

## Worker-session fix and current full verification

Diagnostics reproduced EPERM during an authoritative record.json write. Atomic replacement now retries EPERM/EACCES/EBUSY at most five times with 160ms total backoff. Every attempt revalidates the directory, destination and staged-file identity; replaced/removed targets, linked staging and permanent denial still fail closed. No test retry or timeout relaxation was added.

Session observations now persist to a bounded, identity-bound session-trace.json sidecar. They no longer rewrite the control file or increment its acknowledgement sequence. Corrupt/foreign observation files are ignored, valid legacy embedded observations remain readable, and live projection works at an unchanged control sequence. Late observations cannot reclaim acknowledged Build capacity. Authoritative storage failures still quarantine execution.

The previously failing case passed 1,000 stress repetitions after the fix. Focused worker/recovery/client/protection checks passed 35 tests across 8 files. New regressions were observed failing before implementation.

The latest npm run verify:project passed: all 5 check steps passed, 0 failed, 0 skipped in 1,979.1s. The complete product suite passed all 536 files: 2,137 passed, 0 failed and 6 existing skips (2,143 cases). Production build and prototype embedding then passed. Complete host, UI quality, gallery and smoke qualification also passed sequentially on the same source. Exact current evidence is saved in reports/worker-session-final/.

## Self-review

The exemption comes from trusted studio intake or connected broadcaster/channel IDs, never a display name. Owner metadata participates in integrity checks even on Inbox/Flagged notes. Editable workflow definitions cannot grant the exemption or implementation rights. Normal output validation, worktree permissions, uncertainty recovery and final human acceptance remain enforced.

Deletion binds state plus whole-note fingerprints, rechecks readiness, preserves command receipts and archives only the confirmed request. Its separate private removal journal rolls back pre-commit interruption and finishes committed removal. Recovery evidence cannot be overwritten by a second deletion. A verified raw recovery copy precedes Obsidian's configured deletion operation. Retired metadata is excluded from public/model projections; restoring a note and reloading joins retained votes/changes and holds execution for review. No dependencies, lint rules, thresholds or screenshots were weakened.

## Evidence and untested scope

Ignored evidence: reports/ui-gallery/, reports/obsidian/ and .obsidian-sandbox/logs/. Original note-path mappings and recovery copies live under CoForge/Recovery/RequestDeletion in the user's vault when this action is used. No personal vault, live Twitch mutation, paid provider inference, actual game build, release, push or commit was used for this change.

Local Node is 24.20.0; .nvmrc pins 24.21.0. The full product suite reports 6 existing skips; no new skipped or TODO tests were added. All required current-source gates passed. No dependencies, test thresholds, host guards or screenshot baselines were changed to obtain these results.

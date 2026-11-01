# Task: Delete a request from the private board

- Status: done
- Journey in BRIEF.md: maintain the project's request backlog.

## Why

The owner needs to remove feature requests from the board, beyond archiving them.
The existing removal path is limited to example cleanup.

## Traceability

- Owner request in this chat, 2026-11-01; the design scaffold has no req-* entries.
- No generated vi-* obligations are changed.

## Acceptance

- A private card offers Delete request with an explicit confirmation naming its ID
  and title. The recoverable default respects Obsidian's configured trash
  preference and retains execution/cost evidence plus an exact private recovery
  copy, including when the user's preference permanently deletes the original.
- Active work, unknown outcomes and unresolved recovery prevent deletion. No
  cancellation, provider dispatch, worktree removal or external mutation occurs.
- A changed request or note invalidates the preview. Failed persistence preserves
  the board card, exact note bytes and private state; reload reconciles interrupted
  removal. Other requests and projects remain untouched.
- Public views stay read-only. Retained command receipts prevent chat replay.

## Plan

1. Add failing application/vault tests for explicit deletion, active/recovery
   guards, exact-target checks, persistence failures and retained history.
2. Reuse the contained exact-note removal journal with a distinct request-deletion
   identity and recovery location; preserve the original note filename in trash.
3. Add a private confirmation dialog through the existing Vue/store patterns and
   a card-menu entry. Keep request drafts and error details on failure.
4. Qualify the flow with product tests, UI quality/gallery and contained Obsidian.

## Evidence

Implemented with 64 focused product tests passing. The worker-session failure was
fixed and stress-tested in the companion worker-session-journal task. The final
npm run verify:project passed all check/build steps, with 2,137 product tests
passed, 0 failed and 6 existing skips. The complete native rerun passed 66 tests,
including deletion and owner screening. UI quality passed 8 checks and 40 fresh
gallery captures were reviewed. Final contained smoke passed with no errors.
See .github/pull_request_template.md for exact results and limitations.

Recovery copies are non-Markdown files next to each removal receipt under
CoForge/Recovery/RequestDeletion. The receipt names the original path. Restore
the note to that path and reload CoForge to rejoin retained vote/change evidence;
execution remains held for review. A pending recovery is preserved before any
further deletion can overwrite its journal.

## Untested scope

No live viewer/provider activity or personal vault was used for qualification.
No worker safety behavior or test thresholds were weakened to force a pass.

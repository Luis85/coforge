# Task: Retry background Builds and improve the current request result

- Status: integrated; independent improvement and qualification in progress
- Journey: old request → retained completed steps/history → reviewed background Build retry → final human code review.

## Why

Existing requests capture the foreground execution policy. Ordinary retry keeps
that policy, while Restart begins again at the first step. The owner wants a
fresh background Build attempt without rerunning completed analytical work.

## Traceability

Owner request in BRIEF.md. The scaffold has no req-* or vi-* entries for this
increment; no IDs are invented and no TODO test counts as acceptance.

## Acceptance

1. An eligible failed/cancelled or not-yet-started native Build can run in the background
   from the request detail, retaining its cursor, completed steps/results,
   historical attempts/jobs, captured task and provider/model/effort context.
2. Preview performs no paid work. Confirmation is bound to the request/run
   revision and reviewed execution/resource choices; stale input or resources
   invalidate it. The new attempt and authorization persist before dispatch.
3. No queued/running/unknown original executor, unacknowledged durable result,
   changed proposal, missing metadata or closed/moderated request bypasses its
   existing gates. Preview/failed admission never clears an operator hold.
4. The owner chose continuing reviewed partial work. An immutable actual file
   snapshot is copied onto its original Git base in a fresh worker-owned tree;
   the original worktree/journal stay untouched. Missing real-work attribution,
   unsupported or changed files and protected paths fail before paid dispatch.
5. Repeated confirmation, failure/reload and Stop races never duplicate a paid
   launch or repeat completed steps. Final human review remains mandatory.
6. Controls, resource explanation, partial-work handling and history are clear
   in both themes and narrow/wide views; keyboard use and failures retain drafts.
7. Improve & polish is configurable as one explicit CoWorker/manual AI pass,
   with provider/model/effort, instructions and limits. A feedback modal opens
   from every Kanban bucket and feature detail, including accepted cards.
8. Capture the current result type and exact source/checkpoint. An auxiliary
   one-step run retains its own attempts and outputs; primary progress and
   original artifacts stay intact. Pending output cannot become future input.
9. Apply/Discard is explicit. Approved text versions point to genuine auxiliary
   artifacts, and later steps capture those exact references. The original note
   proposal/body stays unchanged. Stale sources, active or unknown executors,
   moderation flags and private-write failure cannot bypass existing gates.
10. Code polishing copies reviewed source to a background job, then Apply copies
    the reviewed result into a fresh primary-owned resource with the proper
    execution mode. A durable operator intent/private receipt makes retries
    idempotent without manufacturing model jobs or adopting foreign workspaces.
    Old callbacks stay attached to their original resource epoch. Accepted cards
    reopen for review and close through explicit Apply/Discard without new credit.

## Plan and ownership

1. Agree the minimum audited retry/preview contract after independent application,
   native resource and UI audits. Application owner writes failing behavioral
   tests and implements the framework-free transition/schema/ports.
2. Native owner qualifies original workspace/resource identity and fresh worker
   admission using existing ports or narrowly required adapter support; tests
   must prove preserved evidence and no unverified writer adoption.
3. Presentation owner implements the request action, reviewed preview/confirm,
   revision handling and attempt/policy explanation, then browser/native tests.
4. Root integrates, records product decisions, performs cross-review and a bounded
   improvement/polishing pass, then freezes source for complete qualification.
5. Run verify:project, UI quality/gallery review, contained host smoke/native,
   fill the PR template with actual evidence, push/open with e2e qualification,
   and merge only the exact final head after every required check is green.

## Agreed transition contract

- Keep the same request/run/cursor and original definition. Append a per-attempt
  background-retry approval, fresh attempt/job IDs and a private snapshot ref.
  Earlier artifacts, attempts/jobs and captured profile/task stay unchanged.
- Effective-step validation uses the exact approval ID for the new attempt;
  prior attempts continue to validate against their original snapshot. Workspace
  epochs keep old changes attributable without projecting them onto a new tree.
- Preview stages private immutable evidence, makes no canonical note write and
  starts no worker/model. Confirm revalidates source and policy, creates a private
  target authorization and commits the approval/queued attempt atomically before
  dispatch. A preview snapshot alone never authorizes import into another job.
- Require changes-reviewed consent and prior-executor-stopped consent when an
  original attempt exists. Releasing an operator Stop hold is separately explicit.
  These acknowledgements never pretend to provide legacy OS process-tree proof.
- Use only the saved matching Build's background execution policy, or an explicit
  background default when none exists. Retain original inherited turn/USD limits;
  unrelated live definition, prompts, profiles and provider/model edits do not apply.
- Source is either an attributed retained workspace or a verified clean repository
  when no old real work/workspace exists. Never infer a clean source from missing
  partial-work metadata. Pin the actual reviewed base, even if source HEAD advanced.
- Preserve existing worker refs. An old live worker lacking snapshot-import
  capability blocks before admission with upgrade guidance; never kill or silently
  replace an active/unknown supervisor to enable the new operation.

## Out of scope

No live CF-135 mutation or paid model call during development. No automatic
legacy-session resume, replay of earlier workflow stages, or silent adoption of
new project prompts, CoWorker profiles or unrelated workflow edits.

## Polishing architecture

- Optional `workflow.improvementPass` is independently copied with a saved
  workflow. It does not add an automatic workflow step. Text passes use bounded
  foreground execution; native code passes use reviewed background snapshots.
- `Idea.polishingRuns` records the independent one-step run, feedback, source,
  primary checkpoint, captured policy and explicit review state. Primary and
  auxiliary run resolution never replace unfinished main work with a new run.
- `Idea.polishingAmendments` references real output IDs/hashes. Pending artifacts
  do not project onto the idea. Apply binds approved inputs without rewriting
  old artifacts or pretending a parent step completed.
- Code materialization verifies both the original reviewed baseline and the
  completed auxiliary workspace. Its private receipt precedes canonical resource
  binding; a copied tree is not an invented provider execution. Preserve both
  source trees and refuse active/unknown writers or changed bytes.
- The feedback modal is a per-Studio presentation sibling. Suspend and restore
  the existing detail drawer, selected tab and trigger focus; never nest dialogs
  or store a global modal singleton.

## Qualification and improvement increments

After the first integrated implementation, independently review and execute:

1. Application lifecycle and persistence: repeated retries/polishing, every
   result type, real note/private-state rollback, reload, stale sources, old
   callbacks, Stop holds, review closure and absence of duplicate credit.
2. Native resource correctness: binary/deletion/untracked copy, original base
   pinning, source drift, target receipts, old-worker capability, operator-copy
   idempotency/crash handling and independent FG/BG resource ownership.
3. Interaction polish: modal feedback/preview/error retention, enabled and
   disabled settings, CoWorker/manual resolution, all-bucket actions, genuine
   result review, responsive wrapping, themes, keyboard and focus restoration.
4. End-to-end qualification: focused browser/real-host journeys, full
   `verify:project`, UI quality/gallery review, contained host smoke and full
   native suite. Freeze source during full qualification; repair findings with
   behavioral regression tests and rerun affected/full gates as required.
5. Closeout: independent final cross-review, real evidence in the PR template,
   commit/push/draft PR with `e2e`, then merge only the exact final head after
   every GitHub check is green. Record untested paid/live/OS failure scope.

## Evidence

Initial code audit confirms that ordinary retry uses run.definition and Restart
creates cursor zero. Retry, independent polishing runs, explicit result review,
per-run provenance and scoped native copies are integrated. The subsequent
eight-increment improvement plan, independent findings and real focused evidence
are recorded in `2026-10-31-background-retry-polishing-closeout.md`. Final frozen
verification, real-host/UI qualification and exact-head GitHub checks remain
required before delivery.

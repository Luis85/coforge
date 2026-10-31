# Task: Inspect prompts and answers from Idea board activity

- Status: in progress
- Journey in BRIEF.md: request → screen → score → plan → design → build → review.
- Owner request: inspect what was sent to the LLM and what came back under the
  corresponding task Activity dropdown; researched, subagent-driven implementation,
  improvement and polishing, dedicated worktree, green PR and merge.

## Why

Activity currently lists events and per-attempt diagnostic logs. Operators cannot
inspect the actual request or returned answer, distinguish changed prompts across
retries, or diagnose a rejected response. Later settings cannot establish what was
sent earlier. Captured evidence must be private, durable and honest about coverage.

## Traceability

The checked-in design/traceability.json requirements and interactions are empty;
there is no applicable req-* or business-todo vi-* obligation to mark implemented.
The owner decision in BRIEF.md and behavioural tests below are the acceptance
contract. Do not invent generated traceability IDs or modify visual traceability.

## Research and product perspectives

Three specialist subagents investigate UX/accessibility and primary-source patterns,
data/provider architecture and durability, and qualification/privacy/host behaviour.
Their findings and source links are recorded in the companion research document.
Preserve the existing studio design and native disclosure interaction. This is an
Operate/Read task: find an attempt, understand its inputs and answer, then decide
whether existing recovery or review actions are appropriate.

## Acceptance

1. Given a request with runs, opening Activity exposes each attempt independently
   with its captured stage, provider/model, status and time; opening its dropdown
   reveals labelled instructions, prompt and response beside diagnostic logs.
2. Capture provider-bound instructions/task before sending. A failed capture stops
   dispatch. Capture available response text before validation so invalid output is
   inspectable even when the request does not advance.
3. Reload and retry retain the original evidence. Changing request/project/settings
   does not rewrite old history; different attempts never share mutable evidence.
4. Queued/running, failed/cancelled, missing-response and legacy runs explain missing
   data. Simulated content never claims an LLM request. Unavailable intermediate
   tool turns or provider internals are not fabricated.
5. Bound retained text with explicit truncation; dispatch receives the original
   input. Treat transcript contents as literal untrusted text, with long-line wrapping
   and keyboard-accessible disclosures in narrow and wide light/dark views.
6. Store evidence only with private run data. Public boards, public capture roots,
   viewer exports and operational logs never receive transcripts.
7. Reading history never dispatches work or bypasses human review/recovery gates.

## Improvement and polishing increments

1. **Research and failing acceptance:** inspect incumbent code and tests; identify
   provider boundaries and evidence gaps, record explicit states and source-backed
   disclosure/provenance choices. Write failing behavioural tests before changes.
2. **Durable evidence:** add a framework-free conversation contract and validation,
   awaited engine persistence, capture in current Claude/Herdr/demo/MCP paths where
   available, and failure/reload/retry/size-bound tests. No unrelated provider work.
3. **Activity reading experience:** extend the existing per-run dropdown, separate
   captured evidence from diagnostics, attribute the attempt and label incomplete
   history. Keep Vue scripts thin and presentation logic in composables/helpers.
4. **End-to-end qualification:** exercise an actual board-to-Activity demo run,
   expand its captured evidence, reload and inspect again in contained Obsidian;
   add public-exclusion and literal-text assertions. Review actual screenshots.
5. **Polishing pass:** independent subagent review of acceptance, failure semantics,
   accessibility, wrapping, timestamps, empty/legacy/simulation copy and privacy;
   fix findings in one batch and confirm once. Run the manual design detector once.
6. **Closeout:** run all required gates and self-review, fill the PR template with
   real results and limitations, open a PR, enable end-to-end CI, fix failures and
   merge only once required checks are green. Keep other sessions untouched.

## Evidence

- Baseline node bin/app status: status ok; 0 acceptance obligations pending.
- npm ci: exit 0, 691 packages added; lockfile unchanged. Existing audit reports
  27 moderate vulnerabilities; dependency changes are outside this increment.
- Local Node/npm: 24.20.0 / 11.21.1; repository pins 24.21.0 / 11.19.1.
- Dedicated managed worktree: idea-task-chat-history, branch
  codex/idea-task-chat-history from origin/main b798513.
- Further test/host/CI results to be recorded after execution.

## Untested scope

Live billable provider calls, personal vaults and external game code mutations are
not needed for transcript qualification. Provider boundaries use deterministic
transport tests; contained Obsidian uses explicitly labelled simulation.

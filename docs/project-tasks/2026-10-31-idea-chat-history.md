# Task: Inspect prompts and answers from Idea board activity

- Status: implementation and polishing complete; release qualification is recorded
  in the delivering PR's validation and checks.
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
   available, and failure/reload/retry/size-bound tests. Integrate the newly merged
   native Codex provider from main: capture its assembled guarded input at the
   actual transport boundary and visible assistant messages before validation,
   redact credentials including the ephemeral MCP token, preserve token telemetry
   and keep tool/reasoning stream events out of the transcript.
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

## Executed increments and polishing outcomes

| Increment | Outcome |
| --- | --- |
| Research and acceptance | Three specialist agents reviewed operator goals, UX/accessibility, privacy, reliability, architecture, performance and native qualification. Primary-source findings and design inferences are in the companion research record. No blocking owner decision was invented. |
| Durable attempt evidence | Optional persisted contract and awaited callbacks preserve original inputs, rejected output, reloads and independent retries. Storage failures stop dispatch/advancement; 64,000-character bounds disclose truncation. |
| Activity reading experience | Matching native disclosures show captured input/output, model/time/effort attribution, subordinate instructions/logs, literal wrapped text and honest unavailable/simulation/external-client states. |
| Native and privacy qualification | Actual Obsidian board → workflow → Activity → reload tested; authored body preserved, reading does not dispatch. Public website/capture/OBS projections exclude evidence. |
| Independent polishing | Fixed pre-dispatch delivery wording, exact retry timestamps, missing region semantics, MCP correction resubmission, usage/partial-workspace cleanup on evidence failure, credential redaction and preservation of both Claude prose and structured output. Wide/narrow, light/dark captures reviewed; no remaining visual findings. |
| Upstream Codex integration | Merged PR #54, preserved its execution restrictions and extended capture at the real transport boundary. Visible assistant messages and original guarded input retained; internal reasoning/tool events excluded; MCP token redacted. Captured effort never follows later settings edits. |
| Final release qualification | Final UI quality, gallery, native feature/provider/Design tests and host reload passed. Full project gate and GitHub closeout are tracked below and in the delivering PR. |

### Command evidence

- Baseline node bin/app status: status ok; 0 acceptance obligations pending.
- npm ci: exit 0, 691 packages added; lockfile unchanged. Existing audit reports
  27 moderate vulnerabilities; dependency changes are outside this increment.
- Local Node/npm: 24.20.0 / 11.21.1; repository pins 24.21.0 / 11.19.1.
- Dedicated managed worktree: idea-task-chat-history, branch
  codex/idea-task-chat-history from origin/main b798513.
- Incorporated origin/main 28a4a02 (provider/model/effort support, PR #54) in merge
  f66a00a. The initial full gate was cancelled after upstream changed so final
  qualification can run once against the integrated increment. Earlier fast gate
  was also superseded; neither cancelled run is claimed as passing.
- Initial focused backend qualification: 6 files / 42 tests passed; Claude
  fidelity follow-up: 2 files / 10 tests passed. Mounted UI: 3 tests passed.
- npm run test:ui-quality: 8 passed (1.0m).
- npm run ui:gallery: 40 screenshots; wide dark and narrow light reviewed. This
  gallery covers generated preview; the feature is qualified in the actual host.
- Native feature test: 1 file / 1 test passed, including reload/body preservation,
  keyboard disclosure and eight wide/narrow light/dark screenshots reviewed.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned Obsidian 1.14.4, launcher 3.2.1. Sandbox logs inspected.
- Manual Impeccable detector: [] findings. Self-review guard: no findings in 30
  changed files before upstream integration. Final integrated results pending.
- Final integrated focused Codex tests: 2 files / 12 tests passed; mounted history
  UI: 4 tests passed. Independent release review found no actionable issues.
- Final integrated native qualification: 3 files / 3 tests passed (46.88s), covering
  history, provider model/effort settings and the Design handoff. Final dev smoke
  again reports status passed, errors [], hostErrorCount 0 and pluginConsole [].
- Final UI quality: 8 passed (54.6s); final gallery: 40 screenshots, reviewed.
- Final self-review guard before evidence commit: no findings in 36 changed files;
  git diff --check clean. No generated reports or native cache files are committed.
- First integrated full gate: 3 passed, 2 failed (876.0s); 370 files and 1,468
  tests passed, one catalogue-sync test failed, six existing tests skipped. The
  second failure was an invalid test fixture effort field caught by typecheck.
  Fixed the fixture without weakening assertions and regenerated the canonical
  view catalogue (108 views, valid navigation). Fix qualification: typecheck exit
  0 and targeted UI/catalogue tests 16 passed. The corrected full local rerun and
  complete GitHub browser/native qualification are recorded in the delivering PR.

## Untested scope

Live billable provider calls, personal vaults and external game code mutations are
not needed for transcript qualification. Provider boundaries use deterministic
transport tests; contained Obsidian uses explicitly labelled simulation.

# Task: Choose provider models and reasoning effort

- Status: done
- Journey: Agent workflow settings and reusable CoWorker definitions in BRIEF.md.

## Why

Free-text model fields provide no valid choices, and there is no reasoning-effort
setting. CF-134 also exposed a generic CLI failure message after a billable Build.

## Traceability

No req-* or vi-* IDs are declared in the current traceability files. This change
implements the owner's 2026-10-30 request recorded in BRIEF.md.

## Acceptance

- Codex is an executable provider in both editors, with local CLI detection,
  captured model/effort, authenticated invocation-scoped MCP, protected file
  operations and independent worktree capture. Native shell, patch, image,
  browser and delegation actions cannot bypass scope. Do not infer dollar cost.

- Keep completed Design requests in the Design column with the owner-selected
  "Design complete · Ready to build" label only when the next captured step is
  Build and the current Design artifact is intact. Stale/invalidated evidence must
  not claim completion; preserve existing dispatch/review gates.

- Provider selection offers documented model choices and compatible effort values.
- Simulation disables model/effort calls. Custom IDs survive edits and saves.
- Explicit saves retain model/effort; failed saves retain the draft.
- Workflow/Council/v2 execution captures choices; later edits cannot change them.
- Native and managed Herdr launches forward effort without relaxing tool policy.
- Recognized CLI failure envelopes explain turn/budget/structured-output limits
  without disclosing raw output or losing usage/partial-change recovery.

## Evidence

Final frozen-source verification:

- NODE_OPTIONS=--max-old-space-size=8192 npm run verify:project: exit 0.
  check: 5 passed, 0 failed, 0 skipped in 931.1s. Product suite: 366 files,
  1,440 tests passed, 0 failed, 6 existing skipped. Build passed; prototype
  embedding: 1 passed. UI effects explicitly skipped: no visual definitions.
- Final self-review: no findings in 87 changed files; git diff --check: exit 0.
- Final UI quality: 8 passed (1.1m); gallery: 40 screenshots, reviewed.
- Combined contained Obsidian settings/Design scenarios: 2 passed (36.84s).
- Final Codex schema/runner regressions: 2 files, 8 passed, covering optional
  reply fields, preservation of unknown keys, credential separation and waiting
  for active host calls before workspace capture.

The earlier failures and process timeouts below are retained as iteration evidence,
not counted as final passing checks.

- Initial provider settings regression: 2 failed (`effort: is not allowed`), 4 passed.
- Focused model/UI/provider/note regressions: 6 files, 23 tests passed.
- Typecheck: exit 0.
- Full gate outcomes are recorded in the final verification summary above.
- Additional Council/v2 capture regressions: 2 files, 12 tests passed.
- Failure-message regressions: 1 file, 5 tests passed.
- UI quality: 8 passed (52.0s). Gallery: 40 screenshots; wide dark/narrow light reviewed.
- Real-host provider settings: 1 test passed, canonical workflow/CoWorker model
  and effort survive reload; both editor screenshots reviewed.
- Contained dev loop: status passed, errors [], pluginConsole [], hostErrorCount 0.
- Impeccable detector: []. Diff self-review: no findings in 36 changed files.
- Design label regression initially failed (Ready · Build instead of the new
  label); fixed using the current saved-specification validator. Full Design
  workflow, board and stale-specification regressions passed (15 tests).
- Combined real-host provider/Design scenarios: 2 files, 2 tests passed (29.87s).
  Board readiness screenshot reviewed; the label survives reload before Build.
- Initial full check: 4 gates passed, test gate failed (1 failed, 1,426 passed,
  6 existing skipped). Incomplete step-type drafts briefly removed the model;
  the capability lookup now tolerates that state. The invalid-model repair test
  now exercises the custom-model input with the same focus/value assertions.
- Final focused editor/model/Design regressions: 5 files, 26 tests passed.
- During an earlier verify:project pass, typed lint
  completed before a planned heap-adjusted restart; the duplicate restart was
  stopped, and the original completed lint plus product-suite run was retained.
- Owner added native Codex after the first verification pass began. Its provider,
  settings and transport regressions initially failed as expected. Codex profile,
  settings, provider routing, protected files, editor repairs and Council MCP
  regressions: 8 files, 20 tests passed. Latest Codex-only regressions: recorded
  in the final verification output (3 files, 7 tests passed).
- Local native Codex 0.145 qualification used only a loopback synthetic Responses
  endpoint (no billable inference): its scoped MCP invocation returned the bound
  task; an attempted native image read was rejected. The final profile uses the
  installed model catalogue, text-only capabilities, direct MCP tools, no native
  multi-agent capability and no user/project customizations. CLI USD cost remains
  unavailable; native turn/USD flags are not misrepresented as Codex spend caps.
- Real Obsidian provider/Design scenarios after adding Codex: 2 tests passed
  (36.84s), including Codex settings retained in workflow and CoWorker notes.
- A previous verify:project attempt reached the default 600-second child timeout
  during the product suite while the added provider was being implemented. It is
  not counted as passing; final verification is rerunning on the finished source.
- The full product run measured 592.33 seconds for 366 files, too close to the
  old 600-second outer process budget once startup/reporting are included.
  verify:project now passes the existing CLI's supported --timeout 1800000 option.
  This changes only the orchestration wait budget, not individual test timeouts,
  assertions, lint rules or coverage thresholds. Final verification uses an 8 GB
  Node heap and a frozen source tree. A strict-output assertion added during the
  previous run saw its earlier-loaded module; its corrected focused rerun passed
  (2 files, 8 tests). That stale full-run failure is not counted as green.

## CF-134 investigation

The retained Build attempt `4ea01566-7688-487c-89fb-253ce54958c9` used Sonnet,
ran from 19:56:23 to 19:58:55 UTC and exited 1. Usage and USD 0.4425178 were
recorded, demonstrating provider activity before failure. Captured limits were
12 turns, USD 1 and 180 seconds. The raw failure subtype was not retained, so
the specific historical cause cannot be established. No automatic retry or
changes to the existing request/worktree are authorized by this diagnosis.
The retained worktree is clean (git diff --stat and git status --short
both empty), so no partial changes were found for recovery.

## Untested scope

No billable provider request or personal-vault launch is part of qualification.
The model catalogue contains documented choices rather than an account-entitlement
probe; aliases and account/organization policy resolve in the installed provider.

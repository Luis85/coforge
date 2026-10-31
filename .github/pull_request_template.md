## Summary

Workflow configuration and request execution now have separate homes. Projects
can reuse a saved workflow as an independent draft, choose startup Play/Paused,
and assign saved CoWorkers or manual provider/model/effort settings to AI steps.
Stopped cards return to Inbox with a durable hold that only the operator's card
menu Restart action releases.

- Persist independent navigation/chat collapse choices in localStorage, including
  explicit expanded chat at narrow widths; blocked storage keeps controls usable.
- Capture CoWorker identity, revision, role, instructions and execution settings
  per run/job. Preserve queued settings, reject missing/disabled profiles without
  fallback, and retain host step/project permissions without requiring a Team.
- Copy other projects' saved v1 definitions without changing source notes/runs.
  Preview startup behavior and repair project-scoped references before saving.
- Move execution, captured results/history, checkpoints and recovery into the
  selected feature's Workflow runs tab. Keep project automation controls and Step
  attempts in settings. Tabs are Idea Board Workflow, Step attempts, Timing &
  limits, Answer / output templates, then Herdr.
- Preserve per-run MCP/native summaries in details while keeping the project
  summary independent. Definition/timing panes share a draft; templates save
  independently. Startup preferences apply on reopen, without dispatch on save.
- Stop persists before aborting work. Play, reload, triggers, MCP and generic
  starts cannot unlock a card. Late diffs/responses stay with the original run;
  preserved changes and unknown outcomes retain human review/recovery gates.
- Make project/native settings footers flush and opaque while keeping buttons
  clear of the native status bar. Align notification icons/body/actions, improve
  error-text contrast and keyboard-readable logs, and keep floating notices clear
  of measured action footers, including wrapped and pop-out layouts.

## Requirements and traceability

Owner requests recorded in BRIEF.md on 2026-10-31. The traceability scaffold has
no declared req-* or vi-* obligations for these requests; no IDs were invented.

Implementation and executed subagent review/polishing plan:

- docs/project-tasks/2026-10-31-workflow-workspace-preferences.md
- docs/project-tasks/2026-10-31-workflow-polishing-plan.md

Three agents implemented the increments, independently reviewed boundaries and
executed focused browser/host proofs. Integrated main's 18aec07 private prompt/
response history and retained it across Stop/Restart and late responses.

## Validation

- npm run verify:project: passed, 5/5 check stages (871.4s); 1536 product tests
  passed, zero failed, six existing Windows/platform skips. Release build passed;
  prototype embedding 1 passed. UI effects explicitly skip because this project
  declares no visual definitions.
- UI quality: 8 passed, including both themes, 360px reflow and keyboard/focus.
- Final gallery: 40 captures, failures empty; wide dark/narrow light reviewed.
- Whole native suite: 49/51 passed across 44 files. Fixed its two failures:
  active Alerts text contrast and a stale four-tab expectation. Fresh targeted
  rerun: 2/2 passed, preserving all Axe rules and checking both themes.
- After the final shared-summary/admission repairs: focused product 27+1 UI cases
  and 30 admission/assignment/engine/Stop cases passed; browser 6 passed; fresh
  native detail/Activity/Council/manual workflow 4 passed.
- Native startup/copy, CoWorker save/reload/manual, panel reload, operator hold/
  Restart, footer theme/width/scroll matrix and floating-notice clearance passed.
  Source note/body preservation and zero vendor dispatch are asserted.
- Initial complete CI: product and all 51 native tests passed; browser 220/226.
  Its six failures were stale tab-count/padding expectations and an unscoped
  inline/global-alert selector. Tests now assert the exact five tabs, actual
  opaque/flush footer geometry and both error regions with targeted dismissal.
  All original numeric/Axe/recovery checks remain; focused browser rerun 6/6
  passed (1.2m), with independent peer review. Production code is unchanged.
- npm run -s dev:obsidian -- --json: passed on pinned Obsidian 1.14.4 after reload;
  errors [], hostErrorCount 0, pluginConsole []. Contained sandbox only.
- Tokens passed (968 observed / 133 reviewed); Impeccable detector returned []
  across 22 Vue/CSS targets. Self-review/diff checks passed; current view
  catalogue/sitemap validates 110 views.

The complete gate found and verified fixes for admission FIFO ordering and an
earlier-save assignment race. Current assignments must have matching captures;
there is no fallback to a saved manual shadow. Existing integrity, recovery,
identity and no-dispatch assertions remain in the migrated tests.

## Evidence and limits

Evidence is untracked under reports/, including final-gallery, final-ui-quality,
final-native-suite-initial, final-native-targeted, final-summary-native and the
workflow increment evidence directories. No screenshot baselines were accepted.

No billable vendor request, live OBS/Twitch mutation, personal-vault launch or
CF-134 retry. Existing live Public exports remain uncommitted and untouched.
Herdr retains its existing 10k full-task guard; oversized tasks fail before
external commands, without truncation. Claude/Codex preserve full personas via
stdin and retain the existing read/write gates.

Local Node/npm: 24.20.0/11.21.1; CI uses pinned 24.21.0/11.19.1. The additional
style-literal audit reports ten existing values in unchanged generated palette
CSS; this increment adds no raw palette values or rule exceptions.

GitHub qualification uses the e2e label for the complete browser and real-host
jobs. Merge requires every check to finish green on the final head.

# Task: Qualify and polish the workflow workspace increment

- Status: done (implementation and local qualification; GitHub delivery tracked in PR)
- Journey: Workspace preferences, workflow configuration, per-feature execution
  and operator recovery, as recorded in BRIEF.md on 2026-10-31.
- Prerequisite: Initial panel, startup/reuse, CoWorker, settings/detail navigation,
  footer and Stop/Restart implementations have focused behavioral coverage.

## Purpose and scope

Complete the owner's requested second implementation pass with independent
reviews, targeted hardening and real browser/Obsidian evidence. Preserve canonical
notes, captured-run identity, host permissions and final review throughout.
Notifications are an additional explicit owner request in this polishing pass.
There are no declared req-* or vi-* IDs for these owner requests; invent none.

## Increment 1: Operator control and preserved-work recovery

Owner: workflow-defaults agent; peer: navigation agent; root reviews invariants.

- Persist Stop before aborting a child process, cancel queued attempts and return
  the card to Inbox. Failed writes must leave its previous state recoverable.
- Check ordinary, automatic, triggered, MCP, handoff and legacy entry points.
  Reload, startup Play, source edits, workflow replacement and acknowledgement
  must not release the hold; unrelated cards must continue normally.
- Restart is an explicit operator context-menu action. It starts at the first step
  with a fresh run ID, retains prior history and rejects unsettled/unknown effects.
- Late child results and independent workspace diff captures must retain evidence
  without moving a held card or silently replacing its stopped run.
- Expose preserved-change review from held Inbox details. Keep actual workspace,
  proposal and permission checks. Request changes retains the hold/history and
  provides a reachable route to a fresh run; approval remains explicit review.
- Proof: policy/engine/menu tests, failed-write and late-settlement cases, and a
  contained host right-click Stop → reload/Play → Restart journey.

## Increment 2: Notification clarity throughout the plugin

Owner: CoWorker agent; peer: root and navigation agent for detail integration.

- Inventory feature attention/recovery, workflow errors, inline notices, settings
  feedback and global toast renderers. Preserve their messages, actions and scope.
- Correct broad span rules that accidentally give icon spans the body's flex size.
  Establish a shared scoped icon/body/trailing-controls layout with explicit body
  classes, top alignment and predictable wrapping for long tokens and messages.
- Keep a clear title/body hierarchy, restrained native-theme severity treatment,
  visible keyboard focus and readable action/dismiss controls.
- The final visual batch found floating success notices obscuring detail Start
  and project Save/Discard controls. Reserve the measured visible action-footer
  area when positioning notices; wrapping/resizing must not reintroduce overlap.
- Use status/alert semantics appropriate to actual information/error messages;
  avoid repeated or conflicting live announcements. Keep existing dismiss/retry
  and recovery-consent behavior.
- Proof: first-failing semantics/action assertions, narrow/wide layout checks,
  dark/light screenshots and retained recovery controls in the real host. Avoid
  styling Obsidian notices belonging to other plugins.

## Increment 3: Configuration and detail navigation coherence

Owner: navigation agent; peers: startup/reuse and CoWorker agents.

- Confirm flat order: Idea Board Workflow, Step attempts, Timing & limits,
  Answer / output templates, Herdr. Update help text, navigation links and existing
  test helpers for the final information architecture.
- Keep one workflow editor/draft across definition and limits tabs; preserve
  dirty replacement consent, explicit save, failed-save drafts and validation
  focus. Template saves remain independent and never dispatch work.
- Restrict feature run/history/errors/manual and recovery controls to the selected
  request and its owning project. Test cross-project detail selection and avoid
  project-wide fallback or stale consent leaking across requests.
- Verify captured CoWorker name/revision/persona/config are displayed from the run
  rather than from the editable live catalogue. Manual switching uses the values
  shown; disabled/unavailable profiles have no fallback or added capabilities.
- Verify reusable workflows are independent copies, source note bytes remain
  unchanged, global CoWorker references survive, and project-owned template/team/
  Council references require deliberate repair before save where mandatory.
- Proof: focused product navigation/usability/draft tests, browser configuration
  journeys, and saved/reloaded workflow reuse and CoWorker host journeys.

## Increment 4: Startup readiness and preference boundaries

Owner: workflow-defaults agent; root supplies regression and oversees integration.

- Defer periodic Play until host services and recovery journals settle.
- Peer review identified another admission route: scheduler/event services became
  ready before Herdr recovery, and their dispatch can kick the engine directly.
  Root reproduced it with a held real-runtime recovery read. Start external MCP,
  scheduler and event admission after recovery, retaining unload guards and their
  existing missed-occurrence/uncertain-admission policies.
- Verify interrupted attempts are never replayed, unavailable projects remain
  paused, and saving/copying startup preferences does not immediately execute.
- Verify independent panel preferences, malformed/blocked localStorage, explicit
  expanded chat at narrow widths and automatic responsive defaults.
- Proof: runtime readiness and startup-disposal regressions, startup/panel focused
  suites, and host reload with Play/Paused and both pane choices.

## Increment 5: Footer geometry and bounded visual polish

Owner: root; notification/navigation agents integrate their respective surfaces.

- Reproduce both settings gaps with actual scroll-viewport measurements before
  fixing. Project footer must cover its status-bar reserve; native settings must
  remove only their own trailing host/workbench/form spacing.
- Check middle/end scroll positions, narrow/short and wide panes, dark/light themes,
  opaque surfaces and visible controls above any overlapping native status bar.
- Review the shipped screens together once, batch defects, then make at most one
  confirmation round. Check labels, wrapping, focus, empty states and recovery
  notices without creating a new visual language or unrelated feature scope.
- Run the Impeccable detector once on final changed UI targets, resolve actionable
  defects, run UI quality and review the generated gallery. Keep evidence untracked.

## Increment 6: Frozen qualification and delivery

Owner: root orchestrates; agents execute focused E2E and independent reviews.

1. Finish focused red/green tests, typecheck/lint and peer findings. Freeze source
   and tests before the long complete gate; reopen only for a concrete failure.
   Integrate newly landed main changes first: 18aec07 adds private prompt/response
   history. Preserve it with stopped runs and immutable CoWorker execution data.
2. Run verify:project with the documented process budget, UI quality and gallery,
   contained host smoke and real-host suite. Record real result lines and limits.
3. Self-review architecture, size limits, data preservation, event/write ordering,
   privacy, unsafe casts and the final diff. Preserve unrelated public exports.
4. Update task/evidence and the PR template. Commit/push the authorized branch,
   open a PR with full browser/host CI enabled and qualify the exact final head.
5. Merge only after every required check is green, without bypass or force push.
   Fast-forward the local main branch while preserving unrelated local changes.

## Execution evidence

- Initial footer regression: failed with project gaps 27/48px and native gaps
  64/101px at middle/end. Fixed contained-host test: 1 passed (8.58s).
- Runtime recovery/admission regression: 1 failed (scheduler ready before recovery).
- Runtime readiness/startup/disposal after repair: 12 passed, including late
  Herdr recovery reads after unload without revived timers or admission.
- Operator/Council/menu reliability: 35 passed. Post-main Stop/conversation
  integration: 7 passed; late responses stay on the original stopped job.
- Native operator Stop/Restart: 1 passed (20.26s); native source-independent copy/
  startup: 1 passed (9.81s), source note/body bytes unchanged, errors empty.
- Notification semantics regression: 2 failed, then 3 passed. Browser geometry
  matrix: 4 passed (35.3s); actual native notice: 1 passed (12.33s), fixed 16px
  icon / 8px gap at both pane widths, full recovery text retained.
- Native CoWorker assignment/save/reload/manual customization: 1 passed (14.98s),
  zero provider jobs and empty host errors.
- Footer confirmation: 1 host test passed (11.12s), both surfaces, middle/end
  scroll, wide/narrow sizes and dark/light themes. Buttons remain contained and
  clear the status bar; screenshots reviewed.
- Peer findings fixed with first-failing proofs: stale assigned-provider readiness,
  misleading pre-run Simulation labels, Codex dock/history labels, request-scoped
  consent/errors, and valid detail dialog semantics.
- Final toast/footer correction: first-failing placement regressions, then 8
  placement/semantics tests passed, including a real foreign-window geometry and
  cleanup case. Actual native confirmation passed (9.98s): six feature/project
  theme/width cases, wrapped 239px footer, 8px clearance and real dismissal.
  Root's second visual batch confirmed primary actions and close/dismiss controls
  remain visible. The visual polishing pass is closed.
- Whole native suite: 49/51 tests passed across 44 files (534.83s). Its only two
  failures were a stale four-tab test and active Alerts validation text contrast
  (4.2:1 against the required 4.5:1). The tab test now asserts exact five names/
  order plus fit/row spacing/bounds. Readable severity text derives from native
  error/foreground tokens, leaving native icon/border tokens intact.
  Both repaired native cases passed (39.62s), retaining all Axe rules and checking
  active validation in both themes. Initial full-suite and final targeted evidence
  are preserved separately; no failing assertion was suppressed.
- Final UI quality after the contrast correction: 8 passed (1.1m). Regenerated
  final gallery: 40 captures, failures empty, reviewed wide dark/narrow light.
- Impeccable detector: [] across 22 changed Vue/CSS targets. Tokens: passed,
  968 observed / 133 reviewed. Source lint: passed, 1868 files. Self-review
  heuristic: no findings in 152 changed files; manual peer reviews completed.
- Additional style-literal audit reports ten existing raw palette values in
  unchanged generated design-system/colors.css; no new palette literals or
  policy/threshold exceptions were introduced for this increment.
- First complete verify:project: typecheck/lint/ESLint/maker types passed; product
  suite reported 1527 passed, 8 failed, 6 existing skips (873.8s complete gate).
  Four old settings-monitor UI test files needed the new request-detail routes.
  Their original integrity, identity, Council history and retry checks remain.
  A genuine omitted per-run summary was restored through a shared pure-props
  component: scoped MCP/client-call/native configuration stays visible in details,
  while project automation controls and its own summary stay in settings.
- The full gate also exposed a real manual admission FIFO regression. CoWorker
  preparation now awaits only actual assignments. An independent peer found the
  related queued-save race; current assignments must match captured step/profile
  IDs before admission, including manual-first workflows, preventing fallback.
  Existing asynchronous source/proposal/project and operator-release guards remain.
  Focused admission/assignment/engine/Stop: 30 passed; typecheck and lint passed.
- Final detail/test migration proof: 9 files / 27 passed plus the explicit control
  boundary case. Browser: 6 passed (1.2m), including execution Axe/reflow. Fresh
  native detail/Activity/Council/manual-workflow group: 4 passed (74.23s).
  No provider calls or source edits occurred during these qualification runs.
- Final frozen-source verify:project passed: 5/5 check stages, 0 failed (871.4s);
  product suite 1536 passed / 0 failed / 6 existing Windows/platform skips.
  Release build passed; prototype embedding 1 passed. UI effects explicitly skip
  because this project declares no visual definitions.
- Final contained smoke passed on pinned Obsidian 1.14.4 after reload: errors [],
  hostErrorCount 0, pluginConsole []. No personal vault was opened.

## Closeout

All implementation and delegated polishing increments were executed and locally
qualified. The gallery covers top-level Workspace/Preferences surfaces; nested
workflow/drawer changes have separate targeted browser/native evidence. No
screenshot baselines, lint rules, test thresholds or integrity assertions were
weakened. CI and merge results are tracked in the PR, which must remain unmerged
until every check is green on the final head.

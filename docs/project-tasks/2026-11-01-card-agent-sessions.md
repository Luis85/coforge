# Task: Inspect agent sessions from an Idea card

- Status: implemented; final aggregate and merge qualification tracked in the pull request.
- Journey: Idea card → Sessions → live read-only Peek or terminal follow.

## Why

Operators can inspect captured inputs and final responses, but cannot see useful
live activity while a native workflow agent is working. Provide visibility into
the existing attempt without starting another invocation or administering its
native assistants.

## Traceability

Owner approved the proposed Sessions list, live Peek and read-only terminal
follow on 2026-11-01. `design/traceability.json` has no declared req/vi obligations;
this enhances the existing board, execution and evidence contracts.

## Acceptance

- A private card opens its Sessions drawer, showing current and previous parent
  attempts with truthful status, provider/model and timing. Running counts refer
  to observed parent attempts, not an invented native-child total.
- Peek updates from bounded sanitized public provider messages/tool activity and
  actual verification output before the attempt completes. Native assistants are
  nested only with observed provenance; unavailable/tool-linked IDs are explicit.
- Rendering is literal, keyboard accessible and usable at narrow/wide widths in
  light/dark themes. Reading older entries pauses auto-follow with unread/resume.
  Selection and subscriptions do not leak across projects or disposed views.
- Terminal follow reads the same private sanitized attempt feed; it accepts no
  agent input or arbitrary command/path. Unsupported hosts fail with useful help.
- Failed observation cannot alter provider results, ownership, recovery or replay.
  Reload retains recorded observations; legacy/unavailable capture is honest.
  Model and public projections exclude the new private observations.

## Plan

1. Root: bounded trace and persistence contracts, foreground wiring, privacy,
   verification output, integration and full release qualification.
2. Provider agent: incremental provider event decoder and foreground/native
   streaming with no change to auth, model, tools or result validation.
3. Engineering agent: durable observation journal and native terminal follower.
4. UX agent: card/drawer/Peek, behavioral tests, contained native UI and polishing.
5. Self-review, commit/push, PR and merge after required checks pass.

## Out of scope

Interactive attach/resume/takeover, agent input, child-job administration, raw
SDK/global-rollout browsing, additional provider authority or new dependencies.

## Evidence

- Bounded trace: three behavioral tests failed, then passed.
- Foreground observation/persistence: two behavioral tests failed, then passed.
- Root observation/persistence/MCP/verification focused batch: 18 passed. Private
  transport/feed isolation batch: 11 passed; verification text/label privacy: three
  passed, including red/green line-wrapped token and broad-root feed regressions.
- Provider final batch: 55 passed; final privacy/truncation follow-up: 36 passed.
  Independent cross-review found no remaining execution-authority/privacy blocker.
- Installed Claude 2.1.281 fixture API canary: one loopback request, 6.52s, live
  observations before CLI close, genuine structured result preserved. Installed
  Codex 0.145 fixture API canary and recorded Claude child-stream replay passed.
  No paid inference or real credentials were used for these canaries.
- Terminal/worker focused batch: 24 passed. Final terminal suite: nine passed.
  Genuine Windows visible/live follower fixture passed with observer stopped and
  private feed removed. Captures include only the owned synthetic terminal window.
- Native Sessions spec: one passed (16.25s); eight parent/child captures reviewed
  at 1440/760 widths in light/dark, strict 1px Resume/focus/literal-text/note-byte
  assertions and no host errors. Fixture data is explicitly synthetic historical
  evidence; no provider or terminal was dispatched by that UI spec.
- Native qualification exposed queued keyboard-scroll interference with Resume.
  A persistent toggle and bounded frame settling fixed it without weakening the
  end-position assertion; new user intent still pauses immediately.
- Final UI-focused batch: seven passed. Typecheck, changed-source ESLint (67
  files), source lint (2,192 files), detector and diff checks passed. UI quality,
  gallery refresh, pinned load/reload and final full/CI outcomes are reported in
  the pull request. Local Node is 24.20.0; CI uses pinned 24.21.0.

## Untested scope

No actual CF-133/CF-135 run or personal vault will be used for qualification.
Terminal follow currently supports Windows desktop; other platforms use Peek.
Local Docker execution was not run in this increment. The mandatory Linux Docker
CI suite includes an additional live-output test that verifies the container is
still running when sanitized observations arrive; no skipped acceptance is used.

Final UI refresh passed: UI quality 8/8, gallery 40 reviewed captures with zero failures, and pinned Obsidian load/reload passed with errors [], hostErrorCount 0 and pluginConsole []. The contained host stopped. Evidence is retained under reports/card-sessions-dev-loop/.

## Integrated qualification follow-up

PR #64 incorporates main PR #63's polishing feedback/card alignment. Combined
Sessions/polishing DOM coverage passed 20/20; four browser cases passed and all
20 captures were reviewed. An Axe label-content mismatch was fixed by including
the visible parent count in the Sessions accessible name.

Initial integrated CI found four catalogue assertions blocked by the missing
authored Sessions view contract, one native five-tab expectation and two browser
five-tab expectations. The authored child contract and regenerated 111-view
sitemap now validate; the existing catalogue suite passed 12/12. Exact six-tab
names/order/count assertions retain the original geometry/ownership checks;
affected DOM tests passed 13/13 and the browser journey passed 2/2. No assertion,
threshold or coverage was removed.

The first local full aggregate recorded 2,080 passes, six existing Windows skips
and five failures: the four catalogue cases plus a 45-second timeout in unchanged
native Git/EOL code. A quiet rerun of that case passed in 14.01s at its original
limit; the integrated Linux CI case had also passed in 274.72ms. The failed local
run is retained, and final full integrated CI plus cached Windows-native checks
are reported in [PR #64](https://github.com/Luis85/coforge/pull/64).

# Independent stabilization review

Reviewer: separate second-pass agent. Scope: changed runtime lifecycle, task navigation,
state/draft ownership, private/public boundaries, catalogue generation and maintainability.
This pass inspected source and regression assertions; it did not rerun the owner's full
test suites or qualify live integrations. The parent task records executed gates.

## Findings and improvement pass

| ID | Priority | Scenario and consequence | Requested correction / status |
| --- | --- | --- | --- |
| I1 | P2 | After selecting Bot messages or Twitch settings, Stream studio's **Open stream chat** called only `navigate('stream')`, returning to the previous subpage instead of the named conversation. Related Community/Viewers chat shortcuts had the same ambiguity. | Closed. Broadcast, Community and Viewers now select `openStreamTool('channel')`. The behavioral regression starts on Bot messages and verifies the conversation destination. Contextual moderation tests cover both previous settings/messages pages. Guarded workflow shortcuts similarly select run monitoring; dirty configuration prevents changing either destination or subpage. |
| I2 | P2 | Execution designation moved to Run monitor, but a fresh desktop can still complete submission preflight and meet disabled Submit/Simulation/Inbox actions without a visible explanation or route to that prerequisite. | Closed. A non-executor prerequisite notice explains designation, links to **Open Run monitor**, and states that execution stays paused until resumed. The non-executor regression follows that action and verifies no designation, admission or run occurs merely through navigation. |
| I3 | P3 | Definition folders became a dedicated page, but its root `details` remained collapsed on entry. Other extracted Music/Public displays/Herdr pages open their task content immediately. | Closed. The dedicated page passes `open` to its folder details. Regressions verify the field is immediately visible, its edited draft survives switching to monitor and back, no configuration is saved implicitly, and execution remains paused. |

The journey owner also identified and repaired contextual moderation routing to Chat,
and applied the same explicit-destination principle to request/help workflow links
that must reach run monitoring rather than a retained Herdr administration page.

## Reliability and data boundaries inspected

- Council startup checks disposal after preferences and journal loading. Source observation
  checks disposal after source indexing and watcher configuration. The caller receives its
  cleanup and immediately invokes it when unload happened during asynchronous
  cleanup handoff. This closes both the late-listener and interval-handoff scenarios shown
  by `runtime-startup-disposal.test.ts` without allowing execution after unload.
- New broadcast/chat/workflow subpages preserve mounted models with `v-show`; changing
  a task does not configure OBS, invoke a provider, send a chat message or accept code.
  Dirty project configuration still uses `navigate` guards before task-specific helpers
  change local page selection. Council definitions and workflow drafts remain in their
  existing per-leaf stores.
- Private views retain the existing host/application actions. Public capture roots still
  receive only `StreamSurfaceSource`, not studio context or mutation capabilities. The
  public projection remains an explicit allowlist, with screened requests and live-channel
  chat filtering. No change adds prompts, vault paths, credentials, financial records,
  moderation controls or Council transcripts to public output.
- The changes do not alter canonical note serialization, stable IDs, provider access
  grants, immutable run snapshots, post-write events, unknown-outcome recovery or final
  streamer review. The Council cost projection remains a private aggregation over the
  same retained runs after its move to runtime composition.
- The catalogue is authored in frontmatter/Markdown and regenerates deterministic
  Markdown/JSON. Validation checks required task fields, source existence, local links,
  unique identities/routes, parent graphs, live navigation coverage and output freshness.
  Regex adapters deliberately fail when source contracts become unreadable or empty;
  semantic goal accuracy still requires review. The generator is product-scoped tooling,
  not an additional runtime router or publication service.
- Shared page frames replace competing CSS gutters and use leaf-width container queries.
  Specialized board/capture layouts remain distinct. Native buttons, current-page state,
  focus-visible outlines and accessible names provide testable UI seams.

## Verdict and qualification limits

Source-review verdict: ship within this stabilization scope. I1–I3 are closed after
reopening the source and regression assertions. No additional P0/P1 security, privacy,
data-preservation or architecture defect was identified in the reviewed diff. The
numeric-timer Council handoff regression now uses an injected `Timers` implementation
and checks that unload clears the registered interval and leaves the module unready.
The parent reports the focused behavior tests passing; this independent pass did not
rerun them. Final canonical, browser, catalogue and native-host qualification remain
separate merge gates. A passing mechanical check cannot by itself establish semantic
documentation completeness or visual quality.

Real Obsidian was unavailable locally in the parent task; native CI must supply that
qualification. Live Twitch/OBS/Claude/Herdr behavior, external game repositories and
production-vault scale remain outside this source review. New `v-show` pages retain
existing models rather than introducing new background workers, but this pass did not
benchmark rendering or memory at production scale.

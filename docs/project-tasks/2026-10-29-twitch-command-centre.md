# Task: Run Twitch channel operations from CoForge

- Status: implementation complete; final qualification and merge tracked in [PR #39](https://github.com/Luis85/coforge/pull/39).
- Journey in `BRIEF.md`: Twitch integration increments approved 2026-10-29.

## Why

Streamers need channel activity, moderation, engagement, content and stream review in
their existing CoForge workspace, with honest API availability and recoverable actions.

## Traceability

- `design/traceability.json` currently declares no requirements or interaction IDs.
- This task and the owner decision in `BRIEF.md` record the additional acceptance scope.
- Existing generated obligations are not changed or invented.

## Acceptance

- Permission-aware datasets and action forms show source freshness, missing scopes,
  eligibility and app ownership. Feature authorization requests only selected scopes.
- EventSub activity is channel-bound and deduplicated, with acknowledgement, collection
  gaps and private bounded retention. Existing chat intake/removal semantics survive.
- Operator actions preview exact channel and parameters, persist intent before sending,
  serialize mutations and hold uncertain effects across reload without automatic replay.
- Moderation includes chat modes, AutoMod, blocked terms, warnings, Shield and appeals;
  ads and raids expose current state and guarded operations.
- Rewards/redemptions, polls/predictions, audience/roles/goals, clips and markers have
  working reads/actions where Twitch permits them, with actionable unavailable states.
- Private reports combine retained Twitch evidence with existing stream history. Local
  schedule publishing is explicit and includes only public schedule fields.
- UI drafts survive failed actions; keyboard, narrow-leaf and theme states are usable.
- No credentials, private scripts, raw provider errors or private project content are
  exposed to public views or exported as public data.

## Plan

1. Core subagent: catalogue, validation, durable operation lifecycle and private state.
2. Adapter subagent: official Helix contracts, progressive authorization and EventSub.
3. UI subagent: private Twitch operations tasks, forms and navigation.
4. Root: composition, OBS coordination, integration/E2E and contained-host verification.
5. Independent review, bounded visual polish, required local/CI gates, PR and merge.

## Coordination

- OBS chat: `01a188f4-1817-7983-9a04-872cfcd20e0e`, branch
  `codex/obs-stream-studio-overhaul`, worktree `73d5`, base `220d208`.
- OBS owns production adapters, scene/output/audio controls and OBS studio views.
- Shared contracts/persistence/runtime/navigation changes stay additive. The second
  qualifying branch merges latest main and requalifies the combined result.

## Evidence

- `npm ci`: added 691 packages; audited 692; 0 vulnerabilities.
- Maker inventory reviewed. This extends the existing CoForge feature and does not
  introduce an unrelated generated native example feature/view.
- Independent core/API/controller and UI reviews added adversarial account/scope,
  reward-ownership, uncertain-outcome, recovery, unload and stale-response regressions.
  Targeted review suites passed 33/33 and 34/34 tests; the final dataset-selection
  regression reproduced an incorrect selected option and passed after the keyed-select fix.
- `npm run test:ui-quality`: 8/8 passed. Initial focused Twitch browser checks: 4/4
  passed. `npm run ui:gallery`: 40 captures, with representative desktop/light and
  narrow/dark views reviewed. Final visual confirmation captured eight Twitch views.
- Impeccable detector returned `[]`. Polishing clarified reward constraints, confirmation
  focus, receipts, scoped consent, ad freshness, raid previews and private report coverage.
- Pinned real-host focused test: 1/1 passed. Full native CI: 24 files / 31 tests passed.
  Fresh smoke: `status: passed`, `errors: []`, `hostErrorCount: 0`, `view.opened: true`.
- `npm run verify:artifacts`: exit 0; release build completed and prototype embedding
  passed 1/1. Generated UI-effect checks explicitly skip because no visual definitions exist.
- Initial full CI product tests, typecheck, ESLint and maker types passed; one oxlint
  redundant-spread warning was corrected without disabling rules. Full browser CI passed
  193/199 and identified timer definition-list semantics and short navigation overflow;
  both were corrected while preserving the same accessibility/layout assertions.
- Local broad checks hit their 600-second budgets under concurrent desktop work. Local
  full browser qualification also encountered unrelated journey timeouts and was stopped;
  exact-head full project/browser/native qualification remains mandatory in PR checks.
- The local browser rerun uses an ignored configuration on port 4192 to avoid the OBS
  session's 4181. It preserves the committed checks, browser, viewport matrix and timeouts.
- The isolated rerun passed all 6/6 browser regressions. Pinned CI at `8a665f1` passed
  the full project gate (5 passed, 0 failed, 0 skipped), release build/prototype embedding,
  all 199 browser checks, and all 31 native cases. Final exact-head checks remain linked
  in PR #39 rather than being inferred from earlier runs.
- Final correctness regressions reproduced stale sampled stream IDs overwriting newer
  EventSub facts and ad-management grants incorrectly implying ad-read permission.
  Both are fixed; API, core, events and controller suites passed 59/59 tests afterward.
  The permission alternatives are shared by capability projection and the HTTP adapter.
- PR #38 was superseded by a clean reviewed diff after GitGuardian flagged an intermediate
  `URL.password` validation expression as a generic password. No credential existed;
  explicit URL checks preserved behavior. PR #39's security scan passed without exclusions
  or force-pushing, and the original branch remains available.

## Untested scope

Live-account approval and real Twitch mutations require streamer-operated acceptance.
Always-on collection and unsupported Creator Dashboard data remain outside this increment.
The optional local maintainability command returned `METRIC_TOOL_VERSION`; required CI
gates retain their pinned tools and existing thresholds. Local broad runs and toolchain
differences above are not represented as passing local qualification.

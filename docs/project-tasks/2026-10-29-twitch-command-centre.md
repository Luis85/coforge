# Task: Run Twitch channel operations from CoForge

- Status: in progress
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

## Untested scope

Live-account approval and real Twitch mutations require streamer-operated acceptance.
Always-on collection and unsupported Creator Dashboard data remain outside this increment.

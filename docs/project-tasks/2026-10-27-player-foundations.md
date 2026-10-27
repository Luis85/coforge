# Task: Player onboarding, population, economy and operations

- Status: done
- Journey: a viewer is greeted, registers, participates within intake limits, earns evidenced rewards,
  and can be managed by the streamer from the plugin.

## Why

The chatbot needs persistent player identity and participation rules. The streamer needs an accurate
population view, moderation controls, explainable balances and operational statistics.

## Traceability

Owner decisions in BRIEF.md; backlog notes Twitch Bot (2), Twitch Integration (5), Community (10),
The Hood (1). No generated requirement/vi obligations are declared in design/traceability.json.
The entity maker was previewed: a generic registry domain would duplicate the existing canonical
StudioStore aggregate. This iteration extends that aggregate and its persistence instead of creating an unused registry entity.

## Acceptance

- Stable provider IDs survive renames and restarts; registration is idempotent and never resets balances/restrictions.
- Unregistered/blocked players cannot submit features, bugs or votes. Greetings and replies are durable and bounded.
- Feature cooldown is 300 seconds across projects, survives reload, and starts only after a successful new request.
- Population supports search/filter, player details, stats and confirmed block/unblock, timeout/unmute, ban/unban.
- Twitch restrictions distinguish confirmed, failed, stale and uncertain results; no automatic moderation replay.
- Live chat-presence credit uses complete consecutive samples; no offline/restart/network-gap backfill.
- Economy defaults follow owner values; contribution rewards cannot be replayed through retry, re-screen or external note edits.
- Durable operational records/statistics and reward history are bounded, truthful and free of raw chat, tokens, paths and error causes.
- Technical diagnostics use the framework logger/catalog; exported diagnostics contain safe aggregates only.
- Existing canonical notes, player history and prior public-board privacy boundaries remain intact.
- Recurring stream messages have editable text/minute intervals, pause/activate controls, live-only scheduling,
  shared durable delivery and no catch-up bursts after offline time or reconnects.
- Community settings define actor/currency names (Agent/gold defaults), earning rates and a validated named XP rank ladder.
  Saving preserves balances; invalid drafts remain editable and are protected during navigation.
- Application services use explicit delivery, moderation and presence ports; immutable named events are published only
  after successful writes, with observer failure isolation and owned lifecycle cleanup.

## Plan

1. Failing registration, cooldown, rewards/presence and moderation tests; extend canonical state with migration defaults.
2. Add chat onboarding and policy, population/economy application contracts, Twitch presence/moderation integration and diagnostics.
3. Add population and operations UI, browser/native journeys and empty/error/narrow states.
4. Review product behavior, UX/accessibility, reliability/data integrity, security/privacy, economy/abuse and operations.
5. Record findings, implement the improvement/polishing pass, rerun affected checks and complete full verification.

## Out of scope

Spawning/controlling game actors, shop purchases, fabricated viewing time, live-channel test posts/moderation by the agent.

## Evidence

`npm run verify:project`: all five check steps passed, zero failures, 410.4s; production build transformed 1242 modules
and finished in 4.59s. Product tests: 145 passed, five existing Windows-only skips. `npm run test:e2e`: 24 passed (2.1m).
`npm run test:ui-quality`: 8 passed (1.6m). `npm run ui:gallery`: 40 captures generated and representative views reviewed.
Static design detector: `[]`; `git diff --check` and changed-file size checks found no violations. The narrowed consumer
facade received an additional successful typecheck. Local Obsidian is not provisioned; nothing was downloaded/launched.
Final product suite: 147 passed, five existing Windows-only skips. Code head `e82876d` passed CI: all five project gates
in 80.4s, all 24 browser checks in 38.9s, root-install byte checks and the community-review mirror (16 pass, 0 warn, 0 fail).
Contained Obsidian: six tests passed across five files; reload/dev loop status passed with zero plugin errors/console entries.
The dev loop's optional view probe reports the existing empty-tab-group host diagnostic; separate native tests verify
actual view rendering and reload. CI evidence and final-head results are linked from PR #11.
Live-channel acceptance remains user-operated.
The review and concrete follow-up changes are recorded in `2026-10-27-player-foundations-review.md`.

# Task: Retain a JSON history for each stream

- Status: implemented; final CI evidence in [PR #18](https://github.com/Luis85/coforge/pull/18)
- Owner decision: minute samples while live, including follower/subscriber totals and their additional permissions.
- Generated requirement/interaction IDs: none declared.

## Acceptance

One versioned JSON object per broadcast in the private vault, containing timestamps and an ordered sample
array. Capture viewers, metadata, followers, subscribers/points, Twitch chat counters, CoForge requests/votes/
registration/economy, bot/moderation counters and OBS output/performance health. Retain source status and null
for unavailable values. Record an initial sample, then one per minute while live; no duplicate minute or backfill.
Resume after reload without resetting stream baselines; separate broadcasts and channels. Stop after confirmed
offline. Bounded provider calls, owned timers, serialized writes and atomic file replacement/recovery. History
and JSON export available in Stream studio. No raw chat, viewer identities, credentials, note text or private
project paths in these metric files. Totals are observations, not revenue or verified video watch time.

## Verification

Test fake-clock live/offline/reload and concurrent capture; provider failures/nulls; totals/scopes; atomic file
failure/recovery; UI export/offline states; real contained Obsidian writes. Complete full checks and review before merge.

- Recorder/storage/provider tests: 3 files, 9 passed (1.48s), then a filename/identity safety regression added.
- Focused storage/provider final checks: 2 files, 6 passed (4.06s).
- `npm run verify:project`: 5 passed, 0 failed, 0 skipped (238.3s); 1268 production modules, 3.87s.
- `npm run test:e2e`: 29 passed (3.1m); `npm run test:ui-quality`: 8 passed (1.3m).
- UI gallery: 40 captures; dedicated guide and Stream studio evidence reviewed. Native JSON read/export is in
  contained Obsidian CI; no public OBS stream or live audience data was used in agent QA.
- Final permission review: only `channel:read:subscriptions` is added. The followers endpoint supplies total
  counts with existing channel access, so private follower-list permission is not requested.

See [[docs/coforge/STREAM-METRICS]] for the schema, scope, units, missing-data semantics and persistence seams.

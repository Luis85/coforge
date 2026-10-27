# Task: Retain a JSON history for each stream

- Status: in progress
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

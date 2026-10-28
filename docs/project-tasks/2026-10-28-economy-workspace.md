# Task: Configure community earning, command prices and rewards in one Economy workspace

- Status: implemented; parent integrated/native/CI qualification in progress
- Journey in BRIEF.md: channel-wide community participation, virtual currency and explicit owner-managed rules.

## Owner decisions

Every command can have a configurable currency fee, including help and registration;
zero is allowed. Failed, rejected and duplicate semantic operations receive no
charge or reward. Currency comes from truthful tracked live chat presence, including
observed unregistered profiles; there are no automatic initial credits. Subscriber
premium is a total per-minute currency rate replacing the base. Defaults preserve
the old earning rate and zero command fees/bonuses.

The owner also requested virtual currency/XP/reputation rewards, manually fulfilled
perks, weighted loot boxes with visible odds and a manual fulfillment queue. Real
game or physical fulfillment must never be represented as automatic.

Both command bonuses and currency purchases are supported. New catalog commands are
`!shop [page]`, `!odds <box-id> [page]`, `!redeem <reward-id>` and `!lootbox <box-id>`.
Purchase price and command fee add together; bonus/prize awards ignore catalog prices.

## Observed income and subscription evidence

Every observed Twitch participant is included in complete presence/restriction
snapshots before earning, including unregistered profiles. Currency accrues for
eligible observed presence; registered XP uses independent counters without retroactive
credit. This is chat-presence evidence, never a claim to identify anonymous video viewers.

Premium uses only complete filtered current-channel subscription evidence. Positive
and negative results are cached privately for at most 90 seconds and reset on reconnect
or channel change. Missing permission, failed/incomplete responses or stale evidence use
base income with explicit tracking copy. Independent reads use bounded concurrency;
no partial restriction response can authorize earning or unban a player.

Official contracts checked: [filtered subscriptions](https://dev.twitch.tv/docs/api/reference/#get-broadcaster-subscriptions)
and [filtered restrictions](https://dev.twitch.tv/docs/api/reference/#get-banned-users).
The review found and fixed the existing restriction lookup's omitted `first=100` and
ignored pagination, which could miss banned users beyond the default page size.

Root focused evidence: subscriber endpoint 10 assertions went red before implementation;
cache and preregistration/premium integration also went red. Final API/cache/tracker group
**5 files / 26 tests passed (27.56s)**; bounded read concurrency plus legacy economy group
**2 files / 4 tests passed (2.93s)**. The latter exercises 1,001 selected IDs, complete
results, a maximum of four in-flight reads per helper, failed batches and stale reads.

## UI plan

One Community/Economy main destination owns focused command pricing, earning,
reward, loot-box and fulfillment tasks. Forms use real backend contracts, explicit
saves and draft preservation on failure or stale configuration. Public catalog and
odds are separate from private fulfillment and account evidence. Navigation never
executes a command, transfers currency or grants a reward.

## Acceptance and evidence

- First behavioral navigation assertion is in `economy-navigation-ui.test.ts`.
- Pure configuration/getSnapshot/manual-fulfillment application seam is implemented with persisted optional EconomyState, strict validation, exact configuration identity, post-commit operation facts and revision-guarded manual fulfillment. Getter defaults do not mutate data.
- Final focused unit group: **5 files / 19 tests passed (9.07s)** for Economy configuration, UI/navigation and privacy API/reply races. Late fulfillment-note preservation regression: **1 file / 6 tests passed (23.01s)**, including repeated/switching queue actions preserving the original note and captured revision.
- Final browser: **4 cases passed (1.8m)**, covering light/dark command fee and benefits, base/subscriber total rates, catalog authoring, exact 1:3 odds, local purchase/manual perk, fulfillment and all five local pages with Axe/reflow checks. Evidence: `reports/economy/{commands,earning,rewards,lootboxes,fulfillment}-{light,dark}-{1280,480}.png` (20 images), inspected at wide and narrow sizes.
- Actor-cost final CSS/browser regression: both themes passed (9.2s/6.0s); screenshots under `reports/agent-costs/`. The initial combined batch had a stale Economy sidebar selector, corrected to the actual Idea board label. A subsequent all-in-one Economy case exceeded the unchanged 30-second budget; splitting semantic and visual cases preserved every assertion and timeout.
- Canonical views added: economy, economy-commands, economy-earning, economy-rewards, economy-lootboxes and economy-fulfillment. Catalog regeneration and coverage check report **85 views documented; navigation coverage valid**. Source gate passed **3056 inputs, 226 translated keys** before the final same-file note guard (no new input files).
- Review repairs: typed recursive configuration copies survive Vue proxy arrays after remove/change operations; configuration copy errors are caught; duplicate reward entries aggregate effective odds; Community saves preserve the latest Economy base rate; Economy fieldset CSS no longer collides with Community grids; shop affordability results and queued replies bind public project references; cleanup discloses local Economy receipt/perk counts.
- Browser preview has no durable random reservation port and therefore rejects actual box openings without committing effects. Native Economy coverage exercises the production secure reservation adapter. The browser test buys a deterministic manual perk and authors/reviews weighted odds; it does not pretend to prove a production random draw.
- Parent owns full verify, UI quality/gallery, contained Obsidian and exact-head CI results. No full-gate success is inferred from these scoped checks.
- Final owned-runtime scoped ESLint returned exit 0 with no output (`reports/economy-final-runtime-lint.txt`); `git diff --check` was clean. The self-review check plan exited 0 and selects the full project gates for this combined diff.

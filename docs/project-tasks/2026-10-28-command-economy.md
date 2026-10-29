# Task: Charge and reward successful viewer commands exactly once

- Status: implemented; final integrated qualification and native execution pending with the parent task.
- Journey in BRIEF.md: Community economy owner decisions, 2026-10-28.

## Owner contract

Every recognized command, including help and registration, may have a nonnegative currency fee and optional currency/XP/reputation, reward, or weighted lootbox benefits. Defaults remain free with no command benefits. Failed, restricted, rejected, and semantic duplicate operations receive no fee or reward. Catalog purchases add their item price to the command fee; bonus grants ignore purchase prices. Currency funding comes from observed LIVE chat presence, including unregistered profiles, without automatic starting balances. Presence XP remains registered-only and never backfills pre-registration intervals. Subscriber premium is the TOTAL currency rate replacing base; absent, stale, incomplete, or wrong-channel evidence uses base.

Viewers discover purchases through `!shop [page]`, inspect aggregate effective outcomes through `!odds <lootbox-id> [page]`, and explicitly acquire rewards with `!redeem <reward-id>` or `!lootbox <id>`. Virtual benefits update accounts; manual perks create private fulfillment records. No external perk delivery is automated.

## Implementation and safety review

- `domain/command-economy.ts` declares strict versioned configuration, usage, award, fulfillment and reservation contracts. Definition validators reject missing references, duplicate rule assignments, negative/unsafe quantities and zero-total boxes. Repeated outcome rewards aggregate their effective odds.
- `application/command-economy.ts` settles within the awaited StudioStore FIFO after privacy and semantic checks. Insufficient funds restore the pre-operation state before recording rejection, so IDs, notes, registration, votes, contexts and cooldown effects do not escape. The wallet is checked before awards, so a command cannot fund its own fee.
- Native durable reservations precede effect commits. A frozen definition, ticket and outcome survive proven note/state rollback and configuration changes, including catalog removal. The runtime checker binds the selected reward amounts to the captured rules. Settlement also binds event key, stable usage ID, actor, source and channel. Invalid or uncertain evidence fails closed without a fresh roll.
- Architecture's native atomic journal stages exact note bytes and authoritative state together, holds the publication lease through recovery, and preserves divergent human edits. It also covers note-backed contribution rewards. Ordinary chatter avoids this recovery-journal cost.
- Successful request-backed economic changes add durable privacy claims. Public raw progression stays hidden after a project becomes private even if readable usage history has been trimmed. Fixed public rule deltas remain visible; private-progress fee failures receive generic account guidance. Public board projection remains an explicit whitelist without accounts, receipts, fulfillment notes or reservation evidence.
- Catalog replies paginate by actual rendered character allowance, retain complete IDs, prices, weight fractions and percentages, and reserve room for settlement summaries. Display labels shorten visibly. Complete receipts remain in the operator's private Economy history. Maximum-length transport tests verify that every advertised page arrives without silent clipping.
- Proven simulator receipts and perks are removable unless tied to a retained canonical real request. Cleanup aggregates signed effects per retained simulator profile and clamps once, preventing earn/spend reversal from minting residue. Ambiguous/real ownership, replay tombstones and private draw reservations remain. Preview counts and stale guards include Economy facts.
- `application/economy.ts` separates registered XP time from currency time. Fresh current-channel subscriber evidence selects the replacement premium rate. Root owns strict native filtered subscription reads, bounded current-connection cache, restriction checks and tracker integration. Build owns configuration/getSnapshot/fulfillment APIs and all five Economy UI pages.

## Verification

- Integrated backend group: `npx vitest run` for command-economy, command-economy-boundaries, command-economy-cleanup, economy-presence-rates, economy-reply-budget, existing economy, population and example-cleanup: **8 files, 30 tests passed (1.45s)**. After the final generic private-account guidance assertion, boundaries alone: **6 tests passed (781ms)**.
- Existing chat, bug commands, request context, viewer help and project privacy plus command/cleanup regressions: **7 files, 20 tests passed (1.38s)**. The first replay regression found the durable tombstone branch omitted the original Idea ID; preserving the existing processed-message path before fallback fixed it.
- `npm run typecheck`: exit 0 after the integrated configuration/Studio API graph was installed, before final reply-budget refinements. Parent owns the final full graph check.
- `npm run check:source`: passed with **3050 inputs and 226 translated keys**, before the last new reply-helper/test. Parent reruns source limits.
- `git diff --check`: passed during qualification.
- Initial plain `npx eslint` could not find the repository's nondefault config; corrected scoped invocation with `-c configs/lint/eslint.config.mjs` on the 12 owned domain/application/test files passed with exit 0 and zero warnings.
- Added contained native spec `tooling/tests/obsidian/coforge-economy.obsidian.ts`: configure via real UI, reject unfunded registration, earn explicitly configured help benefits, pay registration and catalog prices, capture a weighted draw, reload without repeating registration effects, record manual fulfillment and reload again. Native execution is not claimed here; local Obsidian was not provisioned and parent owns the final native CI gate.
- Build's UI/browser evidence, Root's subscription/tracker tests, and Architecture's native reservation/journal fault tests are reported independently rather than counted as this group's executed tests.

The subscription adapter uses the official [Get Broadcaster Subscriptions contract](https://dev.twitch.tv/docs/api/reference#get-broadcaster-subscriptions) and existing accepted [channel:read:subscriptions scope](https://dev.twitch.tv/docs/authentication/scopes/): filtered current-channel user IDs only, never display-name inference.

## Remaining integrated qualification

Run the repository's full checks, UI quality/gallery and serialized browser suite; run the contained native Economy spec where Obsidian is provisioned. The parent task owns PR update, CI qualification and merge. No commits or pushes were made by this subagent.

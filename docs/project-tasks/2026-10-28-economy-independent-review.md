# Economy independent product and reliability review

- Reviewer: architecture/execution/storage agent, independently reviewing Stream/Build backend and root Twitch income work.
- Scope: command settlement, captured receipts, configuration, catalog/chat output, manual fulfillment, cleanup, subscriber evidence and income persistence.
- Qualification: focused tests below; full project/host qualification remains parent-owned.

## Findings and follow-up

1. **Cleanup can retain simulated currency after an earn/spend pair.** `application/example-cleanup-economy.ts` clamps each forward usage reversal independently. Starting at zero, bonus +10 and purchase -5 leaves5; removing both currently clamps the bonus reversal to0 then refunds5, leaving5 instead of0. Sent the exact reproduction and a signed-per-player aggregation recommendation; Stream implemented the aggregate/clamp-once repair with tombstones/reservations retained. The regression `aggregates simulator credit and spending reversals before clamping a retained profile` preserves a manually referenced profile while returning its removed example balance to0; focused file2 tests passed709ms, then integrated8 files/30 tests passed1.45s (Stream-reported).

2. **Captured receipt provenance must bind current trusted transport.** `application/command-economy.ts` originally checked event/input/player/command but not source/channel/stable usage identity after reservation. A valid-shape malformed receipt could classify Twitch usage as simulator and make cleanup remove real history. Stream added source/channel/id binding and reports three forged-receipt tests rejecting before effects. The captured creation time remains reusable across retries.

3. **Fixed-count catalog pages can be silently truncated.** `application/economy-catalog.ts` originally used2 shop items or3 odds rows per page even with valid100-character IDs/names and40-character currency. The bot's500-code-point limit could cut a weighted outcome, total price or page navigation. Stream added character-aware pages, compact presentation, complete IDs/weights/aggregate fractions/percentages and a bounded settlement summary with reserved space. Stream reports every page of a maximum-label fixture matching its full real Twitch outbox result at<=500 points. Corrupted separator glyphs were also removed.

4. **Pure presence income/counters need the proven data boundary.** Root independently identified that zero-note presence writes could commit data then throw, leaving stale application state. Added real30/60-second RED assertions, extended atomic selection to balances, claims, presence/registered-XP/rewarded-minute counters, presence receipts and earning rules, with existing startup/replacement/cleanup/external-reconcile exclusions. Last-seen-only observations and ordinary chatter remain on their prior path. Initial RED2 cases became GREEN in the3-file/14-test income/auto/storage run; the final focused file passed4 assertions covering process-interruption receipt recreation, earning-rule commit and ordinary-chat behavior.

5. **Restriction evidence must request/verify its complete filtered page.** Root Twitch review found the existing banned-user lookup omitted first100 and ignored pagination while accepting100 IDs; Twitch's default is20 rows. Root fixed first100, complete-page/unique-row/expiry/current-connection validation through six RED assertions. Root reports API/cache/tracker group5 files/26 tests and bounded-concurrency/legacy-income group2 files/4 tests passing. Official reference: https://dev.twitch.tv/docs/api/reference/#get-banned-users.

## Verified design boundaries

- Configuration identity covers earning definition and base rate, preserving drafts when unrelated live receipts append; a stale definition is rejected. Reading defaults uses a copied store snapshot.
- Costs add purchase and command fees; explicitly configured usage bonuses do not charge the catalog's purchase price. Failed/duplicate semantics do not create new rewards or fees.
- Frozen reservation validation checks costs, benefits, bonus references, captured box weights, ticket range/winner and exact awards against its own definition. A later catalog edit/removal can reuse an existing reservation without creating a new draw; missing-reservation sentinels alone are handled, while I/O/corruption errors propagate.
- Native tickets use secure uniform randomness independent of public message IDs. Immutable private receipts precede fee/note effects and survive proved command rollback. Malformed evidence holds loading/writes; no reward is granted by reservation alone.
- Public shop affordability and private-derived totals use the existing progress boundary. Explicit configured costs and the observable outcome of an actor's own purchase do not disclose private balance totals. No additional policy was invented for that unavoidable outcome.
- Cleanup preserves manual/Twitch and unknown legacy provenance, retained-request dependencies, durable effect tombstones and private draw evidence. Manual perks remain explicit pending/fulfilled records with optimistic revision checks and no automatic Twitch/game mutation.
- Positive and negative subscriber evidence is private, current-channel bound and fresh for90 seconds. Only complete batches become premium evidence; failure retains base income without claiming subscriber verification. Root bounded read concurrency avoids serial20000-user lookup latency; long/uncertain intervals receive no speculative backfill.

## Native spec review

Read-only inspection found no fixture/API/schema defect in `tooling/tests/obsidian/coforge-council-ask.obsidian.ts` and `coforge-request-object.obsidian.ts`: the current/legacy journal envelopes, explicit simulation source preservation, mixed-order four-attempt plan, captured category/schema properties and exact note-body assertions match implementation. Playwright locators re-resolve through the new last view after reload. Local Obsidian is unprovisioned; this statement is code review, not a host run.

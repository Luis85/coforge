# Economy independent product and privacy review

Reviewed the Stream-owned command pricing, catalog, durable reservation/integrity checks, example cleanup and Root-owned subscription/presence integrations alongside the configuration/UI boundary.

## Findings resolved

- Complete public odds and prices could exceed Twitch's 500-character reply budget when valid names/IDs were long. Stream replaced fixed row counts with character-aware pages, retaining complete identifiers, total prices and exact effective weight fractions; command settlement uses a compact complete summary and private full receipt. An actual Twitch outbox regression covers the maximum-label case.
- !shop affordability depended on request-derived private progression but had no public-project reference provenance. Shop now captures the same public-project boundary as !me; delayed API responses redact after a hold, and queued replies cancel after revocation. Both race paths passed in the focused privacy group.
- Forward per-receipt clamping during simulator cleanup could leave artificial currency after earning then spending. Stream aggregates signed removed effects per player before one final clamp, retains real-request dependencies and keeps replay/reservation evidence. Architecture independently identified this and reviewed its repair.
- Duplicate box entries have a combined outcome probability. The UI now shows the effective reward fraction plus each repeated entry's fraction, matching public odds and actual draw semantics.

## Reviewed boundaries

Semantic command effects, charge/benefits and readable receipt commit in one FIFO transaction. Rejected/duplicate operations do not charge or grant. Frozen source identity, rule snapshot, price, awards, roll ticket and expected outcome are validated before use; retry after a failed data write recovers its durable reservation rather than drawing again. Native random integers use the host cryptographic generator; the browser preview fails closed without durable reservation storage.

Catalog purchase prices and command fees are additive; bonus grants and prizes ignore catalog prices. Direct command benefits and captured awards are separate in receipts and UI. Perk fulfillment changes one revision-guarded private record, never balances or external game/physical state. Real Twitch/API usages and retained manually authored/Twitch request dependencies are preserved by local-example cleanup.

Eligible connected live chat presence funds observed unregistered profiles without initial credits. Registered XP uses separate counters. Subscriber totals replace the base and require bounded, current-channel subscription evidence; incomplete, missing or stale evidence uses explicitly described base fallback. Existing channel, stream, gap, coverage and restriction gates remain authoritative.

## Evidence and limits

Economy configuration/UI/navigation plus public reply/API races passed 5 files / 19 tests; late private note guard passed 1 file / 6 tests. Browser semantic and visual Economy qualification passed 4 cases with 20 light/dark wide/narrow screenshots and Axe/reflow assertions. Native, full-project and exact-head CI results are owned by the parent task; this review does not claim those gates ran here. Stream and Architecture report the dedicated backend/storage group results in their task evidence.

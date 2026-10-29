# Task: Keep private projects out of viewer-facing surfaces

- Status: implemented; parent full-project qualification remains in progress
- Journey in BRIEF.md: owner project management alongside explicit public viewer participation.

## Owner scope and boundary

The owner requested explicit private projects hidden from viewers. Existing projects retain public semantics. Private owner work remains available; public actors cannot discover, query, vote, add context or submit to guessed private IDs. Derived public recognition excludes private evidence. Already transmitted Twitch text and explicitly actor-authored messages are not retrospectively rewritten. Deployed GitHub Pages requires streamer republishing; no vault push is performed.

## Data and authority

- `StudioProject.visibility` is public/private metadata, stored in owned `coforge-visibility` frontmatter. Missing legacy visibility is public; invalid or explicitly null visibility is rejected rather than defaulting public. Note IDs, unrelated properties and human body bytes remain preserved.
- Public board/site/capture projections filter canonical project publicity and derive recognition from public requests only. Missing/private selected project identity is empty and generic, without a fallback to private active settings.
- Twitch/API target gates precede semantic intake and participation effects. Nonexistent and private targets have a uniform unavailable result without an idea ID. Local manual/simulator work remains owner-authorized. Replay tombstones cannot return an old now-private intake ID.
- Public !me derives feature/vote/badge recognition from public evidence. Private or historically unknown request reward claims withhold raw progression instead of guessing historical payouts; canonical private progression remains unchanged.
- Public !shop withholds request-derived private affordability. Both shop and profile replies capture public project references; delayed API results are rechecked after persistence, and queued replies cancel if those projects are revoked before delivery. The committed semantic outcome remains available internally for Economy accounting while the public response becomes neutral.
- New derived bot replies retain private project-reference provenance. Pending stale derived replies cancel before transport and are checked again at dispatch. An in-flight derived reply must settle before a UI visibility transition commits. Authored operator/recurring text is retained unchanged.
- Store-owned transient publication holds apply synchronously before awaited persistence and survive failure. Existing capture sources immediately recompute against those holds. Only successful explicit public reconciliation clears them. The host publication lease spans initialization, writes and committed notifications.
- Revoking visibility is independent of active provider configuration; other project settings still retain their existing pending-work guards. The public export publisher owns serialized revocation receipts and exact managed-file retirement, including automatic-publication-off and legacy exports.

## Evidence

- RED: three new mixed-public/private projection and discovery tests failed against the old behavior.
- Integrated privacy/export/projection qualification: 10 files passed, 36 tests passed. Includes mixed projections, uniform public command rejection, owner authoring, canonical visibility/reload, unknown properties/body bytes, failed persistence, explicit restore, active-work privacy-only updates, stale public drafts, already-open capture holds, bot transport cancellation, progression withholding and retained owner drafts, plus owned local export revocation/legacy handling.
- Targeted privacy ESLint passed, exit0 with no output.
- Browser qualification: 4 cases passed in1.4m across light/dark owner authoring/settings and all four public capture types. Reviewed all12 screenshots under `reports/project-privacy/`, including owner1280/480 and public480. Reflow and Axe assertions passed; exact accessible naming was corrected with per-leaf descriptions after an initial selector failure.

## Remaining qualification

Parent native/CI and UI-gallery gates remain required. This task does not remove user-authored public text or remote website deployments; it blocks fresh derived disclosures and retires only known owned local exports.

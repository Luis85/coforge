# Task: Return from experimentation to real CoForge work

- Status: implemented; full qualification tracked in the parent task
- Journey in BRIEF.md: explicit sample exploration and local chat testing followed by real project work.

## Owner decisions

The owner requested a way to remove simulated/example content after experimentation, then selected removal of loaded samples, local chat-test content and related history plus closure of temporary examples. Manually authored and Twitch requests remain real even when processed by simulated agents. Ambiguous historical origin stays preserved unless the owner selects an exact request ID. The implementation conservatively retains project containers and uncertain external/cost evidence, and discloses that boundary in the preview.

## Contracts and implementation

- Intake assigns a private persisted request-origin registry: sample, local-test, manual, Twitch or API. Neither author naming nor provider selection defines origin. Historical notes receive no invented provenance; orphaned registry entries are pruned on load and external note deletion removes the corresponding origin.
- Preview lists tracked automatic candidates and unchecked historical candidates. Exact original authored title, description, category and author can suggest an original seed, but recognition never selects deletion. Known manual/Twitch/API requests cannot be selected through this API.
- Confirmation binds canonical state and full-note fingerprints to the reviewed exact IDs. It rechecks paused automation, pending workflow/job state and native preflight before a serialized transaction. New or edited content invalidates a preview.
- Successful cleanup retires selected notes, removes their jobs and activity, local simulator chat and unreferenced local profiles. Retained request authors, voters, added-context authors and reward/recovery references keep their profiles. Known selected-request rewards are reversed exactly from retained ledger entries; unavailable attribution is preserved.
- IDs and intake deduplication remain monotonic so removed requests cannot replay. Project containers, real costs, ambiguous historical counters and external recovery evidence remain explicitly disclosed.
- Notes are staged with durable recovery and whole-file fingerprints. Failed persistence restores exact original bytes; postcommit trash failures leave a private recoverable archive. The storage helper and vault tests are owned by the parent agent.
- Named `example-content-removed` facts publish only after persistence. Temporary examples close only after successful cleanup. Confirmation, cancellation, stale-preview and failure behavior are owned by a typed UI composable.
- Cost cleanup commits a private bounded request-ID/time cutoff registry with the removal transaction. The cost service filters old simulation rows for those exact removed generations on the postcommit event, refresh and reload; newer same-ID generations, all real providers and any manual cost evidence remain. Failed removal commits no cutoff, so no cost row is removed on failure.

## Traceability

No requirement/vi IDs are declared in design/traceability.json. This is the owner's explicitly added product capability, verified with behavioral tests and the canonical settings-example-cleanup view contract.

## Test-first evidence

- Initial application run: 5 tests failed because previewExampleCleanup did not exist.
- First integrated targeted run: 3 files passed, 7 tests passed. Covers mixed sample/local/manual/Twitch content, other-project preservation, exact legacy selection, failed-save retry, stale preview, paused and queued guards, UI preview/cancel/confirmation/retry and private provenance validation/roundtrip.
- Additional review assertions verify named postcommit event ordering and orphan-origin pruning; final parent checks record their integrated result.
- Final targeted application/UI/provenance run: 3 files passed, 10 tests passed. Added native-admission lease lifetime/release, zero-write temporary closure, simulated-AI preservation for real manual/Twitch requests, forged protected-ID rejection and deduplication replay protection.
- Targeted ESLint for new cleanup application/domain/UI/tests: passed, exit 0, no output.
- Cost-history regression: RED confirmed an archived simulation row survived removal. GREEN run: 4 files passed, 13 tests passed (cleanup, provenance, mixed cost cleanup and existing AI-cost behavior). Extra assertions exercise storage failure before cutoff assignment, persisted cutoff reload and new same-ID generations.

## Untested scope and preservation limits

The targeted in-memory tests do not prove native disk journaling, Obsidian watcher order or external provider completion. The parent vault tests and real-host qualification cover those boundaries. Older releases did not record complete historical origin; unknown requests are preserved by default and uncertain cumulative counters are never guessed away.

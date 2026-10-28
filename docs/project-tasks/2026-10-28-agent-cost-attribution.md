# Task: Review all AI usage by agent, team and Council

- Status: implemented; integrated qualification tracked in the parent task
- Journey in BRIEF.md: private agent-work cost review across requests and analytical tasks.

## Owner scope

Track costs for direct agents, teams, Councils, proposal workflows and delegated attempts, including failed and uncertain outcomes, retries and fan-out. Retain exact provider/manual USD and token provenance; missing amounts never become zero or guessed model-rate estimates.

## Implementation

- Each shared-kernel attempt retains optional validated attribution from its immutable captured definition: agent ID/name/revision, project-owned team and Council IDs/names, proposal workflow name/revision and known message parent/root lineage. Missing pinned metadata retains recorded IDs without invented names or Council membership. Direct agent calls have no synthetic Council attribution.
- The collector keeps the existing stable attempt IDs and one row per attempt. Artifact telemetry replaces the same attempt's report; partial provider counters merge per field. Retries and child runs remain separate actual invocations. No parent cost row is synthesized.
- Verified Herdr target snapshots have a separate actor namespace. Legacy v1 provider jobs remain explicitly unattributed rather than being renamed as reusable catalogue agents.
- All cost identities survive ledger refresh, reload and source pruning. Native pruning first awaits a durable analytics copy; failed ledger persistence keeps the execution run. New nested metadata receives the same frontmatter escaping as top-level strings, preserving unknown ledger properties and exact human body bytes.
- AI costs now filters and regroups by agent, team or Council. These dimensions overlap; their totals are alternate groupings of the same attempts. Attribution coverage is shown separately from monetary and token coverage. Unattributed history and existing manual fallback remain available.
- Proven not-started intents have a distinct no-provider-contact state with no manual usage amount or guessed USD0; they are excluded from missing/pending cost and real-token coverage. Dispatching attempts count as pending. Authoritative forced-simulation runs show Simulation even when their captured definitions name real providers; ordinary paid attempts retain provider telemetry.
- Canonical execution identifiers up to200 characters are accepted by the cost ledger, matching the existing execution contract and supporting105-character task identities. Unknown fields and oversized identities remain rejected.

## Test-first evidence

- RED: 3 new attribution/lineage/durable-retention assertions failed because the collector did not retain actor metadata.
- Final targeted cost run: 8 files passed, 16 tests passed, covering pinned direct/Council/v2 identities, retries/delegation, interleaved fan-out peers, manual reload, ledger escaping/body bytes, native prune-failure retention, verified Herdr identity, partial telemetry and earlier exact-example cleanup.
- Final forced-simulation/paid/not-started regressions: 3 files passed, 10 tests passed.
- Actual-kernel telemetry regression plus attribution suite: 2 files passed, 7 tests passed. Two fan-out provider calls stream input/cache counters and USD0.2 each, then return output-only telemetry; attempts, artifacts and projected cost rows retain the full counters and total USD0.4 once.
- Typecheck passed. Targeted ESLint passed with zero warnings. Source line/locale gate passed2928 inputs and226 translated keys.
- Browser qualification: light/dark attribution filters, overlapping group semantics, unattributed manual fallback, narrow reflow, Axe scans and temporary-example exit passed. The existing manual-cost editing journey also passed. A dark teardown trace-file collision was rerun with a unique artifact directory and passed.

## Visual review and polishing

Reviewed `reports/agent-costs/attribution-{light,dark}-{1280,480}.png`. Group hierarchy and partial cost/attribution states read clearly. A final small pass aligned identity select borders with other fields and preserved readable provider/status/cost columns inside the existing horizontal table scroll region; its confirmation is part of the parent UI qualification.

## Scope limits

Telemetry remains limited by provider evidence; Herdr missing usage is still unavailable. Older v1 attempts without reusable definitions retain their cost but have no invented catalogue membership. Native run retention is covered by the contained Obsidian kit; parent real-host and CI qualification remain required before merge.

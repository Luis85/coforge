## Summary

Rebuild CoForge around Stream, Build, Community and Insights, with 87 checked view contracts, an expressive theme-compatible interface, guarded drafts and explicit private/public boundaries.

- Put Idea board before Council and Agent workflow; nest Workflow settings under Agent workflow.
- Make Council advice intake and ingested-task history the entry journey. Add card assessments and per-round round robin or actual concurrent fan out.
- Attribute AI usage and costs to captured agents, teams and councils, including retries, failures, delegation, unknown usage and simulations.
- Configure per-project request classes, categories and typed fields. New requests capture their definition; existing notes keep their schema and exact human content.
- Add private projects and revoke owned local exports, queued derived replies and viewer projections when privacy changes.
- Add Economy command fees/benefits, observed base/subscriber income, virtual rewards, weighted lootboxes, purchases and revision-guarded manual fulfillment.
- Preview and remove proven sample/simulator content while preserving authored/Twitch data, ambiguous history, real costs and replay evidence.

## Requirements and review

Owner decisions are recorded in BRIEF.md. Generated traceability declares no req-* or vi-* obligations; none were invented or marked complete. Canonical view contracts and the 85-view sitemap are in docs/components.

The studio task and expanded product review link independent product, UX/accessibility, privacy/reliability and maintenance reviews. The polishing pass repaired stale scope/filter labels, reflow/contrast issues, draft replacement, reactive copies, cleanup reversal, receipt provenance, public reply races, complete catalog pages and interrupted-write recovery. No thresholds, assertions or screenshot baselines were weakened.

Integrate main's vault MCP tools and scheduled tasks (#30) into the same hierarchy. Preserve explicit external stepping and genuine unknown/manual costs, protect unacknowledged MCP recovery during cleanup, reject legacy inbox loops before writes/admission, and include the scheduler in temporary-example reset. Task scheduler stays under advanced Council tools; external client access to private projects is explicitly distinguished from viewer visibility.

## Verification before main integration

- npm run verify:project: exit 0. Check summary **5 passed, 0 failed, 0 skipped in 890.4s**; production build **1,685 modules**, 7.03s; prototype embedding **1 passed, 0 failed**. UI-effects explicitly skip because no generated visual definitions exist.
- The first expanded full gate found one redundant Set spread and repeated catalog-fixture I/O exceeding the unchanged test timeout. Both were repaired. Targeted gate/catalog regression: **2 files, 9 tests passed (1.75s)**; the full gate above then passed.
- npm run test:ui-quality: **8 passed (1.1m)**, both themes, narrow reflow, keyboard focus and Axe.
- npm run ui:gallery: **40 captures, failures []**; representative states and native settings inspected. These are working-tree evidence, never baselines.
- Focused Economy browser: **4 passed (1.8m)** with 20 captures; Request Object: **2 passed (49.1s)** with 12 captures; linked card assessment: both themes passed; Council intake, round-order, privacy and actor-cost flows have dedicated browser evidence.
- The 178-case local run was stopped when main advanced: 64 cases passed and 7 old collected Council progress-label assertions failed. Those assertions were corrected without dropping numeric checks. Fresh complete merged UI CI must pass before merge.
- Self-review is clean with no approved exceptions. Ten new fixture/helper files were classified in tests/suites.json rather than suppressing the inventory guard. git diff --check passes.

## Host and CI evidence

Local Obsidian is not provisioned; no host download or personal vault was used. New contained-host journeys cover Council advice/mixed rounds/cost attribution, Request Object preservation, private export revocation/captures and Economy purchases/draws/fulfillment. Existing native workflows were updated for nested settings and Council navigation. The e2e label requires fresh complete browser, gallery and real-Obsidian CI on this PR head before merge. Final command results and CI artifact links are maintained in the PR description.

Merged focused qualification includes MCP/workflow/costs (4 files, 29 tests), legacy intake/current-policy guards (4 files, 18 tests), scheduler prewrite/race handling (3 files, 19 tests), UI routing/drafts plus fresh scheduler/MCP browser cases. The merged full gate is running; pre-integration results above are baseline evidence only.

## Limits

Live Twitch/OBS/Claude/Herdr accounts, anonymous video watch time, real-world perk delivery and personal-vault scale were not exercised. Presence uses complete observed live chat snapshots; unavailable subscription evidence uses the base rate. Perks require manual fulfillment. Already deployed Pages need republishing. Ambiguous legacy requests and uncertain recovery records remain preserved. Local Node is v24.20.0; CI uses pinned v24.21.0. Six existing Windows-skipped Unix fake-CLI cases remain unchanged and run on Linux CI.

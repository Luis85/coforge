# Task: Rebuild the studio around user goals

- Status: implemented; final delivery and exact-head CI tracked in PR #29
- Journey in `BRIEF.md`: all private, native-settings and public-display journeys; the complete community-to-reviewed-increment loop.

## Why

The documented surfaces need a coherent information architecture and a stronger visual hierarchy. Streamers must distinguish channel work from project work, find the next decision, and understand what the displayed data can actually establish.

## Traceability

- Owner request: overhaul `docs/components`, redesign every documented view, review from all product perspectives, polish, open a PR, bring CI green and merge.
- `design/traceability.json` and `design/visual-traceability.json` contain no open generated requirement or interaction obligations. Existing BRIEF journeys and the 73 authored view contracts govern this work.
- Owner visual direction: more expressive studio, stronger color, larger summaries and more visual emphasis (2026-10-28).

## Acceptance

- Every existing destination remains reachable through coherent task groups. Channel-wide pages identify their actual scope; project pages retain stable project identity.
- Summary and insight data derive from current canonical services. Missing measurements, financial currencies, reported cost coverage and simulated examples remain explicit.
- Every view family receives a deliberate composition/state review, including focused dialogs, native settings and public captures. Private fields never enter public projections.
- Navigation preserves guarded drafts and never starts external effects. Review, confirmation and uncertain-outcome recovery remain explicit.
- Both themes and narrow Obsidian leaves retain readable, operable content and keyboard focus.
- Cleanup previews removable sample/simulator content and related history, preserves manual/Twitch requests even with simulated AI, and keeps ambiguous legacy requests by default. Temporary example surfaces can be exited explicitly.

## Plan

1. Capture incumbent views; record the architecture and visual direction.
2. Add failing assertions for changed navigation, real-data summaries and decision shortcuts.
3. Implement shared contracts and visual foundations, then each view family in parallel.
4. Run product, browser, catalog, artifact and provisioned-host checks.
5. Independently review product/data, UX/accessibility and privacy/reliability/maintenance, then repair concrete findings.
6. Publish the reviewed PR, resolve CI findings, and merge after required checks pass.

## Evidence

- `node bin/app status`: status ok; zero pending acceptance obligations; dependencies initially missing.
- `npm ci`: 691 packages added, 692 audited, zero vulnerabilities.
- Baseline captures: `reports/stabilization/operating-views/` (generated during this task; not baselines).
- `npm run verify:project`: exit 0; check summary **5 passed, 0 failed, 0 skipped in 628.2s**, production build complete, prototype embedding **1 passed, 0 failed**. Later cost-cleanup additions receive targeted checks and the exact-commit CI gate.
- Initial `npm run test:e2e`: **140 passed, 4 failed (24.4m)**. Found community summary overflow, two obsolete navigation/settings-copy assertions and one cumulative capture timeout. Repaired the overflow and contract assertions; split the long capture into two cases without removing checks or increasing timeouts.
- Affected browser pass including new temporary-example tests: **45 passed, 2 failed (7.0m)**. All four original failures are resolved. New cleanup tests exposed missing origin markers in the browser seed; fixed the harness fixture before the final cleanup rerun.
- `npm run check:source`: code-line limits and locale parity passed, 2902 inputs / 226 translated keys. `npm run check:views`: **74 views documented; navigation coverage valid; sitemap current**.
- `npm run check:self-review -- --json`: clean, no violations or approval exceptions. `git diff --check`: exit 0.
- Impeccable detector: exit 0; one verified false positive on the unchanged, unrounded chart-legend line in `statistics.css`. No suppression or weakened rule.
- `npm run -s dev:obsidian -- --json` and `npm run test:obsidian -- coforge-example-cleanup`: exit 1, pinned native tooling is not provisioned. Nothing downloaded or launched. The existing real-Obsidian CI job will qualify the contained host.

## Review and improvement pass

The original 73 surfaces and new cleanup panel have explicit coverage. Findings and repairs are recorded in:

- [Architecture and all-view product/data review](2026-10-28-studio-product-review.md).
- [Build view redesign](2026-10-28-build-view-redesign.md).
- [Stream, analytics, native and public review](2026-10-28-stream-design-review.md).
- [Channel views and visual foundations](2026-10-28-channel-view-redesign.md).
- [Independent engineering review](2026-10-28-studio-engineering-review.md).
- [Independent visual review](2026-10-28-studio-visual-review.md).
- [Cleanup behavior and test-first evidence](2026-10-28-example-cleanup.md).
- [Expanded workflows, cross-review and polishing](2026-10-28-expanded-studio-review.md).

The pass corrected misleading scope/provider/backup labels, incompatible retained filters, optional-capability promises, card gutter overlap, icon grid placement, late workflow decisions, narrow community overflow, public website contrast and timed refresh. Cleanup added trusted provenance, exact-note receipts, durable interruption recovery, postcommit trash warnings, replay protection and native admission guards.

## Follow-up: Workflow settings belongs to Agent workflow

The owner requested this navigation revision while PR #29 was being qualified. Workflow settings becomes a local subpage of Agent workflow, sharing its heading, project context and local navigation. The old internal locator remains a guarded compatibility alias. No extra global sidebar entry or duplicate page frame remains. Existing definitions, run snapshots and save semantics are preserved; dirty drafts must block both global and local transitions.

The canonical view keeps both its compatibility and local coverage mappings. The catalog accepts an array of coverage mappings for one view, while retaining support for existing single mappings and rejecting duplicates or stale aliases.

Prior revision `6eb2348` passed real Obsidian: **16 files, 22 tests**, plus smoke **status passed, errors [], pluginConsole []**. Main CI passed **5 gates, 0 failures in 175.7s**, release build, embedding and **16 clean submission checks**. Browser CI passed **155 tests (7.3m)** and captured the 40-image gallery. These are baseline evidence; the updated revision receives fresh qualification before merge.

## Follow-up: Ask the Council is the entry journey

The owner identified that advice/opinion requests were buried behind Council setup. The Council now needs a primary new-task intake and ingested-task history on entry. The implementation adds private analytical task-note creation/listing and reuses the existing captured preflight/admission kernel; advanced configuration remains available. Saving a question does not start a provider, and history distinguishes saved notes, durable runs and observed inbox candidates.

The new question draft must survive failures, keep its project/team/council identity, and use an idempotent creation key. Task history spans projects by default and must not hide failures or uncertain outcomes. Existing private/public, independent-opinion and final-review boundaries remain authoritative.

## Untested live integrations

Live Twitch/OBS/Claude/Herdr sessions and personal vaults are outside local verification. Only contained fixtures and explicitly simulated examples are used.

## Additional owner scope during qualification

The owner clarified these cumulative requirements before final merge:

- [Actor cost attribution](2026-10-28-agent-cost-attribution.md) retains agents, teams and councils with immutable attempt evidence.
- [Round prompt order](2026-10-28-council-prompt-order.md) and [actual fan-out execution](2026-10-28-council-fanout-execution.md) support independently configured concurrent and sequential rounds.
- [Card assessments](2026-10-28-council-item-assessment.md) prepare a linked advice task with explicit draft replacement and admission.
- [Request Objects](2026-10-28-request-object.md) capture per-project class, categories and typed fields for new requests; existing notes retain their format.
- [Private projects](2026-10-28-private-projects.md) and [publication revocation](2026-10-28-private-project-publication.md) exclude owner-only projects from viewer surfaces and commands.
- [Economy](2026-10-28-economy-workspace.md) adds command fees/benefits, base and subscriber income, virtual rewards, weighted lootboxes, currency redemption and explicit manual perk fulfillment.

These follow-ups require fresh integrated checks and CI on the final revision. The original green PR revision is baseline evidence only.

## Expanded qualification, 2026-10-29

- Full `npm run verify:project`: exit 0, **5 checks passed, 0 failed, 0 skipped in 890.4s**; production build **1,685 modules in 7.03s**, embedding **1 passed / 0 failed**. Generated UI-effects explicitly skip because no visual definitions exist.
- The first expanded gate reported **3 checks passed / 2 failed**: one lint spread over an iterable and a catalog test repeatedly rereading the canonical view fixture. Removed the redundant spread and loaded the fixture once, separating contract validation from route coverage without reducing assertions or changing timeouts. Focused rerun: **2 files / 9 tests passed (1.75s)**, then the full gate passed.
- UI quality: **8 passed (1.1m)**. Refreshed gallery: **40 captures / failures []**. Parent inspected representative main/native states and new Council, Request Object, actor-cost and Economy captures across themes and widths.
- Canonical catalog: **85 views**, valid route coverage and current generated sitemap. Self-review found ten unclassified helper/fixture files; registered them in the existing helper inventory. Final self-review is **clean, violations [], approved []**.
- Focused Economy browser: **4 passed (1.8m)** with 20 images; Request Object: **2 passed (49.1s)** with 12 images. New Council intake, card assessment, round-order, cost and private-projection flows have separate evidence linked from their task records.
- The complete 178-case browser run is underway at submission. It exposed old assertions for the intentionally revised progress count; numeric progress checks remain and wording now consistently counts completed or skipped steps, including the screen-reader announcement. Focused monitor/history regression: **2 files / 4 tests passed (1.10s)**.
- Four additional contained native specs cover advice/mixed-order execution/costs, Request Objects, private export revocation and Economy. Local host tooling remains unprovisioned; the PR's exact-head native CI and smoke loop qualify them before merge.

These are local working-tree results. Final CI outcomes and immutable artifact links belong to the PR verification record; no screenshot baseline was committed.

## Integration with main #30

Main advanced to `b9f2a5d` while this work was being qualified. The merge preserves vault MCP tools and scheduled tasks while keeping Ask as the Council entry and placing Task scheduler among advanced tools. The canonical catalog now has **87 views**. The old browser run was stopped after 71 completed cases (64 passed, seven collected assertions still used the old progress wording); all numeric assertions remain and the source wording was repaired before fresh qualification.

Independent integration reviews are in [MCP/workflow review](2026-10-29-mcp-integration-review.md) and [scheduler/native UI review](2026-10-29-main-integration-ui.md). Repairs preserve external MCP stepping/readiness and unknown/manual cost provenance, exact request-field captures, nine-family example reset, honest external-run/screening labels, all-row MCP recovery protection, and current-policy rejection of legacy inbox/output loops. Saved preferences and authored schedules remain intact; uncertain I/O remains distinct from known policy rejection.

Fresh scheduler/MCP browser cases pass in both themes with explicit control hit testing, narrow reflow and Axe. The parent inspected all new view families. The merged full-project, gallery, browser CI and contained-host qualification supersede the pre-merge baseline before delivery.

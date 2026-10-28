# Task: Configure and execute project workflows

- Status: done; final merge/check status is tracked in [PR24](https://github.com/Luis85/coforge/pull/24).
- Journey: BRIEF configurable workflows; owner-approved full replacement/reordering, per-project ownership,
  AI plus manual approval/checklist steps, and JSON import/export.
- Base: managed Herdr/token/public UI foundation (PR23), merged at 83b7d775598e41896c29b168b725c2a5302f34ec.

## Why

The streamer needs to improve the process itself, rather than only change prompts on four fixed stages.
Configuration needs a dedicated view and execution must follow the saved order and contracts.

## Traceability

No generated req-/vi- IDs: the obligation arrays are empty. Tests target the owner's approved behavior directly.

## Acceptance

1. A private Workflow settings view supports ordered AI and manual steps, stable IDs, names, duplication,
   deletion, keyboard reordering, prompts, providers/models/Herdr agent, output/access and execution limits.
2. Each project has a canonical definition; legacy defaults retain their effective prompts/agents/rhythm.
   Saves preserve unrelated project metadata/body and reject stale source or unsafe active changes.
3. Strict versioned JSON round-trips definitions only. Invalid imports preserve the current draft and saved data;
   valid imports preview and replace the draft atomically, with a separate explicit save.
4. Actual execution handles arbitrary order, repeated/replaced roles, custom Markdown output and manual checkpoints.
   Pinned run/attempt revisions and bound input provenance prevent stale results applying.
5. Manual waits release the worker; required checklist items and explicit confirmation are enforced by application code.
6. Sequential edits/reviews share a verified isolated worktree. Any real cumulative edits require final streamer review;
   empty/no-code workflows never fabricate implementation results, publish unscreened requests or ship a feature.
7. Costs/tokens retain stable attempt/step attribution through rename/reorder/delete/retry. External uncertainty remains
   durable and cannot be bypassed by importing a workflow or changing providers.
8. Full project, browser/UI-quality/gallery and contained Obsidian CI pass on the final head before merge.

## Work split

- Domain/execution: definition/run/artifact contracts, immutable attempts, cursor/manual scheduling and CAS commits.
- Native/providers: output/access separation, shared workspace journal, Claude/Herdr execution and usage attribution.
- Presentation: dedicated builder, execution/manual progress, dirty navigation, import/export and focused UI tests.
- Parent: canonical persistence, facade/runtime integration, product documentation, review, aggregate verification and merge.

## Scope

Linear ordered workflows, strict built-in output contracts plus Markdown, and explicit manual checkpoints.
No branching/DAG language, arbitrary shell execution, unattended publication or automatic merging of generated code.

## Evidence

- `npm run verify:project`: **5 passed, 0 failed, 0 skipped (358.8s)**; complete **1444-module** build;
  embedding **1 passed / 0 failed**. Generated UI-effect checks explicitly skip because no visual definitions exist.
- `npm run test:e2e`: **93 passed (9.6m)**, including actual custom AI/manual execution, import/export,
  existing operating views, light/dark themes, reflow and axe. Final long-list polish separately **2/2 stress**
  and **4/4 editor/execution** browser cases passed; final-head CI must include them together.
- `npm run test:ui-quality`: **8 passed (2.1m)**. `npm run ui:gallery`: **40 screenshots captured**;
  reviewed fresh gallery plus focused editor/run/20-step screenshots at desktop/narrow widths. No baselines changed.
- Core domain/execution: **48 scoped tests passed**, plus independent codec/vault/integrity, real simulation,
  project-guard and metadata-deletion/changed-proposal review regressions.
- Native/provider/workspace: **55 scoped tests passed / 6 platform skips**; targeted follow-ups cover
  verified final review, cancellation, empty diffs, mixed providers, schema errors and bounded review feedback.
- Folder privacy: **33 scoped tests passed**, including contained Git ignore checks, actual custom configDir,
  body/annotation preservation and rejection before private writes or public publishing.
- Scoped ESLint/Oxlint and full typecheck passed; `git diff --check` clean. File-size limits reviewed.
- Local native Obsidian is not provisioned; nothing downloaded or launched. Linux contained-host CI is required.
- Final implementation CI: **95 browser tests passed**, **40 gallery captures**, **20 native Obsidian tests passed**,
  reload smoke **passed / errors []**, full project gate, dependency audit and GitGuardian passed. Native screenshots
  were reviewed; duplicate passive OBS probes were coalesced after a reproduced startup-toast regression (**12 focused
  tests passed**), with an added native assertion that the false toast is absent.

## Review and polishing pass

- Product: distinct editor versus monitor, project-specific revisions, full step replacement/order and typed
  capabilities, explicit human checkpoints, no-code completion without invented implementation credit.
- UX/accessibility: clear next actions, invalid/stale draft retention, real import preview boundaries, visible
  export location/copy, keyboard reordering and a bounded long list that keeps editor/Add controls reachable.
- Architecture: framework-free definitions/run policy, narrow facade, provider/workspace ports and per-leaf
  Pinia view state. Manual events do not inflate AI-job counters. Costs retain captured step identities.
- Reliability: proposal/input/attempt CAS, exact serialized artifact bytes, private origin tombstones after
  note metadata deletion, guarded RICE/project context, native review state/diff verification and actionable errors.
- Privacy: strict definition-only JSON, explicit authored-prompt preview, private/public folder separation and
  managed ignore rules for actual request/configuration folders. No silent untracking or history rewriting.

## Untested scope

No paid model invocation, personal vault, live stream or OBS capture. The initial Herdr profile remains Claude-only,
with no reliable automatic Herdr usage or interactive USD/turn enforcement. Platform-specific Unix process/symlink
tests skip locally on Windows; native Linux CI and exact-head security/check results are required before merge.

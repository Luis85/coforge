# Task: Run project workflow steps through Herdr

- Status: implementation and validation in progress.
- Base: main 964294312b8ee071c1424057f4d8e8c602050fea (PR22).
- Traceability: BRIEF owner request; generated requirement/interaction arrays remain empty.

## Intended outcome

Each project can choose Herdr, its agent and its model for Screen, Score, Plan and Build,
then dispatch those exact choices without losing workflow state or treating delivery as success.

## Verified constraints

- Herdr 0.9.5 `agent start` accepts native agent startup arguments after `--`.
- Existing-agent prompt API has no model parameter or generic model verification.
- `agent prompt --wait` observes lifecycle state; it explicitly does not correlate a turn's structured result.
- Companion uses explicit human completion/advancement. Terminal text, prompt echo and idle/done are not a validated result.
- Existing manual controls and workflow dispatch need shared target admission to prevent interleaving.

## Owner decisions

- Launch a dedicated Herdr agent per step, using that step's selected type and model.
- Automatically receive task-correlated result files and validate the complete envelope/schema.
- Initial managed profile: Claude Code only, because equivalent restrictive profiles for the other
  installed agents could not be verified. Interactive spending/turn caps and automatic usage are unavailable.
- Track provider-reported input/output/cache counters in the private AI dashboard; missing is not zero.
- Public ribbon actions open fresh main-workspace tabs; users may detach them manually for OBS.
- Fix native public-view CSS scope/content and the sidebar's clipped active-state outline.

## Acceptance

1. Per-step project notes persist the selected Herdr agent/model; inheritance/reset and legacy providers remain compatible.
2. Queue records capture the exact launch/target configuration; background project switches cannot retarget a job.
3. Verify session, agent identity, project directory, availability and implementation permission before mutation.
4. Persist intent before dispatch; do not replay ambiguous delivery or erase pending recovery on reload/cancel.
5. Advance only from a matching, validated result through the chosen completion protocol; reject stale/malformed/cross-task data.
6. Preserve mandatory increment review and factual diff/test/cost provenance. Missing Herdr usage remains unavailable/manual.
7. Settings/workflow/history/cost UI clearly identifies Herdr, target/model and any waiting/recovery boundary.
8. Project, UI-quality/gallery, browser and contained-native checks plus GitGuardian pass on the final head before merge.

## Work split

- herdr_capabilities: verified CLI profiles, gateway, durable orchestration, shared admission and recovery.
- token_usage: provider usage, aggregation/archive/UI and native result/worktree files.
- public_windows: public tabs/content/styles/icons, sidebar selection and Herdr settings/recovery UI.
- Parent: owner decisions, implementation seams, integration, verification and green merge.

No live agent mutation, paid run or personal vault opening is authorized for QA.

## Review and evidence

- Product/architecture: application orchestration, native profiles/files, token accounting and public DTOs have
  separate contracts. Canonical project frontmatter retains explicit overrides and unrelated properties/body.
- Reliability pass fixed total-deadline cancellation, completion before prompt acknowledgment, and completion
  logging failures. Recovery retains acknowledged resources, original configuration and unresolved holds.
- Privacy pass kept public views on explicit projections, preserved detached-window curtains, and ignored private
  Herdr journals even with custom Obsidian configuration folders. No private data or generated evidence is committed.
- UI pass fixes native CSS ownership, richer public content, stable icon ownership and selection versus focus.
- `npm run test:e2e`: **88 passed (8.2m)**, including all public views, configuration, tokens and sidebar focus.
- `npm run test:ui-quality`: **8 passed (54.9s)**.
- Local full-gate passes: typecheck, ESLint (zero warnings), product tests and maker types. The last full
  attempt stopped on an oxlint test-helper warning; it was fixed and `node tooling/quality/lint-source.mjs`
  then reported **status: passed, files: 1114**. Final aggregate verification is required on CI.
- `npm run verify:artifacts`: **1413 modules transformed**, complete build, embedding **1 passed/0 failed**;
  generated UI-effect checks explicitly skipped because this project declares no visual definitions.
- Post-lint workflow orchestration regression: **1 file, 16 passed**.
- `npm run ui:gallery`: **Captured 40 screenshot(s)** under `reports/ui-gallery/`; reviewed with focused
  public-view, Herdr-settings, usage and navigation screenshots. Evidence only; no baselines changed.
- Herdr application/native/storage focused run: **5 files, 53 passed**. Pinned-profile/configuration follow-up:
  **2 files, 7 passed**. Windows skips platform-only Unix shim/symlink cases; Linux CI covers them.
- `npm run -s dev:obsidian -- --json`: **not provisioned** locally; nothing downloaded or launched.
  Contained Obsidian CI is required before merge.
- Untested: a paid model invocation and actual streaming/OBS capture on the streamer's desktop. Herdr's initial
  workflow profile is Claude-only, with no trustworthy automatic Herdr costs/tokens or enforced interactive USD/turn caps.

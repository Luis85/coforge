## Summary

Enable provider-native assistants and isolated test execution for explicitly opted-in workflow agents. Claude Code and Codex coordinate their own assistants inside one captured parent invocation; CoForge does not dispatch or administer child CoWorker jobs.

A separate saved host grant supplies immutable local Docker images and approved command IDs. Native root/children share the scoped broker, original workspace, call allowance and stop boundary. Actual command outcomes retain their source/image identity, bounded output and provenance, including later-source staleness, readonly reviews and historical polishing results. Original provider/container/private-state ownership is persisted before effects and recovered without replay.

## Requirements and traceability

Owner request recorded in BRIEF.md. The scaffold declares no req-* or vi-* obligations; none were invented. Dedicated Claude/process/recovery, Codex/profile/privacy and policy/UI/qualification agents implemented and cross-reviewed the work. Plan and evidence: docs/project-tasks/2026-11-01-native-workflow-agents.md. Operator setup: docs/coforge/NATIVE-WORKFLOW-TOOLS.md.

## Validation

- Actual Claude Code 2.1.281 native proof passed: one native child, scoped read, denied private read, valid StructuredOutput, unchanged source and parent completion. Three bounded qualification calls reported $0.3252812 estimated cost; not an invoice.
- Final-source Codex 0.145.0 / gpt-5.6-sol proof passed in 54.28s with canonical CLI sign-in: root-scoped spawn and child completion, allowed read, denied credential/managed-note reads, valid root result, parent completion and private runtime cleanup. Dollar and inclusive token totals remain unavailable.
- Focused behavioral suites passed across provider scopes, capture/admission, prepared private runtime, cleanup/quarantine, orphan lanes, snapshot privacy, lost persistence, output bounds and post-build/polishing evidence. Final auth/provider batch: 9 suites, 55 tests passed. Typecheck, focused ESLint and whole-source lint passed. Final aggregate and GitHub results are recorded in PR #62.
- npm run test:ui-quality: 8 passed. npm run ui:gallery: 40 captures reviewed. Impeccable detector: no findings.
- Contained native capability authoring/save/reload/keyboard proof: 1 passed; both themes/pane sizes reviewed, zero jobs/Docker/model calls.
- Contained native stored-evidence/recovery render proof: 1 passed, confirmed with --no-build; 20 screenshots reviewed, exact note bytes and fixture jobs retained. Records explicitly synthetic; execution is qualified separately.
- Final authentication/context UI batch: 2 passed, including authoring and captured-history disclosures, keyboard operation, wide/narrow light/dark rendering and unchanged note bytes. These rendering fixtures perform no inference.
- Final UI gate refresh: UI quality 8/8 passed and 40 gallery captures reviewed. Pinned contained load/reload passed on Obsidian 1.14.4 / launcher 3.2.1: plugin loaded/enabled, `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`. Screenshot and debug report inspected (two records, zero errors). An initial pre-host `Database is not open` failure was retained; one same-command retry with a fresh contained profile passed without code or configuration changes.
- Mandatory actual isolated-Docker suite: **6 passed, 0 failed/skipped** in [branch qualification](https://github.com/Luis85/coforge/actions/runs/41267332339), on f7aac7a. No local positive Windows Docker execution is claimed.

The first full local gate passed all 2,024 product tests (six existing Windows skips), typecheck, ESLint and maker types, but source lint rejected unsafe cleanup control flow. That control flow was corrected; whole-source lint (2,158 files), final standalone typecheck, strict verification-harness typecheck and targeted retention/recovery suites pass. Release build and prototype embedding also pass separately. PR #62 retains final aggregate/CI qualification alongside the initial failed run.

The owner selected existing Codex CLI sign-in and SDK-managed global AGENTS/skills. The authentication correction removes per-invocation OAuth copying and keeps refresh in the canonical native credential store. Invocation SQLite/log/model-profile state remains private; provider rollout files remain provider-owned. The SDK can index existing rollouts in the private database; actual native ownership checks, not an empty index, prevent cross-root access. A real-SDK fake-API canary confirms rejection of indexed foreign child UUIDs/paths, global context inclusion and exclusion of personal config/custom agents. Detached worker environment forwarding also passed without serializing keys. Global context never grants file/test authority, and recorded CoForge input is distinct from SDK prompt augmentation.

## Evidence and limits

Local ignored evidence: reports/native-workflow-tools/, reports/ui-gallery/, reports/obsidian/, .nq/codex-native-live-*/ and reports/workflow-verification/. No credentials, private runtime data, reports, dist or native caches are committed.

Local Docker Desktop failed during startup; no administrator provisioning, factory reset, global configuration change or unsandboxed fallback was used. CI must prove the actual Linux container runtime before merge. Real providers and actual Docker were qualified separately; the combined persistence/broker flow uses a provider fixture. Runtime never pulls/builds images or copies host node_modules; owners prepare Node-equipped images with Linux dependencies separately. Missing policies preserve existing captured runs. Codex discovery reports its configured runtime catalogue, which may include a personal catalogue override and is not proof of account entitlement; the provider decides access to the exact selected model, without fallback.

No actual CF-133/CF-135 execution, personal-vault launch, live Twitch/OBS action, package dependency change, publication or automatic code acceptance. Final human review remains mandatory. PR merge requires all final-head checks, including full browser/native and isolated-verification suites, to be green.

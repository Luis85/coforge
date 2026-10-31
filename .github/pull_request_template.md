## Summary

CF-133 reached manual review with a saved increment, but its agent missed an existing stylesheet, could not use the requested subagents, wrote tests without executing them, and left a polishing recommendation apart from the acceptance view. This change improves the plugin paths that produced that handoff.

Repository tools now support directory-scoped content search and filename filtering before the result limit, with explicit guidance when results are incomplete. Shared execution prompts describe provided capabilities and ask for source-backed plans, acceptance coverage, honest verification limits and concrete unfinished work. Increment brings the exact Build-input plan criteria and valid post-build AI/Council findings beside recorded changes, with attribution, simulation labels and an accessible diff region.

## Requirements and traceability

Owner request recorded in BRIEF.md. design/traceability.json has no declared req-* or vi-* obligations; none were invented. Dedicated product/agent-workflow, engineering/QA/security and UX/operations/accessibility reviewers implemented and cross-reviewed the pass. Plan, findings and evidence: docs/project-tasks/2026-10-31-cf133-increment-quality.md.

## Validation

- npm run verify:project: **passed, exit 0**. Final check summary: **5 passed, 0 failed, 0 skipped in 1,074.8s**; product report: **1,725 passed, 0 failed, six existing Windows skips**, zero failed suites. Release build **2,005 modules**; prototype embedding **1 passed**. UI effects explicitly skip because no visual definitions are declared. The first run caught a test fixture's widened readOnly boolean; retaining its literal true type fixed it, with standalone typecheck/five tests/lint and the complete final rerun passing. No runtime code changed for that correction.
- npm run test:ui-quality: 8 passed (1.2m).
- npm run ui:gallery: 40 captures, zero failures; wide/narrow, light/dark studio and settings evidence reviewed under reports/ui-gallery/. No baselines changed.
- npm run test:obsidian -- --no-build coforge-increment-review: 1 passed (30.80s). Simulated six-step workflow, exact saved criteria/review retention across reload, evidence immutability, allowed startup-only operation additions, disclosure/diff keyboard access and eight theme/width screenshots.
- npm run -s dev:obsidian -- --json --port 9324: passed on pinned Obsidian 1.14.4 / launcher 3.2.1; errors [], hostErrorCount 0, pluginConsole [].
- Behavioral red/green evidence: discovery's two regressions failed before implementation; prompt's seven failed; Increment missing-UI and Council tests failed before their fixes. Focused final discovery suite 5 passed, transport/schema batch 33 passed, prompt/provider batch 33 passed, UI batch 19 passed. Focused configured ESLint exited 0.
- Read-only probe of actual CF-133 canonical note: 10 bound criteria, 1 Review finding, host snapshot recognized. Original run/worktree unchanged.
- Impeccable detector on changed Vue/CSS: [], exit 0. Native findings/diff screenshots reviewed in both themes at 1280/720px host widths.

The first native proof passed interactions but failed an overbroad raw-state comparison across reload. It was corrected to compare parsed request evidence and exact note bytes, while explicitly checking only normal studio/OBS-detection startup operations and their matching counters. No runtime behavior was changed to satisfy the test.

Independent integrated self-review found no actionable issues. Code-line limits and locale parity passed across 3,597 inputs and 226 translated keys; final native-spec configured ESLint and git diff --check passed.

## Evidence and limits

Ignored local evidence: reports/cf133-review/, reports/ui-gallery/, reports/obsidian/ and .obsidian-sandbox/logs/. New native spec: tooling/tests/obsidian/coforge-increment-review.obsidian.ts.

This pass does not implement, modify or accept CF-133's Hiring Pool increment. No paid provider run, personal-vault launch, dependency installation, external-service mutation, publication or merge. Actual native delegation and executed qualification remain separate capability work; this pass accurately exposes the existing limits. No full native suite run: no lifecycle/Obsidian-API behavior changed; the focused new host journey and dev reload were run. Local Node/npm are 24.20.0/11.21.1 versus repository pins 24.21.0/11.19.1.

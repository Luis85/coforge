# Review: Preserve the studio contracts while merging vault MCP and scheduling

- Status: targeted review and disjoint fixes complete; parent owns integrated qualification.
- Incoming commit: `b9f2a5d` / PR #30, vault-wide MCP tools and task scheduling.
- Owner scope: preserve the accepted incoming behavior, captured per-project Request Objects/categories, real actor-cost evidence, project privacy, explicit simulation cleanup and MCP lifecycle.

## Reviewed integration

The auto-merged configured workflow engine/policy, legacy engine, application ports, workflow run schema, Idea note schema, persisted state schema, AI costs schema, workflow/studio composables and browser preview wiring retain the branch's prior contracts. `ExecutionProvider` extends runtime evidence with MCP while editable native `Provider` choices remain distinct. External jobs omit unsupported model/agent fields; captured step definitions remain pinned. MCP context uses the existing untrusted request envelope containing the request's own class, custom values and taxonomy. Note and run serialization preserve those captured fields and `external` evidence.

MCP usage remains a real attempt with unavailable cost and token coverage. The existing exact-state manual fallback supports a reliably sourced USD entry and removal. Tests verify that this does not fabricate agent, team, Council, model or token attribution. Private-project data stays available to the authenticated local operator's vault MCP tools under the accepted #30 scope; the viewer board continues to use its explicit public whitelist.

## Concrete fixes and delegated findings

1. Automatic configured ticks previously selected a ready external MCP run, then its queue deliberately performed no automatic action. This starved later eligible native requests in the same project. Candidate selection now skips external runs on automatic ticks.
2. Explicit tick readiness previously checked an external run against its definition's native provider, requiring an unavailable CLI even though dispatch correctly selected MCP. Readiness now passes the existing captured external flag, matching queue/run checks.
3. The incoming scheduler example lacked the branch's explicit Exit example/generation cleanup and retained a live in-memory timer. Build owns that integration, including disposal of dependent cached scheduler/Council examples only on explicit exit/cleanup.
4. Saved historical inbox bindings are parsed structurally at startup without reapplying the new reserved-output folder policy. An existing watch overlapping `CoForge/Scheduled Tasks` therefore needs a scheduler prewrite guard as well as save-time exclusion. The scheduler host now checks captured and freshly reloaded current bindings before writing and after awaited source/preflight operations. It uses the existing watcher routing semantics, preserves preferences and source evidence, and blocks before explicit admission. A typed pre-admission policy error preserves the actionable repair reason in the durable occurrence while generic I/O failures retain uncertainty and replay guards. Architecture owns the complementary current-policy intake callback preventing already-existing or newly racing output notes from watched admission.
5. Root assigned Architecture the MCP recovery-evidence cleanup guard: selected examples cannot remove an unacknowledged interrupted MCP workspace/job and lose its recovery route, including records beyond the UI's recent-25 view.

## Evidence

- Added `mcp-branch-integration.test.ts` with four behavioral cases. The starvation case first failed with `null` instead of the independent native job; the explicit external tick case first failed with `null` instead of its MCP job. Both passed after the two-line engine correction.
- `npx vitest run` for mcp-branch-integration, existing mcp-workflow, configured-workflow-engine and ai-costs: **4 files, 29 tests passed (2.31s)**.
- The new tests cover captured class/values/taxonomy in external prompt and canonical note roundtrip, persisted MCP provider/run evidence, unknown real usage, exact-state sourced manual fallback and truthful attribution/token coverage.
- Scheduler guard group (new task-scheduler-intake-guard plus existing task-scheduler-host/task-scheduler): **3 files, 19 tests passed (12.44s)**. Eleven new cases cover blocked recursive/exact/case scopes, four non-ingesting scopes, source-write/preflight races, exact policy feedback versus redacted I/O causes, preserved preferences, retained raced sources and no implicit retry.
- `git diff --check`: clean before staging the disjoint engine, scheduler and test/report files.
- No commits, pushes, external client activation or personal vault operations were performed. Parent owns full verify, UI/browser/native gates and the merge commit.

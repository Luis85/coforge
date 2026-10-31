# Task: Make agent increments easier to build and review

- Status: done
- Journey in `BRIEF.md`: request intake → plan/design → isolated Build → mandatory streamer review.

## Why

CF-133 completed seven AI stages and reached manual approval, but its first increment was not qualified for acceptance. The agent wrote tests without running them, could not find an existing stylesheet, deferred generated documentation, and repeatedly reported that requested subagents were unavailable. Its final review recommended polishing before publication.

## Review evidence

Read the original CF-133 request and captured workflow/artifacts without modifying them. The successful run is `85dab1e3-35ef-440b-81d6-85715f0125a6`; seven AI attempts succeeded and manual approval remains waiting. Build took approximately 460 seconds and captured seven changed files. The recorded provider costs for these seven attempts total approximately $4.38; this is recorded run cost, not an estimate of future cost.

Dedicated reviewers covered product management/JTBD, agent orchestration, engineering, QA, security, reliability, maintainability, streamer operations, UX/accessibility, information design, community and privacy. Their principal findings:

1. Repository discovery is bounded globally, so root content search can miss later directories. Build omitted styling because it could not find `src/plugin/styles/coforge/coworkers.css`; the later review found that file.
2. Workflow instructions requested delegation and E2E qualification although native invocations expose bounded file tools and deny delegation/shell/browser tools. A valid returned output is not proof of a verified increment.
3. Build explicitly selected only the saved plan. PRD/design context was absent by configuration; existing captured inputs must remain exact. Plans need a stronger handoff for styles, tests, docs and unresolved decisions.
4. Saved criteria and post-build review findings are separate from Increment, making acceptance harder to assess. Agent opinions must remain attributed reports, distinct from captured diff and verification evidence.

### What the first run delivered

| Stage | Captured result | Quality implication |
| --- | --- | --- |
| Intake | CF-133 retained its stable identity and CFP-002 parent; one recorded vote | The request remained attributable throughout the workflow. |
| Screen | Clear, with no reported injection signals | Progress was permitted; this was not a security guarantee. |
| Score | RICE 17.5; reach/effort were explicitly assumptions | Demand and feasibility estimates were not presented as observed analytics. |
| Refinement | PRD and proposed role/template scope; delegation unavailable | Useful product analysis, but not independent subagent review. |
| Design | Specification with scope and open questions; delegation unavailable | Design claims still required source verification. |
| Plan | Small Hiring Pool slice with single-template drafts and explicit Save | Build received this plan alone; broader context was not automatically bound. |
| Build | Five built-in role templates, Hiring Pool/empty-state UI, draft hiring, Codex label fix, docs text and test source; seven changed files | Safe draft defaults and retained changes were valuable. Styling, docs regeneration and executed qualification remained incomplete. |
| Review | Source inspection recommended polishing before publishing | It caught the missing stylesheet and unexecuted checks, but was an agent assessment rather than an execution result. |
| Manual approval | Waiting for the human | The existing acceptance boundary worked. No merge/publication was demonstrated or implied. |

### Findings across product perspectives

| Perspective | Evidence and user impact | Outcome of this pass |
| --- | --- | --- |
| Product management / JTBD | Hiring provides role text, but project-team/Council setup remains separate. Starter kits, provenance and bulk hire were deliberately deferred. | Preserve the small increment; record these as separate product opportunities rather than expanding the plugin-polish scope. |
| Agent orchestration | Refinement, Design and Review explicitly reported missing subagents despite instructions requesting them. | State native tool limits in the execution contract and require honest remaining-work reports. Actual delegation remains future capability work. |
| Context / handoff | The Build attempt bound only the Plan, omitting prior PRD/Design artifacts by configuration. | Strengthen source/style/test/docs and open-question handoffs; preserve captured input selection. Display criteria from the exact bound Plan. |
| Engineering / discoverability | Root listing/content budgets can exclude later source folders; Build missed an existing stylesheet. | Add filename filtering, directory-scoped content search and explicit truncation recovery guidance across tool transports. |
| Architecture / maintenance | Shared native/durable/external execution paths need consistent contracts. | Reuse a framework-free guidance function and the existing bounded file service; no alternate execution engine or schema migration. |
| QA / release confidence | Test source was written, but no tests/typecheck/docs generator/browser proof ran inside CF-133. | Distinguish source-written tests, executed checks, captured changes and reported assessments. Qualify this plugin change separately; do not transfer its passing results to CF-133. |
| Streamer UX / information design | Criteria, the increment and the review recommendation required separate views. | Bring bound criteria and attributed post-build AI/Council findings into Increment, with explicit unverified/provenance labels. |
| Accessibility / responsive layout | The focusable diff lacked an accessible name; drawer evidence needed targeted qualification. | Name the diff region; prove native disclosure/diff keyboard operation, wrapping and focus in both themes and pane widths. |
| Security / trust | Imported/hired draft safety and final human gates were retained; requested capabilities must not be inferred from prose. | Preserve tool denials, leases, private path exclusions, exact-content writes and review gates; never infer approval or executed verification. |
| Operations / reliability | Host and submitted code-change artifacts can represent the same Build; retries and reload must not attach stale findings. | Resolve valid aliases and latest successful bound follow-ups; reject invalidated, corrupt, foreign, pre-build and retried findings; prove evidence retention after reload. |
| Community / privacy | Published plans already contain screened public context, while diffs, conversations and review evidence are private. | Keep the new evidence in the private drawer; no public projection or community rewards/acceptance behavior changes. |
| Cost / measurement | Recorded provider cost for the seven successful attempts was about $4.38; effort/reach remained estimates. | Do not invent usage, cost savings or verification success. Future work should measure time-to-qualified-increment across real runs, including human polishing time. |

## Traceability

`design/traceability.json` is `scaffold-not-accepted`, with no declared requirements or interactions. No synthetic req-* or vi-* IDs are introduced. This is the owner's requested plugin improvement pass, recorded in `BRIEF.md`.

## Acceptance

- Scoped repository search/discovery can reach relevant files in a large repository without increasing existing resource limits or weakening path, lease or private-data protections. Truncated results explain how to narrow discovery.
- Native workflow prompts state actual capabilities, preserve captured input selections and require factual implementation/acceptance/verification/unfinished-work handoffs. Unsupported requested activities are reported honestly.
- Increment review presents planned criteria and eligible, attributed post-build findings with explicit evidence provenance. Historical, invalidated, failed and pre-build outputs do not masquerade as current review. No automated approval or inferred test pass is introduced.
- Existing private data, final human gates and public projections retain their boundaries. Original CF-133 evidence and its worktree remain unchanged.

## Plan

1. Dedicated product-perspective reviews of the captured run and current plugin.
2. Three implementation agents: bounded repository discovery; capability/quality prompts; increment evidence UI. Behavioral regressions first, with recorded red/green results.
3. Integrate and independently cross-review; run required project/UI/contained-Obsidian checks and inspect screenshots.
4. Fill the repository pull-request template with real evidence and limitations.

## Out of scope

Executing commands or paid provider runs through plugin agents; adding native delegation authority; plugin-initiated publishing/merging; changing saved workflow input bindings; implementing or accepting CF-133's Hiring Pool feature; personal vaults and live external-service mutations.

## Evidence

- Initial `node bin/app status`: status ok; dependencies installed; generation matches accepted design; 0 acceptance obligations pending.
- Initial working tree clean; branch `codex/cf133-increment-quality`.
- First `npm run verify:project`: **4 gates passed, 1 failed**, 1,188.3s. All **1,725 product tests passed**, six existing Windows skips; lint, ESLint and maker types passed. Typecheck caught a test fixture's `readOnly` literal widening to `boolean`. The fixture now uses `true as const`; no runtime code changed. Failed log preserved as `reports/cf133-review/verify-project-first.log`; corrected qualification is recorded below.
- Final `npm run verify:project`: **exit 0**. Check summary: **5 passed, 0 failed, 0 skipped in 1,074.8s**; product report: **1,725 passed, 0 failed, six existing Windows skips**, zero failed suites. Release build: **2,005 modules transformed**, complete candidate built; prototype embedding: **1 passed, 0 failed**. UI effects explicitly skip because no visual definitions are declared. Final log: `reports/cf133-review/verify-project-final.log`. The corrected fixture also passed standalone typecheck, its five tests and configured ESLint before the full rerun.

Implementation/cross-review evidence:

- Discovery regression: two new tests failed before implementation. Optional filename filtering and directory-scoped content search now preserve scan/file/byte/match limits and provide truncation guidance. Transport/schema batch: 33 tests passed across six files; final discovery/cap suite: 5 passed; focused ESLint exited 0.
- Prompt regression: seven tests failed before implementation. Final foreground/configured/Codex/durable/brokered-reader batch: 33 tests passed across seven files; focused ESLint exited 0. Cross-review corrected an overstatement about external-client capabilities.
- Review UI regression failed before implementation. Final focused UI batch: 19 tests passed across three files, including Council assessments, Build-input plan selection, host/result aliases and stale/invalid evidence exclusions. Council inclusion had its own failing regression before the fix.
- Read-only probe of the actual canonical CF-133 note through the new parser/selector: ten bound criteria, one Review finding, host-captured evidence recognized; exit 0. Probe output is ignored at `reports/cf133-review/real-run-probe.json`.
- Impeccable detector on changed Vue/CSS targets: `[]`, exit 0. Rendered visual inspection completed separately below.
- `npm run test:ui-quality`: **8 passed (1.2m)**.
- `npm run ui:gallery`: **40 captures, zero failures**. Studio and settings reviewed wide/narrow and light/dark; no baselines changed. The generic gallery does not cover the drawer, which has separate native evidence.
- `npm run test:obsidian -- --no-build coforge-increment-review`: **1 passed**, 30.80s total. Six manual simulation stages, review after reload, retained evidence, keyboard disclosure/diff and eight theme/width screenshots. The first attempt passed UI checks but failed an overbroad raw-JSON comparison; final assertions compare exact note bytes and parsed request/job/increment evidence, permitting only explicitly enumerated normal startup operations and matching counters.
- `npm run -s dev:obsidian -- --json --port 9324`: **passed**, Obsidian **1.14.4**, launcher **3.2.1**, `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`. Reviewed native findings/diff captures at 1280/720 host widths in light/dark; panels wrap, focus is visible and final controls remain reachable.
- `node tooling/quality/check-source.mjs`: code-line limits and locale parity passed; **3,597 inputs, 226 translated keys**. Final native-spec configured ESLint exited 0; `git diff --check` passed after normalizing the PR template's final newline.
- Independent integrated closeout review found no actionable issues in evidence provenance, trust boundaries, architecture, tool transports, file limits or the native test.

## Further product opportunities

These are recommendations rather than implemented capabilities or approved defaults:

- Native defined-recipient delegation could reuse the existing CoWorker execution kernel with captured recipients, shared finite limits, original worktree isolation and durable results. A prose request for subagents cannot supply that authority.
- Executed qualification needs a separate, explicit host capability and trustworthy result capture. Enabling a generic shell would not establish evidence provenance or make repository scripts safe by itself. This pass continues to report checks as not run inside native workflow invocations.
- A human-selected polishing continuation could retain the original worktree, include the selected review findings and record a new attempt before returning to human review. No automatic retry, publication or acceptance is introduced here.
- The existing previous-results controls should be reviewed when authoring workflows: CF-133 deliberately bound only `plan` to Build, whereas current default workflows bind `plan` and `design`. This pass preserves those selections and strengthens the plan's source/quality handoff instead of silently adding context.

## Untested scope

No paid vendor execution, native workflow delegation/test execution, local full real-Obsidian suite, personal-vault launch or live external-service mutation. No claim that the original CF-133 source-written tests passed. No lifecycle/Obsidian-API change was made; the new host journey and dev reload were qualified. Local Node/npm are 24.20.0/11.21.1; repository pins are 24.21.0/11.19.1. The owner's follow-up authorizes committing and pushing `codex/cf133-increment-quality`, opening a PR and merging only after all required checks are green. Final PR CI will also qualify full browser/native suites through the `e2e` label.

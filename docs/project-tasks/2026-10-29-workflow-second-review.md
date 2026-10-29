# Research-informed workflow improvement and polishing plan

- Status: implementation, independent review and polishing complete; final qualification and merge are tracked in [PR41](https://github.com/Luis85/coforge/pull/41). The owner explicitly requested this second review on 2026-10-29.
- Parent: [Workflow templates and UX increment](2026-10-29-workflow-templates-ux.md).
- Outcome: make designing, reusing, operating and repairing a workflow understandable
  without weakening the plugin's data, execution or review boundaries.
- No generated req-/vi- obligations apply; their imported arrays remain empty.

## Review method and evidence

The parent oversees three subagents: template/domain/runtime integrity, authoring
and operation UX, and independent browser/native/accessibility validation. The
first implementation received focused behavioral tests, a source-backed browser
journey in each theme, a proposal-template preflight journey and five inspected
after captures. Full aggregate gates were still running when the owner requested
this further review; preliminary results are distinguished from final evidence.

Evidence for this review is the actual implementation and
`reports/workflow-audit/after/01-workflow-runs.png` through
`05-council-workflows.png`. Focus diagnostics were saved and inspected in
`reports/workflow-audit/focus/focus.json`, `new-template.png` and
`delete-template.png`: explicit creation and deletion left focus on the document
body. Screenshots do not prove screen-reader compatibility, provider enforcement
or complete accessibility compliance; behavioral, browser and host checks cover
separate claims.

## Research and its application

The recommendations below are inferences for CoForge's existing user goals,
not a claim that another product's behavior should be copied wholesale.

| Primary source | Relevant pattern | Application to this increment |
| --- | --- | --- |
| [Obsidian Templates](https://obsidian.md/help/plugins/templates) | Templates are authored notes in a vault folder. | Keep canonical Markdown and a direct open-note action; distinguish CoForge's literal output guidance from Obsidian's variable substitution. |
| [Obsidian Vault API](https://docs.obsidian.md/Plugins/Vault) | Use the host vault operations and atomic processing for content edits. | Retain exact-content checks and unrelated frontmatter; use the native file manager for user-preferred deletion. |
| [RFC 9110, If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match) | Strong preconditions prevent lost updates. | Preserve whole-note revision checks; conflict recovery must not silently replace a newer note. |
| [n8n workflow history](https://docs.n8n.io/build/manage-workflows/view-change-history.md) | Definition versions and execution history answer different questions. | Label captured run configuration separately from future settings and show the template revision that actually ran. |
| [GitHub workflow reruns](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) | Reruns preserve the original commit/ref. | Use captured content as a provenance analogy; CoForge still revalidates current host permissions and recovery gates. |
| [Power Automate designer](https://learn.microsoft.com/en-us/power-automate/flows-designer) | Ordered process elements and focused configuration keep authoring manageable. | Maintain a readable step overview, current configuration summaries and a selected-step editor. |
| [GOV.UK Details](https://design-system.service.gov.uk/components/details/) | Disclose secondary detail without hiding information most users need. | Keep task, result, template and current agent/automation summaries visible; disclose detailed controls. |
| [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/) and [validation](https://design-system.service.gov.uk/patterns/validation/) | Preserve entered data and connect errors to the fields needing repair. | Provide a per-step repair summary that opens the relevant section and focuses its control while keeping the draft. |
| [WAI disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) and [button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) patterns | Keyboard operation and context changes need predictable focus. | Use native disclosures and explicit, scoped focus handoffs for template creation, cancellation and deletion. |
| [WCAG focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow) | Keep operation order meaningful and test narrow reflow at 320 CSS pixels. | Fix observed lost focus and expand the existing 360px evidence to 320px. |

## Findings across product perspectives

| Perspective | Already present | Concrete remaining gap |
| --- | --- | --- |
| Product/task success | Project ownership, explicit saves, AI/human steps and Markdown CRUD. | A missing template can silently hold automatic admission without a visible explanation. |
| Information architecture | Monitoring, workflow design and Herdr administration have separate local tasks. | Collapsed configuration hides current agent/access/automation values needed to compare steps. |
| Reuse and extension | Template selection is optional and shared within its project. | The selected template needs same-step inspection, and deletion needs known saved dependency names. |
| Interaction and content | Purpose-first editing, readable bindings, guided recovery and next actions. | A different step's invalid hidden field can disable Save with no direct repair action; nudge steps need accurate summary counts. |
| Accessibility | Native controls, named fields, keyboard reorder, semantic current step, theme/reflow tests. | Observed body focus after create/delete; 320px coverage is missing. |
| Reliability/data integrity | Atomic content edits, revision conflicts, immutable admission snapshots and stale-result checks. | A silent automatic admission failure needs a durable hold and an explicit recovery path. |
| Privacy/security | Private folder reservation, no public template projection, no content/path logs, schema/tool/review checks. | Preserve these checks in every new display/query; partial dependency reads must be labelled unknown. |
| Trust/provenance | Runs already retain exact template bytes. | Template-only edits leave no visible account of which version produced the result. |
| Maintainability/performance | Shared library/picker and narrow ports; runtime and test size caps. | Duplicate detection uses repeated scans; composition reached the size cap when the new port was forwarded. |
| Compatibility/testability | Versioned definitions, legacy defaults, actual source-backed preview and pinned host tests. | Extend focused tests to researched recovery/provenance/focus paths and rerun final full gates. |

## Approved increments and acceptance

1. **Visible automatic admission hold — template agent, P1.** When a selected
   template is missing or unreadable, persist a safe explanation on the request
   before any run, job or provider request exists. Do not retry it on every timer
   tick. Workflow runs shows the explanation and configuration/retry actions.
   Repair plus an explicit start clears the hold. Tests assert no fabricated
   attempt, no provider call, one hold fact and successful explicit recovery.

2. **Captured configuration — template agent, P2.** Add read-only configuration
   details to the current run and retained history: workflow revision, capture
   time, template name/revision/Markdown and the steps using it. Use snapshots
   only. Editing/deleting the live template must not change the displayed
   evidence or cause a host/template lookup or provider request.

3. **Actionable authoring validation — UX agent, P2.** Summarize invalid steps
   with meaningful names and repair actions. Activating one selects the step,
   opens its required disclosure and focuses its invalid control. Preserve every
   valid and invalid input. Domain checks remain authoritative; no permissive
   coercion or bypass is introduced.

4. **Visible current configuration — UX agent, P2.** Summarize provider/model,
   access and automatic/manual behavior on the collapsed sections. Show a
   read-only source preview of the selected saved template at the step. Include
   nudge steps accurately in the process summary. Test that summaries follow
   edits and selection without saving or dispatching.

5. **Predictable focus and narrow panes — validation agent, P2.** After an
   explicit New template action, focus Template name. After deletion, focus a
   surviving library control; cancellation returns to the initiator. Background
   refreshes and late responses from another project must never steal focus.
   Exercise settings, library, runs and proposal steps at 320 CSS pixels and fix
   measured overflow, with keyboard and axe checks.

6. **Dependency-aware template deletion — parent implementation, independently
   validated by the other agents, P2.** Before deletion, list known saved request
   and proposal workflow/step names referencing the stable template ID. Exclude
   unsaved drafts and explain that captured runs are separate. Failed reads show
   incomplete information, never a false zero. Refresh is read-only, project
   scoped and safe against late responses. Deletion never detaches a step or
   rewrites history; future missing-reference admission still blocks. Existing
   JSON transfer warnings explain that Markdown files are separate from IDs.

7. **Focused structural refactor — template agent and parent, P3.** Use a count
   map to detect duplicate template identities while retaining all repair
   results. Extract live Council private-folder access into the existing
   privacy module, leaving lifecycle composition below its unchanged line cap.
   Existing privacy, duplicate, lifecycle and runtime tests must pass.

8. **Final improvement/polish and release review — all, overseen by parent.**
   Inspect one batched final capture set at desktop/narrow widths and both
   themes, plus actual native evidence. Fix concrete remaining findings together
   and confirm affected journeys. Update view contracts, operator guidance and
   real command evidence. Run self-review, open the PR, opt into browser/native
   CI and merge only the final fully green revision.

## Verification and closeout

Each increment has behavioral tests before its implementation. Required final
commands: `npm run check`, `npm run verify:project`, `npm run test:ui-quality`,
`npm run ui:gallery`, `npm run test:e2e`, `npm run test:obsidian`, and
`npm run -s dev:obsidian -- --json`. Review actual screenshots/logs, run view
catalog and source/whitespace checks, and complete the project's self-review
skill and PR template. Report retries and environment failures honestly; no
thresholds, lint rules, tests or baselines may be weakened to make evidence green.

No paid model, personal vault, live streaming service, new execution model,
branching language, implicit autosave/deployment, release tag or automatic code
approval is introduced by this plan. All final result lines and remaining
untested scope will be appended below.

## Results

All approved implementation increments are complete. The independent reviews
found and corrected discard focus, long unbroken run-name overflow and contextual
button labels missing their visible words. Actual 320px geometry now reports
selected/captured/page widths of 224/224px and an empty overflow list. Four focused
browser scenarios passed, mandatory UI quality passed 8/8, and 40 fresh gallery
frames were generated with representative and focused workflow images inspected.

Additional integrity checks reproduced a valid-indented-YAML write defect; the
codec now preserves indentation/comments and validates the assembled note before
writing. Four storage regressions passed. A native journey race now awaits actual
settings-save completion without relaxing navigation guards or test budgets.

Test reporting now retains JSON and JUnit alongside the original reporters, and
CI uploads those diagnostics and workflow proof images. No test, timeout, output
bound or lint rule was weakened. This exposed concurrent upstream documentation
link drift; integration preserves the author's changed ownership/order while
normalizing supported links and regenerating derived navigation evidence.

Final full project/browser/native checks, smoke output and merge status are
recorded on PR41. Untested scope remains paid providers, live streaming services
and personal vaults. Local resource/time-budget failures and the isolated-port
qualification are recorded explicitly in the parent task and PR evidence.

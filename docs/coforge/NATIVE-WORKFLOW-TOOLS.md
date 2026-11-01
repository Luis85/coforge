# Coding worktrees and captured tool profiles

New native Build and code-polishing attempts use the provider's normal coding
tools in a dedicated owned worktree: file tools, shell, project tests and native
assistants. New MCP-driven coding tasks use CoForge's task-scoped coding tools
and project commands in their owned worktree. Ordinary coding needs no Docker
image or approved-command list.

## Start normal coding

Choose a supported native provider, its model, and worktree editing for a Build
step in Project settings → Agent workflow → Workflow settings. Enable real
implementation for the project in Agent workspace, then save the workflow.
The existing project, runtime, cost, lifetime and human review gates still apply.
Saving settings does not dispatch work. MCP clients follow the captured task
workflow described in [Local MCP integration](MCP.md).

At admission CoForge captures `worktreeCoding` on the attempt:

| Captured profile | Execution |
| --- | --- |
| `native-worktree-v1` | The selected Claude Code or Codex invocation uses normal coding tools in its worktree. The native provider directs its own assistants. |
| `mcp-worktree-v1` | The external MCP client uses the task's CoForge coding tools and project commands. The client directs its own agents; no SDK assistant concurrency is invented for it. |
| No marker | An already admitted attempt retains its original tool contract. Its present-day step definition does not grant new capabilities. |

New eligible admissions receive the current coding profile even when they use
an older saved workflow. Their saved custom instructions and previous results
are preserved. Review instructions that still prohibit the coding or tests you
intend. Classifiers, text-only passes and read-only analysis retain their
intended restricted access. Simulation and Herdr retain their separate behavior.

## Permissions, assistants and lifetime

A worktree separates Git changes; it is not an operating-system sandbox.
Execution uses the supported provider or command permissions of the desktop
account running the attempt. CoForge requests no administrator elevation or
bypass-permissions fallback.

Internet research is allowed for these ordinary coding profiles. Claude Code
can use its available WebSearch and WebFetch tools; Codex coding invocations
enable shell networking and live web search. MCP project commands use normal
desktop connectivity, and the external client controls its own research tools.
Provider, account and network restrictions still apply: permission does not
guarantee that a site is reachable or establish that research actually ran.
Retrieved pages are untrusted source material, not instructions that expand the
task's authority. Keep citations and observed results distinct from claims.
Already admitted restricted and legacy attempts retain their captured scope;
this allowance does not add research tools to them.

Native coding defaults to at most two concurrent provider-native assistants.
The Coding and native tools section can save another supported limit. This is
concurrency permission, not proof that any assistants ran or a lifetime count.
The optional Improve & polish configuration shares its saved assistant limit
with restricted text-only passes; it does not grant them coding shell access.

Existing captured deadlines and provider-specific limits remain in force.
Missing background deadlines do not acquire an invented fallback. Supported
limits and provider-reported billing remain distinct; a configured USD cap is
not an invoice. Original-process ownership and cancellation apply to the parent
and its owned execution. Recovery never authorizes automatic replay.

Codex keeps its existing native CLI sign-in and may include global AGENTS.md
and skills as context. CoForge's captured task and instructions are not the
complete SDK prompt. Context is not a tool permission grant. Runtime/model
state and provider credential handling retain their existing ownership rules.

## Inspect what happened

Use the private card's Sessions tab for bounded live observations and read-only
Peek. Activity and Captured configuration show the exact admitted coding
profile, provider, model and attempt. Missing markers remain visibly legacy.
Native assistants appear only when their identities were actually observed;
MCP command observations do not become CoForge-owned SDK children.

Increment separates the agent's summary and written test notes from captured
tool observations. Native SDK tool turns are provider-observed evidence. MCP
project command events retain host-observed outcomes. A completed tool turn or
exit zero is not proof of every acceptance criterion or of unchanged current
source. Source comparisons are displayed only when independently recorded.
Missing, interrupted and unknown outcomes stay explicit. Polishing evidence
retained through Apply remains historical until execution in the new worktree
is actually observed.

The AI costs tab reads retained project-and-request usage, including failed and
cancelled attempts. Unknown amounts are not zero; manual fallback and provider
reports keep their provenance. Native assistant observations are not counted
as additional charges on top of canonical task totals.

If an original process or command may still be running, inspect its exact
retained execution before releasing the workspace or starting another attempt.
Readonly Sessions supplies navigation to the evidence that exists; it does not
offer Retry, takeover or process input. Human acceptance remains required.

## Legacy isolated verification

Already captured Docker verification profiles and their command records retain
their original meaning. Explicit restricted read-only checks can still use the
advanced profile. These records stay separate from native and MCP coding-worktree
commands. [Legacy scoped tools and isolated verification](LEGACY-WORKFLOW-VERIFICATION.md)
contains the retained Docker setup, command, isolation and recovery details.

See [Inspect workflow sessions](AGENT-SESSIONS.md) for capture limits and
read-only terminal follow, and [Local MCP integration](MCP.md) for the coding
tool protocol. This guide does not change already captured attempts.

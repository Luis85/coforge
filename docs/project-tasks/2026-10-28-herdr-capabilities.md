# Herdr workflow-provider capability findings

Verified on 28 October 2026 using the configured native **Herdr 0.9.5** executable,
its bundled API schema, the pinned upstream source and the installed **Herdr
Companion 0.5.0** source. This investigation used version/help/schema reads only.
No session was started or changed, no prompt was submitted and no agent was
started, focused, interrupted or charged.

## Verified interface

These commands were inspected successfully. They do not require controlling a
running agent:

```text
herdr --version
herdr --help
herdr agent --help
herdr agent start --help
herdr agent prompt --help
herdr agent wait --help
herdr agent read --help
herdr agent get --help
herdr api --help
herdr api schema --help
herdr api schema --json
```

The supported mutation/read forms, shown here as interface documentation rather
than commands performed during QA, are:

```text
herdr --session SESSION agent start NAME --kind KIND --pane PANE --timeout MS -- AGENT_ARG...
herdr --session SESSION agent prompt TARGET TEXT --wait --until idle --until done --timeout MS
herdr --session SESSION agent get TARGET
herdr --session SESSION agent read TARGET --source recent-unwrapped --lines N --format text
```

`agent start` launches the kind's canonical executable in an available shell pane.
Its arguments after `--` pass through literally to that executable. Model selection
therefore belongs to a vendor-specific launch profile. The official automation
guide demonstrates Codex startup with an argument tail `-m MODEL`; CoForge's existing
Claude adapter already uses its native `--model MODEL` argument. Other vendors'
flags must be verified before being offered as supported launch profiles.

Herdr has **no model catalog, generic set-model method or model field on
AgentPromptParams**. An existing live agent's model cannot be changed or verified
through a generic Herdr model API. Putting a requested model name into prompt text
would not configure its actual execution model.

Sources: [pinned agent command implementation](https://github.com/herdrdev/herdr/blob/v0.9.5/src/cli/agent.rs),
[official automation guide](https://herdr.dev/docs/agent-automation/).

## Completion and result boundaries

The bundled schema matches the pinned definitions:

- `AgentStartParams`: name, kind, pane ID, argument array and startup timeout.
- `AgentPromptParams`: target, text and optional lifecycle wait options.
- `AgentInfo`: pane/terminal/workspace/session identity, status/readiness, revision,
  state-change sequence, optional completion sequence and generic metadata tokens.
- Agent reads expose terminal text/ANSI snapshots. They are not a task-result API.

There is no generic structured stage-result, model-verification or usage/cost field.
Generic tokens are metadata and cannot be assumed to contain authoritative billing,
model or per-task completion information.

`agent prompt --wait` observes activity and settled lifecycle states; it does not
identify individual turns. An already-working agent's current turn may satisfy the
wait. Standalone `agent wait` may return immediately for an already-matching state.
Idle, done, a completion sequence, and a prompt acknowledgement cannot alone prove
that this particular CoForge request completed successfully.

Terminal reads can include prompt echo, earlier work and untrusted text. Automatically
parsing recent terminal JSON or a literal marker as a successful stage response
would permit stale or echoed content to advance a request. Any automatic handoff
needs a task-correlated artifact protocol plus identity, request revision and schema
validation; otherwise completion must be an explicit reviewed import/confirmation.

The installed Companion worker follows the latter boundary: dispatch remains
submitted/reserved, terminal snapshots and run review stay separate, and a streamer
explicitly finishes or advances a stage. It does not automatically promote agent
output or idle/done into a workflow transition.

Sources: [pinned agent schema](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/agents.rs),
[official lifecycle semantics](https://herdr.dev/docs/agent-automation/);
installed Companion worker-runtime and worker documentation.

## Permission and ownership boundaries

Herdr controls terminal locations and recognized agents; it does not enforce
CoForge's per-stage tool/schema policy. A prompt instruction is not equivalent to
the existing native runner's restricted launch arguments. Dedicated launch profiles
must preserve the applicable vendor restrictions and actual workspace/worktree
boundaries. Existing externally managed agents must not be represented as having
verified restrictions that Herdr cannot attest.

Before any workflow mutation, CoForge must verify the configured session, compatible
server, canonical project directory and the selected agent's pane/terminal/workspace
and native-session identity. A ready observation is necessary but does not authorize
reusing a target whose identity changed. No agent should be restarted or have its
model changed merely to make a saved setting appear satisfied.

Workflow delivery must share admission with the current manual Herdr controls.
The existing `HerdrService` serializes its own mutations, but a new workflow runner
cannot bypass that journal/admission and send concurrently to the same agent. A
target must remain reserved through its external attempt, not merely through the
short prompt-acknowledgement command.

Persist intent before sending; preserve uncertain delivery and never replay it on
timeout/reload. Cancelling a local wait does not prove the external process stopped.
Interrupting the original target requires renewed identity checks and an explicit
operator action. Provider-reported cost remains unavailable until a reliable source
exists; the current clearly labelled manual cost fallback remains valid.

Relevant CoForge seams:

- `src/plugin/features/coforge/application/herdr-ports.ts`
- `src/plugin/features/coforge/application/herdr-service.ts`
- `src/plugin/infrastructure/coforge/herdr-gateway.ts`
- `src/plugin/infrastructure/coforge/herdr-protocol.ts`

## Owner decisions (28 October 2026)

- Start a dedicated agent of the selected kind and model for each workflow attempt.
- Use an automatic, task-correlated result-file handoff. Never infer a result from
  prompt delivery, lifecycle status or terminal text.

The native adapter must verify the acknowledged startup argument vector and renewed
agent identity. That verifies requested configuration, not vendor-side model billing
or a proof that the model provider actually served a particular model.

The pinned startup implementation builds `argv` from the canonical executable plus
the supplied arguments, and returns it in `agent_started`. It rejects every control
character in each launch argument: a multiline system prompt must therefore be
normalized before startup. Names must match `[a-z][a-z0-9_-]{0,31}`. Preflight these
constraints and command-line size before creating external resources.

Sources: [pinned startup implementation](https://github.com/herdrdev/herdr/blob/v0.9.5/src/app/agents.rs),
[startup response schema](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/response.rs).

## Vendor launch evidence and remaining limits

Read-only installed help/version checks found Claude Code 2.1.281, Codex CLI 0.145.0
and OpenCode 1.18.22. The installed Cursor launcher referenced a missing executable;
its presence therefore does not establish a usable Cursor workflow provider.

| Agent | Verified model startup argument | Stage-policy finding |
| --- | --- | --- |
| Claude Code | `--model MODEL` | Interactive restricted/tool/permission flags exist; use a deliberately generated profile. |
| Codex | `--model MODEL` / `-m MODEL` | Sandbox and approval flags exist; complete stage-specific tool isolation has not been established here. |
| OpenCode | `--model PROVIDER/MODEL` / `-m PROVIDER/MODEL` | Help exposes agent/config selection; no equivalent restricted stage profile has been established here. |
| Cursor | Unverified | Broken installed launcher; do not claim availability. |

Claude help verifies `--restricted`, `--safe-mode`, `--tools`, `--allowedTools`,
`--disallowedTools`, `--permission-mode`, `--strict-mcp-config`, `--mcp-config`,
`--setting-sources`, `--system-prompt` and `--no-chrome` for interactive launches.
`--max-budget-usd`, `--permission-prompts none` and `--no-session-persistence` are
print-mode options; they cannot be presented as enforced interactive Herdr limits.
An application-side timeout or cancellation does not impose a vendor spending cap.

Claude file permissions use `Edit(PATH)` for both Edit and Write operations.
`Write(PATH)`, `Glob(PATH)` and `NotebookEdit(PATH)` rules do not match. Absolute
Windows paths require its documented slash/drive normalization. A classifier that
writes a result artifact needs a narrowly allowed artifact-write exception to its
otherwise tool-free policy. Planning needs read tools plus that exception; building
may edit its prepared worktree. Prompt wording does not enforce these restrictions.

Sources: installed vendor `--help`/`--version` output;
[Claude CLI reference](https://code.claude.com/docs/en/cli-reference),
[Claude permissions](https://code.claude.com/docs/en/permissions),
[Codex CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
[OpenCode CLI reference](https://opencode.ai/docs/cli/).

No live provider smoke test was performed. Startup argument acknowledgement,
interactive readiness, result artifact correlation and resource recovery need
fixture coverage before enabling automatic workflow dispatch.

## Native adapter evidence

`LocalHerdrWorkflowGateway` implements the dedicated-workspace and one-shot launch/
prompt protocol. It checks session compatibility, canonical directories, shell and
agent identities, explicit interactive readiness and exact acknowledged model/tool
arguments. Local cancellation cancels the CLI observation only; it never sends an
external interrupt. A changed nonempty native-session reference fails closed.

Claude's installed help verifies `--session-id <uuid>`. A trusted workflow UUID is
passed literally at startup and included in the exact argument acknowledgement.
The pinned native metadata shape is `{source, agent, kind, value}`. The adapter can
adopt an initially missing reference exactly once when it becomes precisely
`{source: "herdr:claude", agent: "claude", kind: "id", value: requestedUUID}` and
the entire pane/terminal/workspace/kind/name/canonical-directory identity remains
unchanged. The inspected/sent target returned to the application carries the new
reference for journal persistence. An old empty reference cannot be reused after
adoption. Missing metadata remains explicitly unattested; a prompt does not prove
native session or model billing identity.

Sources: installed Claude `--help`;
[pinned native session shape](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/agents.rs),
[trusted native-source validation](https://github.com/herdrdev/herdr/blob/v0.9.5/src/agent_resume.rs).

The generated Claude profile permits only the task artifact's write for classifiers,
repository reads plus that write for planning, and prepared-worktree edits for
building. It applies the existing command/network/secret/metadata restrictions.
Unsupported vendor policy profiles are not offered as equivalent implementations.

Validation on 28 October 2026:

- Scoped Vitest run: **2 files passed, 33 tests passed**. Covers policy arguments,
  session/target/directory compatibility, startup acknowledgement, ambiguous delivery,
  no automatic mutation replay, narrowly verified session initialization and
  cancellation without external interruption.
- Scoped ESLint with `configs/lint/eslint.config.mjs --max-warnings 0`: **exit 0**.
- `git diff --check`: **exit 0**.
- `npm run typecheck`: **exit 0** after the parallel provider-registry integration.
  Full product, UI and Obsidian gates belong to the integrated change and have not
  been claimed here.

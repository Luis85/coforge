# Native workflow assistants and verification

Workflow agents can use their provider's own native assistants. Claude Code or
Codex dispatches, waits for and combines that work inside one parent invocation.
CoForge keeps one workflow attempt; there is no CoWorker recipient picker or
separate child-dispatch queue for this feature.

## Enable assistants

In Project settings → Agent workflow → Workflow settings, select an AI step and
open **Native tools**. Enable native assistants and choose their maximum
concurrency. Save explicitly. New attempts capture these settings; existing
attempts retain their original instructions, provider, model and capabilities.
The Improve & polish configuration offers the same choices for new passes.

Native tools require a supported Claude Code or Codex installation and the
selected account's model access. Unsupported providers fail before dispatch;
CoForge never silently substitutes a provider or model. Codex discovery reports
the configured runtime's catalogue, which can include a personal catalogue
override; it is not proof of account entitlement. The provider decides whether
the exact selected model is accessible. Custom saved instructions
are preserved: revise instructions that prohibit delegation or checks when you
intend to enable those activities.

Parent and assistants use the same scoped CoForge broker, exact-content write
checks and protected-file rules. Native host shell, unrelated MCP servers and
unrestricted file/image/browser tools are not granted. Codex retains the existing
native CLI sign-in and its SDK-managed global AGENTS/skills context. Those
instructions are context, not permission to expand the captured tools. Runtime
hooks, additional MCP servers and custom agent configuration stay disabled.
The provider's working directory contains private transport data, not project
files. File-tool arguments are repository-relative paths with forward slashes.

Claude's provider budget covers native assistants and is an estimated limit that
can overshoot. Codex does not expose an equivalent enforced USD/turn cap: the
CoForge allowance limits broker calls. Foreground execution retains its elapsed
deadline; delegated background Codex also requires an explicit elapsed deadline.
Concurrency limits assistants, not a claimed lifetime count of all children.

## Authorize verification separately

In Obsidian Settings → CoForge → **Workflow verification**, save a host grant:

- A native Docker executable and a running **local Linux** engine.
- An existing immutable image ID, beginning `sha256:`. Tags are not accepted.
- Approved command IDs, labels, executables and literal argument lists.
- A command timeout and maximum number of runs per attempt.

Then select the allowed command IDs in each step's Native tools section and save
the workflow. This independent host grant is not supplied by a workflow import,
community request or agent prompt. At admission the selected command definitions,
image, timeouts and run allowance are captured. Later settings edits do not
reinterpret an admitted attempt.

The image must provide Node at `/usr/local/bin/node` for the trusted controller.
Project dependencies can be prepared in the image at
`/opt/coforge/node_modules`; they remain read-only. Host `node_modules` is never
copied, avoiding Windows/Linux native-binary incompatibility. CoForge agents
cannot pull/build an image or install dependencies on the desktop.

For a Node project, prepare a trusted image outside the agent workflow using its
exact dependency lockfile. A minimal Dockerfile is:

```dockerfile
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
WORKDIR /opt/coforge
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-fund
```

Choose a reviewed immutable base appropriate for the project. Explicitly build
the image, inspect its local ID with `docker image inspect`, and save that ID in
the host grant. Projects needing build/install scripts or additional runtimes
must prepare those requirements in their trusted image. Test execution does not
perform that preparation or gain network access.

## What a command can access

Commands run at `/work` in a writable private source copy, as UID/GID 65534.
Only filtered source bytes are mounted read-only from the host. Host home,
credential storage, Git metadata, managed vault folders, links and host dependency
trees are excluded. Inherited image environment and health checks cannot preload
project code into the trusted controller.

Each container has no network, a read-only image, no Docker socket, 2 CPU units,
1 GiB memory and a 128-process limit. Source capture is bounded to 50,000 files,
256 MiB and depth 40; oversized or unsafe snapshots are refused. Output is
redacted and clipped to 8 KiB per command and 64 KiB per attempt, without stopping
a healthy command merely because it printed more text.

The native agent calls `coforge_run_tests` with an approved command ID. It cannot
supply another executable, arguments, environment, mount or network policy.
Ordinary failures can be repaired through scoped file tools and tested again
within the captured allowance.

## Read outcomes and recover

Use **Sessions** on a private Idea card for live read-only Peek and terminal
follow. See [Inspect workflow sessions](AGENT-SESSIONS.md) for capture limits,
native child attribution and supported terminal hosts.

Activity and Increment distinguish observed completion, failure, interruption,
unavailability and unknown outcomes. Exit zero records command completion, not
proof of every acceptance criterion. Each record retains its actual command,
attempt, image, timestamps, source fingerprint and bounded output. Changes after
a command make earlier results historical. Read-only post-Build checks remain
attributed to their producing review attempt. Polishing Apply retains producer
evidence as historical until the new worktree is verified.

CoForge records the instructions and task text it supplies. The native SDK may
add its own global instructions, skills and built-in context; the record does not
claim to capture every provider-generated prompt augmentation.

Original provider/container ownership is private. Stop and recovery act only on
matching original identities. Lost outcomes never authorize automatic replay.
Use **Check original execution** when recovery is required. An explicit operator
acknowledgement of an inspected stopped provider is distinct from OS proof;
containers must first have verified termination. Private Codex SQLite, log and
model-profile state is removed after known completion or attributable recovery.
CoForge never copies, synchronizes or deletes the native credential bundle. The
SDK refreshes its canonical credentials normally. Native rollout files remain
in provider-owned storage, outside CoForge cleanup. The SDK may index existing
rollouts into invocation SQLite; the native ownership boundary prevents access
to another invocation's assistants, including known indexed child IDs.

## Provider references

- [Claude native subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude structured finalization](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- [Claude whole-query cost and token coverage](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- [Codex native subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex permission boundaries](https://learn.chatgpt.com/docs/permissions)

Qualification and installation-specific limits are recorded in
[the implementation report](../project-tasks/2026-11-01-native-workflow-agents.md).

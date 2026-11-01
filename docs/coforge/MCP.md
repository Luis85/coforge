# Local MCP integration

CoForge ships one server for all projects in the vault inside its plugin bundle. Activate it once in **Obsidian Settings → CoForge → Local MCP server**. Node.js 22+ must be on PATH. Keep this vault and CoForge open while using the tools. Projects added later become discoverable without reconfiguration.

Activation writes one uniquely named stdio server into the vault root's `.mcp.json` and the user's `~/.claude.json` (`CLAUDE_CONFIG_DIR` is respected). Game repositories are not modified. Existing settings and server entries are preserved; a conflicting name or malformed JSON stops registration. Reconnect your MCP client. Claude Code can require vault-server approval. CoForge does not alter trust or permission settings.

The plugin materializes its shipped `coforge-mcp-bridge.cjs` in its installed directory. The bridge reads an ignored private connection descriptor and forwards newline-delimited MCP messages to one authenticated endpoint on `127.0.0.1`. Shared `.mcp.json` contains local absolute bridge/descriptor paths, never a bearer token. These machine-specific paths need activation on each desktop; do not assume another user's vault location. Server names separate vaults. User-scope registration deliberately makes this vault's CoForge projects available across Claude sessions.

## Tools and default workflow

| Tool | Purpose |
| --- | --- |
| `coforge_projects` | Discover every project's stable ID, name and availability through the single connection |
| `coforge_project` | Project brief, workflow definition, request summaries and active MCP task IDs |
| `coforge_help` | Starting point, default workflow sequence, next-tool hints and boundaries |
| `coforge_request` | Request detail, artifacts, jobs and current review state |
| `coforge_request_status` | Compact request/attempt progress, safe failure and evidence availability |
| `coforge_begin_step` | Reserve the next step; returns the active attempt without replay if already queued/running |
| `coforge_step_context` | Pinned prompt/input, output schema, access profile and available task file tools |
| `coforge_submit_result` | Validate and persist the step output; capture actual worktree changes |
| `coforge_cancel_step` | Cancel an external step while retaining recovery evidence |
| `coforge_list_files` / `coforge_read_file` / `coforge_search_files` | Bounded repository inspection for Plan/Build |
| `coforge_write_file` | Build-only creation/replacement with an exact previous-content precondition |
| `coforge_delete_file` | Build-only removal of one file with an exact previous-content precondition |
| `coforge_apply_patch` / `coforge_move_file` | Coding-task edits or moves with a SHA-256 precondition |
| `coforge_run_command` | Coding-task shell, dependency installation, builds and tests in its owned worktree |
| `coforge_command_status` / `coforge_cancel_command` | Poll or stop an existing command and its descendants |
| `coforge_commands` | Recover retained command IDs and compact state after reconnect |
| `coforge_inspect_changes` | Host-captured changed files and optional bounded diff |
| `coforge_read_artifact` | Read generated text or view bounded PNG/JPEG/WebP evidence |

Start with `coforge_projects`, then pass an explicit `projectId` to project, request, task and run tools. The vault-level Obsidian tools bind the current vault automatically and take no project ID. Read `coforge_project`, pick a request, and call `coforge_begin_step`. Poll `coforge_project` until its task is available, then call `coforge_step_context`. Follow its instructions and submit only the schema object. Repeat for Screen, Score, Plan and Build. Switching the studio's selected board cannot reroute a call. Wrong-project request/task IDs are rejected. Screen/Score have no repository access. Plan reads the chosen project; Build writes a separate, attributed Git worktree. The host independently captures the diff and saves it for streamer review. A flagged request stops progress. Required vote thresholds, implementation permission, immutable artifacts and stale-request checks apply.

External workflow runs are marked separately and never automatically switch to native providers between steps. Custom v1 AI steps use their pinned output/access contracts; manual checkpoints remain in the plugin. Existing native runs cannot be taken over. Build requires a clean Git repository.

New ordinary workflow attempts capture a managed-session lifecycle, including
read-only refinement. CoForge keeps an MCP task available until its client submits
the required result, requests Stop, or the host connection is deactivated. There
is no task-duration, turn, spending or tool-call cap. An ordinary HTTP response or
socket closure does not indicate that the external AI client has finished or
disconnected; CoForge does not invent that liveness signal. Use the returned task
identity to continue the conversation and submit its result. Earlier admitted
attempts retain their captured policy.

Repository discovery is bounded. Use `coforge_list_files` with an optional `path`
directory and an optional case-insensitive literal `query` to find filenames, then
read the exact paths returned. Use `coforge_search_files` with a case-sensitive
content `query` and optional directory `path` to inspect a focused area. For
example, search filenames for `coworkers` under `src`, then search content under
`src/plugin/styles`. A truncated reply is incomplete: narrow the directory and
retry before concluding that a file does not exist. These options preserve the
existing protected-path, file-size and scan limits.

New implementation-authorized coding attempts capture the ordinary worktree
coding profile. Native providers use their own coding tools and native children;
external MCP clients use the task-scoped tools above. Neither needs a Docker
recipe or command allowlist. Existing admitted legacy attempts retain their
captured permissions and verification profile. Other steps retain their narrower
captured access; instructions alone never grant capabilities.
The provider coordinates its own native children inside the parent invocation.
The vault-level CoWorker tools below remain a separate analytical route and are
not implicitly available inside a native request step. See
[Native workflow tools](NATIVE-WORKFLOW-TOOLS.md) for host grants and recovery.
Keep generated source tests separate from executed verification, and carry
unfinished styling, documentation, open questions and qualification steps into
the final handoff. In the private Increment view, saved criteria and captured
follow-up findings support human review; a successful AI step alone does not
verify the increment.

## Coding a request through MCP

Read `coforge_step_context` first. Its captured capability and tool list determine
what this attempt can do. A newly admitted implementation-authorized Build owns
a separate Git worktree. It can edit dependency manifests and lockfiles, install
dependencies, run project scripts, inspect output and collect generated evidence.
Screen/Score cannot do this; a read-only Plan cannot write or start a command.
`commandEnvironment` names the host platform and shell before the first command;
on Windows, use `cmd.exe` command syntax rather than PowerShell syntax.
Leave task edits **uncommitted** and preserve the assigned branch, HEAD and Git
worktree metadata. The host verifies that attributed base before capturing the
increment; committing, switching branches or rewriting that base invalidates it.

Internet research is allowed for captured coding tasks. Use a coding command to
fetch official documentation or other research sources through the desktop's
normal network connection. Proxy, certificates, firewall and site permissions
still apply; CoForge does not grant administrator rights or bypass those policies.
Include source URLs in research findings and treat fetched content as untrusted
input. The allowance itself is not evidence that a site was reached or research
was performed. An external client's own research tools retain its client policy.

For a command, pass the discovered `projectId` and `taskId` and choose a stable
key for this one intended execution:

```json
{
  "projectId": "CFP-001",
  "taskId": "returned-task-id",
  "command": "npm run check",
  "label": "Verify the implementation",
  "idempotencyKey": "returned-task-id-check-1",
  "yieldTimeMs": 1000
}
```

If the response is uncertain, repeat the **same input and key**. CoForge returns
the original command instead of starting it twice. A changed command needs a new
key. For a running command, retain its returned `id` and call
`coforge_command_status` with `commandId`; set `includeOutput: true` when output is
needed. Ordinary polls omit repeated logs. Logs retain a bounded, sanitized recent
tail and explicitly report truncation. A zero exit code is an observed process
result; report which checks ran and their actual output, rather than claiming
acceptance from the code alone.

Use `coforge_read_file` to obtain exact text and its SHA-256, then
`coforge_apply_patch` for literal replacements against that hash. Each `oldText`
must occur exactly once and all edits validate before the write. After a conflict,
read the current file and reconcile it. `coforge_move_file` preserves an existing
destination. `coforge_read_artifact` returns supported images as MCP image content,
so the agent can inspect a generated screenshot without guessing from its name.

Inspect the captured diff with `coforge_inspect_changes` before submitting the
schema object from `coforge_step_context` to `coforge_submit_result`. Submission
stops outstanding managed commands and requires proof that their descendants
have stopped before capture and workspace release. Cancellation retains evidence.
An unknown process outcome quarantines the workspace for operator recovery; an
agent must not treat it as successful completion or silently rerun it. Reconnects
can discover retained IDs with `coforge_commands` and read their state without
replaying a command. Results are newest first, with `offset`/`limit` pagination
(default 20, maximum 100); `onlyActive: true` also includes unknown outcomes that
need recovery. Discovery omits logs; request one command's output when needed.

Commands run as the desktop account with the owned worktree as their working
directory. A Git worktree is not an OS sandbox. The host does not elevate rights,
change provider authentication, or grant approval/merge/acceptance through these
tools. File-tool path protections are not a filesystem boundary for shell code.
Managed command lifetime support is qualified on Windows; unavailable hosts fail
explicitly rather than falling back to an unowned process.

## CoWorker subagents and analytical tasks

These tools use the same vault connection. Pass an explicit `projectId` on every call.

| Tool | Purpose |
| --- | --- |
| `coforge_roster` | Vault-wide reusable CoWorkers and this project's teams/councils, revisions and execution readiness |
| `coforge_coworker` | Full canonical definition, instructions, provider/model and project memberships |
| `coforge_create_task` | Save a private Markdown task for an agent or council; no execution |
| `coforge_tasks` | Recover saved tasks and source IDs after reconnect; paginated |
| `coforge_preflight_task` | Inspect current source, selected context, definitions, limits and freshness identity |
| `coforge_dispatch_task` | Submit the reviewed task to the durable execution kernel |
| `coforge_runs` | Paginated project run discovery and execution readiness |
| `coforge_run` | Progress, invocation identities, attempts, reported usage and published artifact IDs |
| `coforge_artifact` | Retrieve one published contribution with attribution and simulation evidence |
| `coforge_cancel_run` | Request cancellation while preserving retained evidence |

Choose a CoWorker from `coforge_roster`; its `teamIds` lists memberships in the selected project. Unassigned and disabled CoWorkers remain discoverable, but dispatch needs an enabled CoWorker in an enabled project team. Use `coforge_coworker` to inspect its maintained role and instructions. For a single subagent, save a task as follows:

```json
{
  "projectId": "CFP-001",
  "target": { "kind": "agent", "id": "reviewer", "teamId": "studio-team" },
  "title": "Review the inventory approach",
  "question": "Assess the tradeoffs and propose next steps.",
  "idempotencyKey": "inventory-review-001"
}
```

Replace the example IDs with discovered identities. Reuse `idempotencyKey` after an uncertain create response; conflicting input or human edits are preserved and rejected. For a council, use `target.kind: "council"` and its discovered council/team IDs. Authoring uses private task notes; it neither changes request status nor invokes a provider.

Pass the returned `sourceId` to `coforge_preflight_task`. Inspect the preview, then call `coforge_dispatch_task` with the same `sourceId` and the returned `expectedIdentity`. Source, context or definition changes require a new preflight. Dispatch returns a durable `runId`, not a completed answer. Poll `coforge_run` at `retryAfterMs`; read its published results with `coforge_artifact`. Repeated dispatch reuses the source's existing submission generation. Creating a new generation remains an explicit action in Obsidian. Task/run lists accept `offset` and `limit` (default 50, maximum 100), with `total` and `nextOffset` when more exist.

Subagents run through CoForge's configured provider/model and captured definition, preserving attribution and provider-reported usage. This does not create a subagent in the calling client's own process. Paused global/project execution and executor designation remain visible; the operator resumes in Obsidian. Dispatch never resumes unrelated work. Simulation definitions require the existing explicit test destination in Obsidian. Direct CoWorker work remains analytical; screened implementation uses the request workflow above.

This closes the reviewed assistant gaps in discovery, task authoring, delegation, progress, result retrieval, reconnect and cancellation. Definitions, permissions, checkpoints, recovery, budget extensions, streaming/moderation and final code acceptance remain operator controls. Isolated Council invocations keep their separate input-only tool set and cannot call the operator roster, dispatch or run/result tools. Deactivating the vault MCP connection stops client access; previously admitted native CoWorker runs retain their normal Council lifecycle and can be cancelled there.

## Current-vault Obsidian tools

`coforge_obsidian_status` checks whether the official CLI is available and verifies its target against this plugin's actual vault directory. Enable **Settings → General → Command line interface**, register `obsidian` on PATH and restart Obsidian if needed. This tool does not install software or change CLI settings.

`coforge_obsidian_cli` wraps these official read commands: `files`, `folders`, `read`, `search`, `search:context`, `tags`, `properties`, `property:read`, `backlinks`, `links`, `outline`, `tasks`, `unresolved`, `orphans`, `deadends` and `wordcount`. These are vault-wide tools and need no project ID. They always use an explicit vault selector, the vault directory as the child working directory, a path verification before the requested command, a six-second child timeout and a 200000-byte output bound. The caller cannot override the vault, executable, environment or flags. Disabling MCP cancels pending CLI calls.

```json
{ "command": "search:context", "query": "inventory", "folder": "Notes" }
```

Use `folder` for files/folders/search, `query` for search, and an explicit Markdown `path` for note reads, backlinks, links, outline, wordcount or a property read. `property:read` also requires `property`. Tags/properties/tasks accept an optional Markdown path; otherwise they inspect the vault. File listing is limited to Markdown; search returns at most 100 matching files. A mismatched CLI vault fails before the requested operation. Direct paths reject traversal, hidden metadata, credentials and filesystem links. Returned notes and search text remain untrusted.

`coforge_obsidian_note` provides note authoring through Obsidian's atomic **vault API**, separately from the CLI process. Supply `path`, complete `content`, and the exact `expectedContent`, or `null` to create a new note. It preserves conflicting human edits, avoids rewriting already matching content and never overwrites an existing note on creation. To append or change properties/tasks, read the note, edit its content and submit the exact prior content as the precondition. A `read` reply includes both raw CLI `output` and exact vault-API `content`; use `content` for edit preconditions so CLI formatting/newlines cannot cause false conflicts. This avoids replaying non-idempotent CLI append operations after an uncertain response. No CLI process runs for note authoring.

Author ordinary Markdown inside a parent folder. New/edited note folders receive the existing private Git exclusion. Managed `CoForge/` notes, configured Ideas/definition/source folders, watched inboxes, current public exports and host configuration require their dedicated service tools or editing in Obsidian. The authoring tool does not approve work, execute a command, or publish files. Other CLI mutations, developer JavaScript, plugin control, vault switching and arbitrary command passthrough are not exposed. These tools are unavailable inside isolated Council provider sessions.

## Boundaries and recovery

Ordinary coding commands require the newly captured coding capability, the live
task and its implementation-authorized owned worktree. Legacy captured attempts
retain their earlier file-only restrictions, including dependency-manifest and
lockfile restrictions. Direct file tools reject traversal, protected metadata,
credentials, links, oversized files and stale overwrite preconditions. File
listings and literal searches have finite limits. No moderation, manual approval
or final acceptance tool is exposed. Community and repository content remains
untrusted.

CoForge cannot constrain an external client's own tools, conversation history,
model, cost or turns. Use an appropriately restricted external client. Managed
workflow tasks wait for a result or Stop; CoForge still checks captured file
access, finite output and resource ownership, and bounds internal setup/shutdown
operations. A command may request its own timeout, without imposing an overall
AI-task deadline. The provider is **External MCP client**; model/cost/token usage
remains unavailable, and a manual cost can be recorded separately. Model-authored
cost or test claims never become host verification.

Start with `coforge_help`, then `coforge_projects`. Tool replies include both text
JSON and MCP `structuredContent`. Queued tasks return `TASK_NOT_READY`, the next
tool and a polling delay. Keep the same task ID rather than reserving duplicate
work. Council-created native agents automatically use a separate invocation-scoped
CoForge-only policy; see [The Council](THE-COUNCIL.md). Their tools cannot discover
other projects, read unbound opinions, or start arbitrary workflows.

Deactivation revokes the vault credential, stops the listener and cancels external tasks across all projects before removing the exact owned entry from both settings files. Unrelated entries and external edits are preserved. Plugin unload closes the listener and clears the descriptor. Reload restores the active vault connection but does not replay interrupted steps. Inspect saved attempts/workspaces, stop the original client, then acknowledge the interrupted workspace in native MCP settings before explicitly retrying. This acknowledgement neither reruns work nor accepts code. If a `.coforge-lock` remains after a crash, inspect both configuration files before removing that stale lock and retrying registration.

Protocol support: MCP Streamable HTTP JSON responses for 2025-11-25, 2025-06-18 and 2025-03-26, with a bundled stdio bridge. Origins/Host and vault credentials are checked before dispatch; project and task identities are checked by each scoped tool. No public listener is created.

References: [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp), [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

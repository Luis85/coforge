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
| `coforge_begin_step` | Reserve the next step; returns the active attempt without replay if already queued/running |
| `coforge_step_context` | Pinned prompt/input, output schema, access profile and available task file tools |
| `coforge_submit_result` | Validate and persist the step output; capture actual worktree changes |
| `coforge_cancel_step` | Cancel an external step while retaining recovery evidence |
| `coforge_list_files` / `coforge_read_file` / `coforge_search_files` | Bounded repository inspection for Plan/Build |
| `coforge_write_file` | Build-only creation/replacement with an exact previous-content precondition |
| `coforge_delete_file` | Build-only removal of one file with an exact previous-content precondition |

Start with `coforge_projects`, then pass an explicit `projectId` to every other tool. Read `coforge_project`, pick a request, and call `coforge_begin_step`. Poll `coforge_project` until its task is available, then call `coforge_step_context`. Follow its instructions and submit only the schema object. Repeat for Screen, Score, Plan and Build. Switching the studio's selected board cannot reroute a call. Wrong-project request/task IDs are rejected. Screen/Score have no repository access. Plan reads the chosen project; Build writes a separate, attributed Git worktree. The host independently captures the diff and saves it for streamer review. A flagged request stops progress. Required vote thresholds, implementation permission, immutable artifacts and stale-request checks apply.

External workflow runs are marked separately and never automatically switch to native providers between steps. Custom v1 AI steps use their pinned output/access contracts; manual checkpoints remain in the plugin. Existing native runs cannot be taken over. Council/v2 protocol execution is not exposed by this increment. Build requires a clean Git repository.

## Boundaries and recovery

No shell, arbitrary path, Git metadata, dependency manifest/lockfile edits, credential-file access, moderation, manual approval or final acceptance tool is exposed. File tools reject traversal, links, binary/oversized files and stale overwrite preconditions. File listings and literal searches have finite limits. Community and repository content remains untrusted.

CoForge cannot constrain an external client's own tools, conversation history, model, cost or turns. Use an appropriately restricted external client. CoForge bounds its own task duration and file access, records the provider as **External MCP client**, and leaves model/cost/token usage unavailable; a manual cost can be recorded separately. It never trusts model-authored cost or test claims.

Start with `coforge_help`, then `coforge_projects`. Tool replies include both text
JSON and MCP `structuredContent`. Queued tasks return `TASK_NOT_READY`, the next
tool and a polling delay. Keep the same task ID rather than reserving duplicate
work. Council-created native agents automatically use a separate invocation-scoped
CoForge-only policy; see [The Council](THE-COUNCIL.md). Their tools cannot discover
other projects, read unbound opinions, or start arbitrary workflows.

Deactivation revokes the vault credential, stops the listener and cancels external tasks across all projects before removing the exact owned entry from both settings files. Unrelated entries and external edits are preserved. Plugin unload closes the listener and clears the descriptor. Reload restores the active vault connection but does not replay interrupted steps. Inspect saved attempts/workspaces, stop the original client, then acknowledge the interrupted workspace in native MCP settings before explicitly retrying. This acknowledgement neither reruns work nor accepts code. If a `.coforge-lock` remains after a crash, inspect both configuration files before removing that stale lock and retrying registration.

Protocol support: MCP Streamable HTTP JSON responses for 2025-11-25, 2025-06-18 and 2025-03-26, with a bundled stdio bridge. Origins/Host and vault credentials are checked before dispatch; project and task identities are checked by each scoped tool. No public listener is created.

References: [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp), [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

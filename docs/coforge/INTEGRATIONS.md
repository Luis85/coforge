# CoForge integrations

CoForge starts with simulated chat and simulated agents. Those modes need no account or
API key. Demo plans, diffs, test results and community activity are illustrative and do
not modify a game. The **Demo agents** / **Claude Code CLI** indicator in the studio top
bar shows which provider is selected; every saved increment also records whether it was
simulated.

All integration settings live in **Settings → Community plugins → CoForge** (the
prototype's `.env` file). They take effect immediately; no restart is needed.

## 1. Connect Claude Code

1. Install a current **native Claude Code** executable (official setup guide:
   <https://code.claude.com/docs/en/setup>). CoForge requires version 2.1.259 or later
   with `--restricted`, `--safe-mode`, `--json-schema` and `--permission-prompts none`.
   If a required flag is unavailable the job fails with an update instruction; the
   adapter never silently removes restrictions.
2. Run `claude auth login` in your own terminal, then `claude auth status`. CoForge uses
   the CLI's existing login (or `ANTHROPIC_API_KEY` from the environment Obsidian was
   started with). CLI/provider terms and usage limits apply.
3. In the CoForge settings tab set **Claude Code executable** (default `claude`; on
   Windows use the native `claude.exe`, not an npm `.cmd` wrapper — CoForge never starts
   a shell) and **Game repository** (absolute path to a trusted local Git repository).
4. In **Studio settings** inside the studio, choose **Claude Code** and save, or press
   **Check Claude Code**. The check only probes the CLI version; it makes no model call.
5. Run screening/scoring manually on a harmless idea first. These stages have no tools
   and run in an empty temporary folder. Planning reads the repository.
6. To allow real game edits, enable **Allow real implementation**. The game must be a
   Git repository with at least one commit and a clean working tree.

| Stage  | Filesystem/tool access                                        | Saved result |
| ------ | ------------------------------------------------------------- | ------------ |
| Screen | No tools; new empty temporary directory                       | Verdict, explanation and signals (idea note properties) |
| Score  | No tools; new empty temporary directory                       | RICE inputs and assumptions; CoForge calculates the score |
| Plan   | `Read`, `Glob`, `Grep` in the game repository                 | Steps, acceptance criteria and risks (idea note properties) |
| Build  | `Read`, `Glob`, `Grep`, `Edit`, `Write` in a new Git worktree | Actual changed paths and diff, branch and worktree (plugin data) |

Community text is passed to Claude through **stdin** as structured data, never as a
command-line argument. Every run uses non-interactive JSON output and a stage-specific
JSON schema; CoForge validates the envelope and the fields again. Missing, malformed or
failed output becomes a failed job. Runs have a timeout and an output-size limit, and
only an allowlisted environment is passed to the child process.

### Builds and review

Each build creates a branch `coforge/<idea-id>-<run-id>` in a worktree folder (the
**Worktree folder** setting, or `<repository>-coforge-worktrees` next to the repository).
Your normal checkout stays untouched. CoForge captures the actual diff and moves the idea
to **In review**. It never runs tests, builds or package installs: real increments say
that tests have **not** been run.

Before accepting a real increment, open the worktree, inspect every change, run the
game's checks yourself, then accept or request changes. Acceptance records your
decision and credits the author; it **does not commit, merge, push or deploy**.

Failed or cancelled builds can leave partial worktrees on purpose. The job log contains
the path; clean up with `git worktree list` / `git worktree remove` after review.

### Boundaries

Screening combines local heuristics with a model classifier. It is a moderation signal,
**not proof that content is safe**. **A Git worktree is not an operating-system
sandbox.** Use a trusted repository without secrets and review generated code before
running it. The spend cap is per invocation; automated runs can make repeated billable
calls, so review automation, interval and budget settings before enabling them.

## 2. Connect Twitch chat (receive-only)

CoForge receives chat through Twitch EventSub WebSockets; no public webhook is needed.
It does **not** post to Twitch: IDs and command results appear in the studio chat.

1. Register an application with Twitch and obtain a **User Access Token** with
   `user:read:chat` for the account that reads chat (official guide:
   <https://dev.twitch.tv/docs/chat/authenticating/>).
2. In the CoForge settings tab enter the **Client ID**, **bot user ID** and
   **broadcaster ID**, then paste the token into **Twitch token** and press **Save
   token**. The token is stored in Obsidian's secret storage under the configured
   secret name — never in the vault or in `coforge-state.json` — and is never shown again.
3. Enable **Connect Twitch chat**. The status bar shows the connection state.

The adapter validates the token's client, user and scope at connection time and every
55 minutes, follows reconnect transfers and revocations, and reconnects with bounded
backoff. Twitch message IDs deduplicate redelivered events, and stable
`chatter_user_id` values keep one vote per viewer. Twitch does not replay events missed
while disconnected. An expired token shows a status message; save a new token to
reconnect.

The prototype's platform-neutral HTTP ingestion bridge is not part of the plugin.

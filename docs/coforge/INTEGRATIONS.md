# CoForge integrations

CoForge starts with simulated chat and simulated agents. Those modes need no account or
API key. Demo plans, diffs, test results and community activity are illustrative and do
not modify a game. The **Demo agents** / **Claude Code CLI** indicator in the studio top
bar shows which provider is selected; every saved increment also records whether it was
simulated.

Shared integration settings (native CLI executable, Twitch and publishing) live in
**Settings → Community plugins → CoForge**. Each project's description, repository/worktree
paths, links and agent configuration live in its **Project settings** in the studio and its
vault-backed project note. Changes take effect immediately; no restart is needed.
See [Projects](PROJECTS.md) for IDs and the required `!request <project-id> <idea>` syntax.

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
   a shell). Set the project's absolute workspace path under **Project settings → Agent workspace**.
   It may be outside the vault. A repository URL is a metadata link, not a clone or initialization action.
4. In the project's **Studio settings**, choose **Claude Code** and save, or press
   **Check Claude Code**. The check only probes the CLI version; it makes no model call.
5. Run screening/scoring manually on a harmless idea first. These stages have no tools
   and run in an empty temporary folder. Planning reads the repository.
6. To allow real game edits, enable **Allow real implementation for this project**. The game must be a
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

Every chat message, viewer name and form entry is sanitized at intake, before commands,
duplicate checks, heuristics, notes or models see it: Unicode NFKC normalization; removal of
zero-width and other invisible characters, bidirectional overrides, Unicode tag characters
("ASCII smuggling"), variation selectors, private-use and control characters; at most two
combining marks per character; normalized whitespace. Model input is sanitized again right
before each run, because idea notes can be edited in the vault. Idea descriptions and titles
are written into notes with Markdown escaped, so chat text cannot embed images, HTML, links,
tags or inline Dataview/Templater expressions. Note properties written by CoForge (titles,
names, screening reasons, plans) are defanged with an invisible word joiner inside `<%`, `%>`,
`[[`, `]]`, `{{`, `}}` and backticks, so Templater, wikilinks and inline queries never fire on them;
CoForge removes the joiners when it reads a note back.

Intake is bounded: at most three ideas per viewer waiting for screening, ten new ideas per
minute overall, requests need at least three letters or digits, and duplicates are detected
regardless of case, punctuation and spacing. Viewer names cannot pose as CoForge, the streamer
or staff. Local heuristics also flag role and delimiter injection, shell commands, links and
encoded payloads for human moderation. Model output is sanitized like chat before it is
validated and saved.

**Notes changed outside CoForge are re-screened.** CoForge fingerprints what it last wrote
for each idea (text, category, status, screening verdict, score, plan and review note). When an
idea past the inbox no longer matches — its note was edited in the vault, synced in, or added
by someone else — it returns to the inbox without its screening, score and plan, with a visible
message, before any model sees the new content. A run whose idea changes while the agent works
is discarded. Edit idea text through chat or the studio, or expect to run the stages again.

Screening combines local heuristics with a model classifier. It is a moderation signal,
**not proof that content is safe**. **A Git worktree is not an operating-system
sandbox.** Use a trusted repository without secrets and review generated code before
running it. The spend cap is per invocation; automated runs can make repeated billable
calls, so review automation, interval and budget settings before enabling them.

## 2. Connect Twitch and manage the channel

Open **Stream chat → Connection settings** (also available in the native CoForge settings).
Register a **public** Twitch application and enter its Client ID. CoForge uses Twitch's
[device authorization flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow);
it does not need an application secret or a public webhook.

1. Choose whether the streamer account also serves as the chatbot. Connect the streamer,
   open the displayed Twitch activation link and enter the displayed code. For a separate
   chatbot, connect that account separately in a browser signed into the intended account.
2. Enable **Receive Twitch chat** and save the connection. CoForge derives channel and bot
   IDs from validated accounts; the channel identity and connection state come from Twitch.
3. Opt into **Enable automatic bot messages** when ready for greetings, public replies and activated recurring messages.
   This is off by default, including upgrades. The live composer sends as the connected bot;
   **Test commands locally** is explicit and never posts to Twitch.
4. Add projects under **Projects**. Viewers discover them with `!projects` (or `!projects 2`)
   and submit `!request CFP-001 Add a lantern` or `!bug CFP-001 The gate crashes`.
   Viewers start with `!register`; requests, bugs and votes require registration. Feature requests
   have a five-minute cooldown across projects. Both request types require a known project ID.
   `!vote CF-001`, `!status CF-001`, `!me`, `!ranks` and `!help` are also supported.
   The bot ignores messages authored by its own account to prevent loops.

The bot needs `user:read:chat` and `user:write:chat`. Channel controls use the broadcaster's
authorization with `channel:manage:broadcast`, `moderator:manage:chat_messages` and
`moderator:manage:banned_users`. Live chat-presence tracking also needs `moderator:read:chatters`.
When the streamer also serves as the bot, its authorization
includes both sets. Missing permissions disable controls and require reconnection.
Access and rotating refresh tokens are stored together in Obsidian secret storage, never in
project notes or plugin JSON. Legacy manual user tokens remain available under advanced settings;
they cannot refresh without a refresh token.

Channel controls support title/category updates and explicit single-message deletion, timeouts
and bans. Select **Moderate** on a current-channel message or enter a target in the moderation
form. Review the resolved account/message and confirm before the operation is sent. Changing
the channel invalidates an existing confirmation. There is no clear-all-chat action.

The adapter validates accounts at connection and every 55 minutes, serializes rotating refreshes,
follows EventSub reconnect transfers, and reconnects with bounded backoff. Stable Twitch message
and user IDs prevent duplicate requests and votes. Twitch does not replay messages missed while
disconnected; CoForge shows disconnection rather than inventing activity.

Command intake and outbound acknowledgement are persisted together. A successful HTTP response
counts as delivery only when Twitch confirms `is_sent` and a message ID. Rate limits back off;
expired or refused replies appear under **Bot delivery needs attention**. Sends with an unknown
outcome, including a crash while sending, are held as **Delivery unconfirmed** and are never
automatically replayed. Check the channel before manually sending a replacement.

Protocol behavior is tested with fake HTTP and sockets. Live account authorization, channel
permissions and moderation still need streamer-operated acceptance on a test channel.

## 3. Publish the viewer website (GitHub Pages)

Viewers can follow the idea board, leaderboards and badges on a read-only website. It
contains no scripts and no forms; votes and requests still happen in chat.

**Requirements:** the vault is (inside) a Git repository with a GitHub remote, and you
push to `main`.

1. In **Settings → Community plugins → CoForge → Viewer website**, keep or change the
   **Viewer board folder** (default `CoForge/Public`) and save.
2. Press **Set up GitHub Pages** (or run **CoForge: Set up the viewer website**). CoForge writes `.github/workflows/coforge-pages.yml` at the root of the vault
   repository and writes the board once. An existing workflow at that path that CoForge did
   not create is never replaced.
3. Commit and push to `main`. In the GitHub repository open **Settings → Pages** and set
   **Source** to **GitHub Actions**. The workflow deploys the board folder; the page URL is
   shown on the workflow run.
4. Enable **Keep the viewer board updated** so CoForge rewrites the board files a few
   seconds after the board changes, or press **Write board now** / run **CoForge: Publish
   the viewer board** when you want to publish. Every later push to `main` that changes the
   folder redeploys the site. CoForge never commits or pushes.

| File | Content |
| --- | --- |
| `index.html` | Static board (Inbox, Up next, In progress, Accepted), three leaderboards and earned badges; refreshes itself every two minutes for stream overlays |
| `styles.css` | Light and dark styles |
| `board.json` | The same public snapshot as data (`coforge-public-board/v1`) |
| `.nojekyll` | Serves the folder as-is |

**What is public:** screened ideas on the board (ID, title, description, category, status,
unique vote count, RICE score, author display name and the saved plan's summary and steps),
the number of requests still waiting for screening, leaderboards and earned badges.
**Never public:** unscreened, flagged or archived requests, platform user IDs, the chat log,
agent run logs, review and moderation notes, increments and diffs, worktree paths and all
settings. All community text is HTML-escaped, and the page sends a Content Security Policy
that blocks scripts. Files are rewritten only when the public content changes, so unchanged
boards do not create commits.

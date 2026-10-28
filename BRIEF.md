# Product brief: CoForge

> Read this before changing anything. It is the owner's statement of what this plugin
> is for; `design/` says what the prototype contains, this file says why.
> Agents: do not invent product decisions. Every `TODO(owner)` is a gap: ask the user
> to answer it, then write the answer here. This file is yours to edit and is never
> overwritten by regeneration.

## Product goal

CoForge lets a streamer and their community build a game together with AI agents,
from inside Obsidian. Viewers submit `!request` and `!vote` chat commands. Ideas get
stable IDs and flow through injection screening, RICE prioritization, planning,
implementation and mandatory streamer review. Votes signal demand; RICE remains an
explained estimate. Community recognition credits idea authors and accepted increments.

It works when a streamer can run the complete loop (request → vote → screen → score →
plan → build → review → recognition) in the studio view, with every idea kept as a
Markdown note in the vault.

Source: the owner's local prototype (`PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`
in the CoForge prototype ZIP), ported to this plugin.

## Users

### The Council (owner decisions, 2026-10-28)

The owner requested implementation of The Council PRD and explicitly accepted all
12 proposed defaults in its section 14:

1. Reusable agents belong to the vault; teams and councils belong to a project.
2. Setup creates a default project team; councils select ordered members from it.
3. The standard protocol runs independent opinions, then solution proposals, sequentially.
4. An optional chair adds synthesis without replacing any member's contribution.
5. Team information becomes context without waking every member.
6. Delegation needs explicit recipients and finite limits inherited from the root request.
7. Activation previews existing files; reload reconciles arrivals and pauses execution.
8. Ordinary edits do not rerun work; Run again creates a new submission generation.
9. Generic notes use typed analytical subjects; creating/linking an Idea is explicit.
10. Destinations share one execution kernel; councils compile their protocol into it.
11. Existing v1 workflows retain their semantics; new capabilities use explicit v2 definitions.
12. One designated desktop executes work only while CoForge is active.

Definitions are canonical Markdown. Run evidence and local publication/delivery intents
are durable and private. Each contribution must be persisted and projected before the
next invocation. Unknown provider outcomes require explicit recovery without replay.
Opinion rounds cannot read previous opinions through prompts, tools or provider history.
Editable definitions never grant capabilities or bypass final host review of code changes.
The full release scope and acceptance scenarios are in `docs/coforge/THE-COUNCIL-PRD.md`.

A streamer operating a second-screen studio while on air. The studio must be
understandable at a glance, work without credentials in a clearly labelled demo, and
connect to the local Claude Code CLI. Viewers interact only through chat.

### Stream finances (owner decision, 2026-10-27)

- First increment uses EUR and manual income/expense entry, with description, category, date and optional recorded-stream attribution.
- Recurring subscriptions/expenses are planned commitments with weekly/monthly/yearly cadence and active/paused state.
  They do not generate actual payments. Show their estimated monthly equivalent separately from actual totals.
- Provide create/edit/delete, month and stream filtering, and actual income, expenses and balance. Financial data stays
  private in the vault and is excluded from the public viewer board. No bank/payment API or automatic Twitch revenue import.

### Herdr integration (owner decision, 2026-10-27)

- Follow the local Herdr Companion approach: native executable/session configuration,
  workspace and agent controls/status, and explicit dispatch of CoForge requests to ready agents.
- This increment integrates request dispatch and workspace/agent controls, not the Companion's full
  terminal or folder-worker UI. CoForge's existing screening, automation and review remain authoritative.
- A reviewed dispatch prefixes the project's general agent prompt and includes the selected screened
  request. Verify the target agent identity and project directory before sending. Delivery is not completion.
- Persist intent before mutations; hold pending/uncertain actions across reload without replay.
  The streamer refreshes, inspects Herdr and explicitly acknowledges recovery before another mutation.

### Herdr workflow provider (owner request, 2026-10-28)

- Add Herdr to per-project workflow-step configuration, with an agent and model choice for each step.
- The installed Herdr 0.9.5 can forward model arguments at agent launch, but does not expose a generic
  existing-agent model setter/verifier or task-correlated structured result/cost API. Delivery is not completion.
- Each step attempt launches a dedicated Herdr agent with its selected agent type/model; no existing live
  agent is restarted or silently reconfigured. Initial managed launch support uses the verified restrictive
  Claude Code profile; other Herdr kinds stay available in manual controls but are not claimed workflow-safe.
- Completion uses an automatic task-correlated result file with schema validation. A matching attempt,
  project, request revision and nonce plus observed post-send settling are required; terminal text/status alone
  cannot advance work. Classifiers have one narrow result-file write exception; Plan remains read-only apart
  from that private result channel; Build edits a separate worktree and reports an independently captured diff.
- Herdr interactive agents do not expose trustworthy token/cost usage or enforce the native print-run USD/turn
  limits. Display those boundaries honestly; never substitute model-written counters or generic Herdr metadata.
- Track provider-reported input/output tokens (and cache read/create separately), retain usage on failed attempts,
  and aggregate known counters/coverage privately in AI costs. Inclusive input requires complete cache counters.
- Preserve project/agent identity checks, durable mutation intent, no uncertain-action replay, review gates,
  cost provenance and private/public boundaries. Herdr's own agent permissions must be described honestly.

### Configurable workflows (owner decisions, 2026-10-28)

- Give agent workflows their own private configuration view, separate from execution monitoring and project settings.
- Each project owns its workflow. New projects start with the standard Screen/Score/Plan/Build process.
- The streamer can add, rename, duplicate, remove, replace and reorder all steps, including core steps.
  Support AI steps and manual approval/checklist steps. Each AI step has a prompt, provider/agent/model,
  validated output contract and explicit access profile. Step IDs stay stable through edits and reordering.
- Import and export a workflow as a versioned JSON object. Import validates and previews replacement of
  the editor draft; saving is explicit and atomic. Exports contain definitions and authored prompts,
  never credentials, repository paths, job history or live workspace/recovery state.
- Preserve exact workflow revisions, instructions, inputs and agent choices for existing runs and history.
  Editing a definition cannot reinterpret an active attempt. Legacy projects resolve to equivalent standard
  definitions without rewriting their notes until an explicit save. Preserve unrelated note properties/body.
- Manual checkpoints persist without occupying the AI worker. Checklists require their required items and
  explicit streamer input; completing a checkpoint does not accept code or publish a request.
- Execution design: semantic output contracts and access permissions are separate from step identity/order.
  Prior outputs are immutable, attributed artifacts treated as untrusted input. A shared isolated run worktree
  lets later read/edit steps inspect earlier changes; every attempt keeps its own result channel and cost record.
- Host policy stays outside editable definitions: project implementation authorization, verified native tool
  restrictions, external uncertainty recovery and final streamer review of actual code changes. A process
  that ends without code changes finishes its workflow only; it does not fabricate an increment or ship a feature.
  Removing screening never automatically makes private requests public. No imported workflow starts by itself.

### Local stream music (owner decision, 2026-10-27)

- A configurable folder inside the vault (default `CoForge/Music`) contains local MP3 files.
  A same-basename Markdown companion stores title, artist, license, origin and attribution.
  The streamer supplies and reviews the rights; CoForge does not infer a license.
- Saved playlists are Obsidian-compatible frontmatter plus Markdown notes in the music folder's
  `Playlists` subfolder. Track references are vault-relative paths; refresh detects missing files.
- Playback runs inside Obsidian, continues while navigating CoForge and stops on plugin unload.
  OBS must capture Obsidian/application or desktop audio; include setup guidance. No automatic
  playback on startup or go-live. Provide play/pause/stop, previous/next, seeking and volume.
- Playlist editing preserves unrelated frontmatter and Markdown body bytes. Metadata can be opened
  or created from the library. External edits require refresh and must not be silently overwritten.

## Surfaces (from the design)

### Agent task scheduler (owner decisions, 2026-10-28)

- Save tasks with a prompt and optional explicit vault-note context, routed to an agent, a council,
  or one explicitly selected member of a project team. Team scheduling does not wake every member.
- Support one-time timers, repeating intervals and daily/weekly schedules with visible saved timezones.
- Execute only while the designated Obsidian desktop and CoForge are open. Skip missed occurrences;
  do not replay work after reopening. Existing execution permissions, finite limits, durable evidence,
  uncertainty recovery and final human code review remain authoritative.
- If a previous occurrence is still active, skip the next occurrence and display the reason.

### Streaming workspace increment (owner decisions, 2026-10-27)

- Four read-only stream views (Kanban, Twitch chat, leaderboards, community) each have a ribbon icon that
  opens a fresh tab in Obsidian's main workspace (owner revision, 2026-10-28). Tabs can be detached manually;
  detached window names remain stable for OBS capture. They expose only an explicit
  public projection, without private notes, prompts, paths, account IDs, logs, moderation controls or finances.
  Chat includes live Twitch chat only, never local simulation or private bot diagnostics.
- AI cost analytics use native USD, separate from the manual EUR finance ledger. Show costs per feature and
  every task/attempt, retain failures/retries, and distinguish reported, manual and unavailable amounts.
  Tasks without a reliable provider cost (including Herdr) allow clearly labelled manual entry. Usage cost is
  not an inferred cash payment, and missing cost is not zero.
- Each project can edit its Screen/Score/Plan/Build task prompts, starting from defaults, reset individual
  prompts and preview the assembled dispatch. Store them in the project note alongside the general prompt.
  Existing tool/output/review execution gates remain authoritative.
- Each project can also override the AI provider and model independently for Screen, Score, Plan and Build.
  Unset fields inherit that project's existing defaults; legacy notes keep their current behavior. The initial
  choices include Claude Code, Simulation and the verified Herdr managed Claude profile. Queued attempts retain their chosen
  provider/model, including when another project is selected. Configuration cannot change underneath active work.
- Review every private, native-settings and public display view for a clear user goal and next action, then improve
  concrete navigation, hierarchy, empty/error-state, accessibility and spacing findings without replacing the native design.
- The stream schedule stays local to CoForge. Each planned stream has an Obsidian-compatible Markdown note
  for topics, scripts and storyboards, plus date/time, project, Twitch metadata, OBS scene choices and a music
  playlist. Preparation is explicit; planning never automatically updates a live channel or starts playback/a stream.
- Render authored Markdown in requests, plans and appropriate long-form fields. Logs, configuration editors
  and diffs retain their source/code formatting. Rendering must not execute HTML, transclude vault notes or
  automatically load external media, especially in capture views.
- `!context CF-123 <details>` lets registered, unrestricted viewers add context to an open request. Context
  retains author/time, appends without deleting the original request, invalidates previous screening/planning
  and returns the request to screening automatically. In-flight results for an older request revision cannot apply.
- `!help` explains the viewer journey, with short follow-up topics for requests, progress and community rules.
  It is available before registration and respects Twitch's message length limit and configured actor/currency names.
- Every viewer observed through chat or available chat-presence data receives a private Markdown CRM profile,
  regardless of game registration. Preserve human annotations/unknown properties; observed fields and game
  statistics are maintained from their authoritative services. This does not identify anonymous video viewers.
  Protect private profiles, raw requests/projects, scripts, stream histories, costs/finances and plugin data from
  accidental Git publication; only the explicitly public export folder is intended for publication.
- The private studio has independent left-navigation and right-chat collapse controls, with reachable reopen
  controls and preserved drafts. CoForge's status indicators live in Obsidian's native status bar, not a studio footer.
- Private Kanban cards provide a keyboard-accessible context menu with currently valid actions. Backend gates
  remain authoritative; mandatory streamer review is not bypassed. Public capture views remain read-only.
- After implementation, perform a comprehensive product/UX/accessibility/privacy/reliability/maintenance
  review, address concrete findings in an improvement/polishing pass, and merge only after checks are green.

- CoForge studio (view, entry): idea board, stream chat, agent workflow, community, studio settings.
- CoForge settings (native settings tab): ideas folder, Claude Code, Twitch and viewer website.
- First milestone: reliable Twitch connection, chatbot request/bug intake and replies, channel title/category controls,
  and explicit streamer moderation actions (single-message deletion, timeouts and bans).
- Viewer website (GitHub Pages): a read-only, script-free page with the idea board, leaderboards and badges.

## Data it works with

- Idea notes (canonical, one Markdown note per idea in the configured ideas folder,
  default `CoForge/Ideas`): ID, title, description (note body), category, status,
  author, screening, RICE and plan properties. CoForge never rewrites the note body
  after creation and preserves unrelated properties. Ideas whose note changes outside CoForge
  after screening return to the inbox for a new screening (see docs/coforge/INTEGRATIONS.md).
- Project notes (canonical, frontmatter plus Markdown in the CoForge vault): stable identity,
  project name and brief, agent settings, and the local repository/worktree configuration.
  Each project has its own requests and workflow. A project's repository may be outside the vault;
  the vault is the streamer's CoForge command centre, not the game repository.
- Plugin data (`coforge-state.json` in the plugin folder): votes, increments,
  contributors, registered players, community environment/ranks, balances/reward claims,
  operational counters/history, recurring messages/delivery intents, chat, agent runs and settings.
- Obsidian secret storage: Twitch access/refresh token pairs for streamer and bot (referenced by name only).
- Public viewer board (default `CoForge/Public`): `index.html`, `styles.css`, `board.json` with screened ideas,
  vote counts, scores, plans, display names and badges only. Deployed to GitHub Pages from the vault
  repository's `main` by `.github/workflows/coforge-pages.yml`; CoForge writes files, the streamer pushes.

## Must-have journeys

- The streamer loads the sample workspace, sends `!register`, then `!request CFP-001 Add a lantern` in the chat
  simulator, sees `CF-116` acknowledged and a new note `CoForge/Ideas/CF-116 Add a lantern.md`.
- A second registered simulated viewer sends `!vote CF-116`; a repeated vote is reported as already counted.
- The streamer screens, scores, plans and builds the idea from the idea drawer (demo
  agents), inspects plan and increment, and accepts it; the author's badges update.
- With automation resumed, enabled stages run one at a time; restarting Obsidian pauses automation.
- With the viewer website set up, accepting an idea and pushing the vault moves its card to Accepted on the
  GitHub Pages site; flagged and unscreened requests never appear there.
- With Claude Code configured, screening/scoring run without tools, planning reads the
  game repository and building edits files only in a separate Git worktree.
- The streamer adds multiple projects, each saved as an Obsidian-compatible Markdown note,
  with a local workspace path, optional Git repository and website URL, and a description.
  Each project has a readable stable project ID and its own request backlog.
- A viewer submits `!request CFP-001 Add a lantern`. A project ID is mandatory; missing or unknown IDs
  create no request. The request keeps that project as its parent, regardless of which board the streamer is viewing.
- Projects keep processing requests in the background when the streamer views another project.
  Stream chat, the Twitch connection, contributors and community recognition are shared across projects.

## Out of scope

- Mobile (desktop-only: the Claude Code and Git adapters run native processes).
- An interactive viewer portal (the website is read-only), the prototype's HTTP ingestion bridge,
  commits/merges/pushes of the game or the vault. Twitch chatbot replies and OAuth onboarding are now in scope.

## Decisions

- 2026-10-28: ship one local MCP server for all projects in a CoForge vault, explicitly activated once from the plugin.
  Activation registers it in the vault's `.mcp.json` and Claude Code's user-level `~/.claude.json`.
  Discover projects through the shared server and require an explicit project ID on project/task tools;
  adding or changing a project needs no new MCP configuration. Do not write each game repository's settings.
  Expose step tools so external agents can perform at least Screen, Score, Plan and Build themselves,
  including the context, validated result submission and bounded repository tools needed by those steps.
  Keep project identity, screening, worktree isolation, durable attempt evidence and final streamer review.
  Preserve unrelated client configuration and make activation errors recoverable.

- 2026-10-23: the prototype's HTTP ingestion bridge for other chat platforms stays out of the plugin.
- 2026-10-23: untrusted text is sanitized at intake and before every model run; edits made outside CoForge
  invalidate screening (integrity fingerprints), and chat intake is rate-limited because every request becomes a note.
- 2026-10-26: support multiple vault-backed projects whose game repository paths may be outside the vault.
- 2026-10-26: share stream/chat/community, with separate project boards and workflow configuration.
  Switching projects does not stop background agent processing.
- 2026-10-26: viewer requests must explicitly identify their parent project. This supersedes the earlier
  selected-project routing decision. Projects expose a workspace path, optional repository and website URL, and a description.
- 2026-10-26: Git repository URLs are metadata links only. Adding one does not clone a repository or initialize Git.
- 2026-10-26: hide the native Obsidian view header inside the CoForge view; CoForge provides its own studio header.
- 2026-10-27: prioritize Twitch as the first milestone. The chatbot is the primary interface between the plugin and viewers.
  Include title/category updates, message deletion, timeouts and bans. Add `!bug <project-id> <description>` alongside requests.
  Remove fictitious channel information and redundant marketing copy; project IDs must remain legible and discoverable.
- Implementation defaults for the Twitch milestone: fresh installs start without invented projects;
  sample data and local command testing require explicit actions. Automatic public bot replies are opt-in.
- 2026-10-27: `!register` creates one persistent channel-wide player profile. Registration is required
  for `!request`, `!bug` and `!vote`; existing contributor history is preserved without silently registering people.
- 2026-10-27: viewers wait five minutes between feature requests across projects. Bug reports retain
  separate intake protections and do not consume or reset the feature-request cooldown.
- 2026-10-27: population management lists registered players and their activity/economy. Block restricts
  CoForge participation; mute is a Twitch timeout; ban is a Twitch channel ban. Actions require explicit targets.
- 2026-10-27: credit registered, eligible players observed in chat while the stream is live. Label this
  tracked chat-presence time, not verified video watch time. Do not credit offline, missing-data or disconnected gaps.
- 2026-10-27: adjustable starting rules are 1 coin and 1 XP per credited minute; 10 reputation and 10 XP
  per screened feature; 50 reputation and 50 XP per accepted feature; one rank per 100 XP (starting at rank 1).
  Registration grants no initial balance. Rewards are recorded once per milestone with durable evidence.
- Greeting implementation: prompt unregistered viewers on their first observed message, with at most
  one registration greeting per viewer per 24 hours. Public greetings use the existing opt-in chatbot reply setting.
  Registration creates the player account; spawning an actor in the external game remains a later game-runtime integration.
- 2026-10-27: maintain recurring stream messages in the plugin, with editable text and intervals plus
  per-message pause/activate. Post only while live, with automatic bot messages enabled; never replay missed intervals.
- 2026-10-27: dedicated Community settings name the community actor (default Agent) and currency
  (default gold), and configure earning rules and named ranks with minimum XP thresholds. This named
  rank ladder replaces the earlier fixed 100-XP progression decision. The starting rank is Agent at 0 XP;
  further names/thresholds are configured by the streamer. Existing balances are preserved when labels/ranks change.
- 2026-10-27: the technical review includes clear application/integration contracts, separated concerns,
  post-commit events and independent test seams for maintenance and further development.

## Open questions

- None recorded.

## Streamer workflow increment (2026-10-27)

- The plugin opens on a stream-preparation dashboard. The streamer connects an already running OBS Studio
  through obs-websocket v5, selects a go-live and BRB scene, checks readiness, then explicitly presses Go live.
- Go live starts broadcasting through OBS. Pause switches to the configured BRB scene while the stream stays
  live; Resume restores the previous scene. Stop ends the OBS broadcast. Connection/reloads never start a stream.
- OBS remains responsible for stream-service credentials/output configuration. CoForge stores only the OBS
  connection profile and a password reference; the password stays in Obsidian secret storage.
- Every committed workflow interaction publishes a named event, including requested, confirmed, rejected or
  uncertain outcomes; observed external OBS changes are distinct facts. Failed observers cannot alter effects.
- Each project has an optional general agent prompt, saved in its canonical project note and prefixed to every
  agent dispatch for that request's parent project. It does not widen the agent's allowed tools or worktree boundary.
- Remove the reserved scrollbar gutter between the main content and shared chat panel.
- The streamer can explicitly open installed OBS from CoForge. Detect standard native installations, allow a full
  executable path, reuse an existing process and wait for its local WebSocket server. Never launch a second instance
  or auto-start a broadcast. Initial OBS output and WebSocket/password setup remains required once.
- Edit Twitch title, category, tags and broadcast language in CoForge. Link to Twitch's branding editor
  for profile images, banners and accent styling; channel panels remain editable on Twitch.
- First-time stream setup is guided, optional and reopenable. Detect OBS installation/running state without
  launching it, explain missing WebSocket/authentication/scenes and Twitch app/account/permission/chat settings,
  and provide working setup controls. Readiness comes from current connections, not saved fields. Review of OBS
  output destination/audio/video is explicitly human-confirmed; the guide never reads stream keys or goes live.
- While on air, retain one private JSON history object per stream with a sample each minute, including live
  viewers/channel metadata, follower and subscriber totals/points, Twitch chat and CoForge community/request/
  bot/moderation activity, and OBS health. The streamer accepts the additional follower/subscriber read scopes.
  Unavailable measurements remain null with source status; missed/offline intervals are not invented.
- Stream statistics selects a saved stream, plots recorded metrics over elapsed stream time, and compares it
  with up to three earlier completed streams from the same channel. Charts preserve missing-data gaps and
  provide exact sample values. Audience metrics lead by default; engagement and OBS health remain selectable.
- Stream studio monitors live viewers, observed chat activity and OBS health with explicit source age/status.
  Live monitoring does not increase the one-sample-per-minute archive cadence.
- Manage OBS scenes from the plugin: create, rename, duplicate, delete and switch; manage existing sources'
  scene-item visibility, order and membership. Scene copies share existing sources. Source properties, capture
  devices and audio configuration remain in OBS. Mutations share stream-control serialization and durable
  intent/recovery; unknown effects are not replayed. Destructive actions show the exact target for confirmation.

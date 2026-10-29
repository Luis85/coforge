# Information architecture

CoForge supports one operating loop: prepare the stream, collect community ideas,
develop reviewed increments, then understand the results. Navigation follows those
tasks. The selected project scopes development work; it does not scope the shared
channel, audience, ledger or recorded broadcasts.

## Task families

| Family | Destinations, in working order | Data scope |
| --- | --- | --- |
| Build & Improve | [Idea board](views/board.md), [The Council](views/council.md), [CoWorkers](views/coworkers.md), [Agent workflow](views/workflow.md), [Project settings](views/settings.md) | Selected project; reusable CoWorkers and definition folders belong to the vault. |
| Stream | [Stream studio](views/broadcast.md), [Schedule](views/schedule.md), [Stream chat](views/stream.md) | Shared channel; scheduling can attribute a stream to a project. |
| Community | [Community](views/community.md), [Viewers](views/population.md), [Economy](views/economy.md), [Community settings](views/community-settings.md) | Shared channel recognition, observed viewers, currency prices and participation rules. |
| Insights | [Statistics](views/statistics.md), [AI costs](views/ai-costs.md), [Finances](views/finance.md), [Operations](views/operations.md) | Recorded channel evidence; AI costs spans vault projects and has its own project filter. |

[Projects](views/projects.md) is the project switcher's destination. The switcher
remains visible while working with shared channel tools. It identifies the project
used when the streamer returns to Build & Improve; it never implies that shared data is
filtered. [Studio guide](views/help.md) remains a persistent help action.

The top bar names the current data scope: the selected project and stable project
ID for project work, Channel workspace for shared channel tools, and Vault
workspace for Projects, CoWorkers, The Council and AI costs. Reusable CoWorkers and
cross-project run filters are vault-wide; teams and submissions still name their
selected project. Provider configuration appears for project
work, where it can affect dispatch. Filters within a page remain visible and own
their own narrower scope.

## Destination and task boundaries

Every root has one home. Configuration sits beside the work it changes rather
than in an unrelated footer. Stream studio is the initial destination. Idea board
requires a selected project. Agent workflow, its settings task and Council can
explain their prerequisites before a project exists.

Subpages keep focused tasks together without expanding the global navigation:

- Stream studio: Broadcast, Setup, Scenes, Music, Public displays and History.
- Stream chat: Chat, Twitch settings and Bot messages.
- Agent workflow: Workflow runs, Herdr workspaces and Workflow settings.
- Economy: Command prices, Earning, Rewards, Loot boxes and Fulfillment.
- The Council opens on Ask the Council: a question intake and retained task
  history. Advanced Council tools contains Definitions, Submit existing note,
  Watched inboxes, Task scheduler, Event triggers, Run monitor, Council workflows, Team messages and Definition
  folders.
- Request details: Overview, Plan, Increment and Activity.

Workflow settings configures the same project process that Agent workflow monitors,
so it lives in that workspace's local navigation. One shared heading and project
context surround the focused editor. Configuration remains a distinct task from
execution, and its dirty-draft guard applies when moving between local tasks.

Economy owns currency earning, subscriber totals, all command fees and benefits,
and the reward catalog. Community settings keeps naming, XP, reputation and ranks;
its earning section links to Economy instead of presenting a second currency rate.
Configuration Save changes future rules. Manual fulfillment records captured awards
with its own revision and private note, without granting another reward.

Task panels and dialogs belong to their documented parent. Changing navigation
does not save a draft, start an agent, update Twitch, start OBS, publish a board or
replay an uncertain effect. Existing dirty-configuration guards and explicit
confirmation/recovery stay authoritative. Local subpages retain their mounted
models where leaving them would otherwise discard a draft.

Council questions are canonical private analytical notes with an explicit project,
team and council. Saving and preflight do not admit or execute work. The first-page
history spans retained direct and watched submissions across projects, plus saved
task notes; it distinguishes latest inbox observations and missing retained history
instead of fabricating a complete ingestion ledger.

## Public and native entry points

The four public capture tabs and viewer website are independent, read-only
destinations. They receive the public projection, never the private studio frame
or its capabilities. Native Obsidian settings own integration credentials and
vault-level setup; project and workflow definitions stay in the studio.
The native Local MCP server panel grants an explicitly activated owner client access
to vault projects, including private projects; it is separate from public viewer
projections. Timed and recurring prompts remain an advanced Council task and share
the existing execution kernel, desktop ownership and paused/recovery boundaries.

## Implementation and coverage

[`studio-destinations.ts`](../../src/plugin/presentation/stores/studio-destinations.ts)
owns root labels, icons, groups, ordering, scope and project prerequisites. Sidebar
and top bar derive their state from this contract. `StudioView` remains the stable
route union, so adding a locator requires an exhaustive destination entry. The
project switcher replaces an additional Projects row; each visible global
destination appears exactly once in the grouped sidebar. The compatibility
`workflow-settings` locator declares Agent workflow as its parent and has no
separate sidebar row. Agent workflow stays current while its settings task is open.

One canonical view may cover multiple internal locators. Workflow settings maps
both the retained studio alias and the local workflow `settings` page to its one
document; the alias preserves existing dirty-configuration guards rather than
adding another product destination.

The [generated sitemap](sitemap.md) inventories all root pages, local subpages,
focused panels, dialogs, native settings and public surfaces from their canonical
view documents. It is a coverage map, not a browser routing table. Run
`npm run docs:views` and `npm run check:views` after changing those documents.

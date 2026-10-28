# Information architecture

CoForge supports one operating loop: prepare the stream, collect community ideas,
develop reviewed increments, then understand the results. Navigation follows those
tasks. The selected project scopes development work; it does not scope the shared
channel, audience, ledger or recorded broadcasts.

## Task families

| Family | Destinations, in working order | Data scope |
| --- | --- | --- |
| Stream | [Stream studio](views/broadcast.md), [Schedule](views/schedule.md), [Stream chat](views/stream.md) | Shared channel; scheduling can attribute a stream to a project. |
| Build | [Idea board](views/board.md), [Agent workflow](views/workflow.md), [Workflow settings](views/workflow-settings.md), [The Council](views/council.md), [Project settings](views/settings.md) | Selected project; reusable Council agents and definition folders belong to the vault. |
| Community | [Community](views/community.md), [Viewers](views/population.md), [Community settings](views/community-settings.md) | Shared channel recognition, observed viewers and participation rules. |
| Insights | [Statistics](views/statistics.md), [AI costs](views/ai-costs.md), [Finances](views/finance.md), [Operations](views/operations.md) | Recorded channel evidence; AI costs spans vault projects and has its own project filter. |

[Projects](views/projects.md) is the project switcher's destination. The switcher
remains visible while working with shared channel tools. It identifies the project
used when the streamer returns to Build; it never implies that shared data is
filtered. [Studio guide](views/help.md) remains a persistent help action.

The top bar names the current data scope: the selected project and stable project
ID for project work, Channel workspace for shared channel tools, and Vault
workspace for Projects, The Council and AI costs. Council's reusable agents and
cross-project run filters are vault-wide; teams and submissions still name their
selected project. Provider configuration appears for project
work, where it can affect dispatch. Filters within a page remain visible and own
their own narrower scope.

## Destination and task boundaries

Every root has one home. Configuration sits beside the work it changes rather
than in an unrelated footer. Stream studio is the initial destination. Idea board
and Agent workflow require a selected project; configuration and Council surfaces
can explain their prerequisites before a project exists.

Subpages keep focused tasks together without expanding the global navigation:

- Stream studio: Broadcast, Setup, Scenes, Music, Public displays and History.
- Stream chat: Chat, Twitch settings and Bot messages.
- Agent workflow: Workflow runs and Herdr workspaces.
- The Council: Definitions, Submit and preflight, Watched inboxes, Run monitor,
  Council workflows, Team messages and Definition folders.
- Request details: Overview, Plan, Increment and Activity.

Task panels and dialogs belong to their documented parent. Changing navigation
does not save a draft, start an agent, update Twitch, start OBS, publish a board or
replay an uncertain effect. Existing dirty-configuration guards and explicit
confirmation/recovery stay authoritative. Local subpages retain their mounted
models where leaving them would otherwise discard a draft.

## Public and native entry points

The four public capture tabs and viewer website are independent, read-only
destinations. They receive the public projection, never the private studio frame
or its capabilities. Native Obsidian settings own integration credentials and
vault-level setup; project and workflow definitions stay in the studio.

## Implementation and coverage

[`studio-destinations.ts`](../../src/plugin/presentation/stores/studio-destinations.ts)
owns root labels, icons, groups, ordering, scope and project prerequisites. Sidebar
and top bar derive their state from this contract. `StudioView` remains the stable
route union, so adding a route requires an exhaustive destination entry. The
project switcher replaces an additional Projects row; each other root appears
exactly once in the grouped sidebar.

The [generated sitemap](sitemap.md) inventories all root pages, local subpages,
focused panels, dialogs, native settings and public surfaces from their canonical
view documents. It is a coverage map, not a browser routing table. Run
`npm run docs:views` and `npm run check:views` after changing those documents.

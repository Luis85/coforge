# Streaming workspace

The studio is private. Use the four **CoForge Stream** ribbon icons or the
**Public stream displays** section in Stream studio to open public tabs:

| Display | Stable window title |
| --- | --- |
| Kanban | CoForge Stream - Kanban |
| Chat | CoForge Stream - Chat |
| Leaderboards | CoForge Stream - Leaderboards |
| Community | CoForge Stream - Community |

Each explicit ribbon/Open action opens a fresh tab in the main workspace, preserving
existing tabs. The four monitor-framed icons identify the board, chat, rankings and
community guide. Tabs remain read-only and contain only the public projection.

For OBS capture, detach a public tab into its own window using Obsidian's tab menu.
Additional detached windows of the same kind keep numbered titles such as
`CoForge Stream - Kanban (2)`, so OBS can distinguish them. Their window slots
survive project retargeting and workspace restoration. Use the exact title of the
intended window and choose **Window title must match** as OBS's match priority.
Avoid capturing your whole desktop, main workspace or private studio.

The Kanban display stays on its chosen project when you change projects privately.
Use **Show selected project on stream Kanban** to change the main public tab's
project explicitly; detached captures stay pinned. Detached capture windows show a
curtain when another pane or host dialog appears, and close on plugin unload/reload.
Reopen a public tab and detach it again after a reload. Platform-specific OBS
matching still needs an off-air check on the streamer's machine.

Public chat contains actual messages received through the current Twitch connection,
including public chatbot echoes. Local tests and private command results never appear.
Deletion, user-message clearing and full-chat clearing remove retained public chat;
bounded removal records also reject late delivery of already removed messages.
Connection loss blanks the display until chat is ready again.

## Requests and Markdown

`!help` explains joining and the request workflow. `!help requests`, `!help progress`
and `!help community` provide short topic replies. Registered viewers can send
`!context CF-123 <details>` for an open request, including one in another project.
It appends the contributor's context and returns the request to screening. Existing
screening, scoring and plans must be regenerated; results from the older revision
are rejected. An already running task can finish in its isolated worktree; inspect
that attempt before reusing any partial changes. Closed requests need a new request
or bug. Identical repeated context is ignored.

Requests, context, plans, rationale, summaries and verification notes render Markdown.
HTML remains literal; embeds and images do not load; only ordinary HTTP(S) links
can be opened privately. Public cards have no privileged links or editing actions.
Logs, diffs and prompt editors remain source text. Card actions are available by
right-click or the **Actions** button; review-sensitive actions open the review UI.

## Project prompts and workflows

Open **Workflow settings** in the Build navigation group to edit the selected
project's ordered process. Add, duplicate, remove or reorder AI, approval and
checklist steps, including replacements for the original Screen/Score/Plan/Build.
Each AI step has explicit instructions, provider/model, result contract and access.
Import/export JSON works on a previewed draft and never starts a model. See
[Project workflows](WORKFLOWS.md) for execution, manual checkpoints and the JSON format.

The general project prompt stays in **Project settings** and prefixes dispatch.
Workflow definitions are owned `workflow-definition` frontmatter in the project
Markdown note; progress and artifacts live in request notes. Legacy flat prompt/
agent settings still resolve to equivalent standard steps until explicit configuration.
Opening a view does not rewrite them. Saving a revision changes future runs;
existing runs keep their captured instructions, inputs, limits and AI choices.
The supported runners are Claude Code, Simulation and the managed Herdr profile.
Simulation calls no model. Each real attempt retains its model and step identity
for execution, history and AI-cost attribution across project switches.

Herdr steps launch a dedicated agent in the configured local Herdr session; select
the **Claude Code** managed profile and a model for each step. Other agent kinds
remain available in manual Herdr controls, but have no verified workflow profile yet.
Connect and refresh Herdr in **Agent workflow** first. Each task uses a private,
correlated JSON result file; delivery, terminal text and idle status alone never
advance a request. No-project-access steps can only write their result; read-only
steps inspect the project/run workspace and write their private result; editing
steps share a separate Git worktree for final streamer review.
The managed agent cannot execute test commands, so captured increments clearly
report tests as not run. CoForge never accepts model-written usage or test claims.

Herdr's interactive agent does not enforce the direct Claude runner's USD/turn caps.
Manage spending in the external agent. Cancelling or timing out stops CoForge's wait;
the external agent may still be running. Recovery records preserve the original
session, workspace and attempt. Inspect that session, then explicitly acknowledge
the record in **Agent workflow** before another mutation. Reload never resends a task
or automatically resumes an incomplete attempt.

Project paths/general context stay protected during unfinished runs. Future workflow
definitions remain editable. External configuration changes preserve unsaved drafts
and block a stale save until you review the current values using **Discard changes**.

## Costs and finances

**AI costs** groups every retained workflow attempt and Herdr dispatch by feature,
with provider/model, status, time and cost source. Failed and retried tasks count.
Provider usage is captured before interpreting the structured result, so a reported
cost can remain on a failed task. Missing cost is **Unavailable**, never zero;
known totals are partial when coverage is incomplete. Simulations contribute no
real usage cost. Herdr delivery is not completion and currently has no reliable
automatic cost: add a manual USD amount for the individual dispatch when available.
A later provider report takes precedence without deleting its manual annotation.

The same view shows provider-reported input/output tokens per attempt and known
totals, with coverage for missing reports. Raw input excludes cache reads and cache
creation, which are displayed separately. Inclusive input is available only when
all three input counters are reported. Missing counters stay unavailable; zero is
shown only when reported. Failed tasks retain reported usage. Herdr currently has
no trustworthy token API, so its tasks contribute no inferred token totals.

The private USD usage ledger is `CoForge/AI-Costs/Ledger.md`. It retains task records
beyond the operational job list. Older history can only be backfilled from retained
jobs/dispatches; previously discarded or unreported provider costs cannot be recovered.
Usage costs are separate from actual EUR payments in **Finances**. There is no
automatic exchange rate, subscription-cost allocation or inferred cash expense.

## Plan a stream

Use **Schedule → New stream plan**. Set a start in the displayed local time zone,
project, Twitch metadata, live/BRB scene choices and a saved playlist. Dates are
stored as instants with their planning time zone. A nonexistent daylight-saving
time is rejected; a repeated local hour selects the earlier occurrence.

Each plan is a Markdown note in `CoForge/Schedule`. **Open Markdown note** opens
its topics, script and storyboard. Edit there and refresh the schedule to see changes.
Configuration saves preserve the note body and unrelated frontmatter. External
edits reject a stale save rather than overwriting the script. Mark plans completed
or cancelled to keep the historical note.

Review the saved preparation, then apply each step explicitly. Twitch metadata
updates the channel immediately. Scene assignments require connected, offline OBS.
Selecting music prepares a saved playlist without starting or interrupting audio;
use **Play prepared playlist** in Stream studio when ready. A failed step leaves
other applied steps in place. Planning never publishes a Twitch schedule or starts
a stream. Finish Stream studio's readiness checks and press Go live yourself.

## Private viewer notes and workspace controls

**Viewers** includes registered players and other observed Twitch chatters. CoForge
creates private notes in `CoForge/Viewers`, coalescing updates and showing sync counts.
Opening a profile's note syncs it immediately. Managed stats update while unrelated
frontmatter and human CRM annotations remain intact. Refresh re-indexes renamed
notes and reports invalid/duplicate identities. Anonymous video viewers cannot be
identified; tracked chat presence is not proof of video watch time. Unregistered
profiles earn no game rewards until registration.

Navigation and chat have independent collapse/reopen buttons; chat drafts survive
collapse and navigation. Narrow layouts show either the board or expanded chat.
The connection/workflow indicator now lives in Obsidian's native status bar.
It is compact read-only text. Chat controls and sticky project saves reserve only
the actual overlapping host-bar space. In short board panes, chat context/history
scrolls independently while connection and message controls remain reachable.

Private CoForge folders and plugin state are ignored by Git, with only
`CoForge/Public` allowed for publishing. Protection is also installed in new vaults.
Ignore rules do not remove already tracked data or erase repository history. Review
your Git index before publishing an existing vault. This increment removes the
previously tracked project note from the index while leaving the local note intact.

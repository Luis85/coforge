# Streaming workspace

The studio is private. Use the four **CoForge Stream** ribbon icons or the
**Public stream displays** section in Stream studio for capture windows:

| Display | Stable window title |
| --- | --- |
| Kanban | CoForge Stream - Kanban |
| Chat | CoForge Stream - Chat |
| Leaderboards | CoForge Stream - Leaderboards |
| Community | CoForge Stream - Community |

In OBS, capture the dedicated window and choose **Window title must match** as
the window match priority. Avoid capturing your whole desktop or private studio.
The Kanban window stays on its selected project when you change projects privately.
Use **Show selected project on stream Kanban** to change the public project explicitly.
Capture windows show a curtain when another pane or host dialog appears, and close
on plugin unload/reload. Reopen them with the same icons after a reload. Keep
Obsidian's other windows outside the captured source. Platform-specific OBS capture
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

## Project prompts

Open a project's **Studio settings → Stage prompts**, or **Edit prompt** in its
workflow. Select Screen, Score, Plan or Build. Each starts with a default and can
be overridden independently for that project. Blank/reset restores the default.
Preview shows the normalized system instructions and an existing request's payload
without invoking an agent. Save settings before dispatching. Finish/cancel that
project's queued/running tasks before changing its prompts.

The general project prompt prefixes the request payload. Stage instructions define
the task; CoForge still supplies execution restrictions, output schemas and mandatory
streamer review. Overrides live in `agent-prompt-screen`, `agent-prompt-score`,
`agent-prompt-plan` and `agent-prompt-implement` in the project Markdown note.

## Costs and finances

**AI costs** groups every retained workflow attempt and Herdr dispatch by feature,
with provider/model, status, time and cost source. Failed and retried tasks count.
Provider usage is captured before interpreting the structured result, so a reported
cost can remain on a failed task. Missing cost is **Unavailable**, never zero;
known totals are partial when coverage is incomplete. Simulations contribute no
real usage cost. Herdr delivery is not completion and currently has no reliable
automatic cost: add a manual USD amount for the individual dispatch when available.
A later provider report takes precedence without deleting its manual annotation.

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

Private CoForge folders and plugin state are ignored by Git, with only
`CoForge/Public` allowed for publishing. Protection is also installed in new vaults.
Ignore rules do not remove already tracked data or erase repository history. Review
your Git index before publishing an existing vault. This increment removes the
previously tracked project note from the index while leaving the local note intact.

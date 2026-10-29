---
pbl-id: 5
type: Feature
parent: "[[docs/requirements/Integrations]]"
order: 3000
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

## First milestone acceptance

Connect the streamer's channel from the plugin using Twitch device authorization. Store access/refresh
tokens only in Obsidian secret storage. Validate account identity and permissions, refresh rotating
credentials, expose actual connection state and recover from transport interruption without duplicate intake.

Allow the streamer to update the channel title/category, delete one selected message, time out a viewer,
or ban a viewer. Moderation requires an explicit target and a review/confirmation step.

Implementation and evidence: [[docs/project-tasks/2026-10-27-twitch-milestone-review]]. Live-account
acceptance remains pending; future OBS/shop/community roadmap items are outside this milestone.

## Twitch operations increment (owner approved 2026-10-29)

Stream navigation includes Twitch operations: Activity, Moderation, Engagement, Breaks
& raids, Audience, Content, Schedule, and Data & access. Read capabilities and write
permissions are authorized separately. Every external action requires a captured
channel/account/parameter preview and explicit confirmation.

Supported Helix endpoints and EventSub events cover moderation, ads, raids, Channel
Points, polls/predictions, audience/roles, goals/charity, clips/markers and schedules.
Preserve eligibility, creating-app reward restrictions, source freshness, continuation
cursors and missing-event gaps. Do not claim Creator Dashboard analytics parity,
exact video watch time, payouts or viewer Channel Points balances.

Plans remain local until explicitly published. Templates prepare drafts only. Linking
activity to a screened request does not dispatch an agent or change workflow status.
Implementation and qualification evidence: [[docs/project-tasks/2026-10-29-twitch-command-centre]].
OBS production belongs to the coordinated OBS increment. Live-account acceptance remains
separate from protocol tests and contained-host UI evidence.

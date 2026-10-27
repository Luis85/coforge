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

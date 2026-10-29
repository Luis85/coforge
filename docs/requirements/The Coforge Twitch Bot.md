---
pbl-id: 2
type: Epic
order: 812.5
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

The chatbot is the primary viewer interface. `!projects` lists readable project IDs; `!request <project-id>
<description>` and `!bug <project-id> <description>` create requests with an explicit project parent.
`!vote`, `!status`, `!me` and `!help` return useful command results.

When automatic replies are enabled, save the command outcome and queued reply together. Deduplicate
Twitch events. Confirm delivery using Twitch's response, back off on rate limiting, and hold ambiguous
sends for inspection rather than silently replaying them. Bot replies are opt-in and own-account messages
are ignored to prevent loops. A separate chatbot account is supported.

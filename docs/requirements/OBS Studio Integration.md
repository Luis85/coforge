---
pbl-id: 6
type: Feature
parent: "[[docs/requirements/Integrations]]"
order: 4000
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

## Confirmed streamer workflow

Open CoForge, prepare the stream, connect an already running OBS Studio through WebSocket v5,
and explicitly press Go live to start broadcasting. Pause switches to a chosen BRB scene while
staying live; Resume restores the previous scene. Stop ends the broadcast.

Each interaction publishes a persisted event and confirms the observed OBS outcome. Unknown effects
remain held until refreshed; reconnecting or reloading never replays stream commands.
See [[docs/coforge/STREAM-STUDIO]] for setup, boundaries and maintenance seams.

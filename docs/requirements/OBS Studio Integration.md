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

Owner expansion (2026-10-29): implement full setup and live production for one PC
starting with a fresh blank OBS installation. Deliver all three increments:
guided studio creation and live operation; supported source/layout/audio authoring
and public displays; durable show plans, manual cues and opted-in event automation.
See [[docs/project-tasks/2026-10-29-obs-studio-overhaul]] for acceptance and evidence.
The earlier workflow below remains the broadcast safety baseline.

Open CoForge, prepare the stream, connect an already running OBS Studio through WebSocket v5,
and explicitly press Go live to start broadcasting. Pause switches to a chosen BRB scene while
staying live; Resume restores the previous scene. Stop ends the broadcast.

Each interaction publishes a persisted event and confirms the observed OBS outcome. Unknown effects
remain held until refreshed; reconnecting or reloading never replays stream commands.
See [[docs/coforge/STREAM-STUDIO]] for setup, boundaries and maintenance seams.

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

Owner revision (2026-10-30): focus the integration on starting, pausing/resuming
and stopping the stream, switching scenes, and creating/editing scenes. OBS screen
previews and audio tuning stay in OBS, alongside capture devices, source properties
and output configuration. This supersedes the 2026-10-29 full-setup/live-production
expansion; its three-increment plan and evidence are historical in
[[docs/project-tasks/2026-10-29-obs-studio-overhaul]].

Show plans remain in scope (owner confirmation, 2026-10-30), with equal attention
to planning and running the show. Improve segment review and cue operation while
preserving explicit saves, private presenter notes, captured execution definitions
and durable per-step recovery without replay. See
[[docs/project-tasks/2026-10-30-show-plan-polish]].

Owner follow-through (2026-10-30): remove obsolete preview/audio/source-property
and full-studio/output setup UI. Connection/readiness, stream controls, scene
management, Show plans, public displays and history remain. Removed panels do not
continue screenshot/meter polling. Existing saved cue definitions and recovery
remain compatible. Qualify and merge the pull request only after required checks
are green; see [[docs/project-tasks/2026-10-30-obs-studio-focus]].

Scene management includes create, rename, duplicate, delete and switch, plus
existing sources' scene-item visibility, order and membership. Scene copies share
existing sources. Mutations retain shared serialization, durable intent and
explicit recovery; destructive actions confirm the exact target.

Open CoForge, prepare the stream, connect an already running OBS Studio through WebSocket v5,
and explicitly press Go live to start broadcasting. Pause switches to a chosen BRB scene while
staying live; Resume restores the previous scene. Stop ends the broadcast.

Each interaction publishes a persisted event and confirms the observed OBS outcome. Unknown effects
remain held until refreshed; reconnecting or reloading never replays stream commands.
See [[docs/coforge/STREAM-STUDIO]] for setup, boundaries and maintenance seams.

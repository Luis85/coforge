# Task: Twitch-first studio and chatbot milestone

- Status: in progress
- Journey: a Twitch viewer submits a project-addressed feature or bug; CoForge saves it and the bot replies in channel.
- Owner sources: PRODUCT.md, the product backlog Base, domain Canvas, milestone/release and requirement notes copied byte-for-byte from the main checkout.

The original note metadata and IDs are preserved. Confirmed Twitch milestone acceptance is appended to
the Twitch Integration, Twitch Bot and first-request milestone notes. The Hood registration/economy,
shop, OBS, housing and progression remain roadmap scope.

## Scope

Reliable EventSub lifecycle, public-client OAuth device authorization and refresh, role-specific permissions,
durable bot replies, `!bug`, channel metadata and explicit moderation. Improve project-ID readability,
remove fictional channel identity and redundant copy, and correct the wide/filtered Kanban gap.

## Acceptance

- Streamer and chatbot authorization store credentials only in Obsidian secret storage; rotating refresh tokens are serialized.
- A persisted command and its bot reply are queued together. Duplicated events never create duplicate requests or replies.
- Unknown delivery outcomes are shown honestly and are never automatically resent after restart.
- Feature and bug commands require a known project parent; request kind survives Markdown round trips.
- Channel controls require broadcaster authorization. Moderation targets are explicit and confirmed in the UI.
- Reconnection, malformed frames, revocation, rate limits and unload have behavioral tests.
- IDs are readable and copyable; no invented channel/viewer data is shown as live information.
- Existing board, canonical-note, host lifecycle and UI checks remain intact.

## Review findings before changes

1. P1: `twitch.ts` receives only; it has no bot send path or channel management. The UI explicitly promises never to post.
2. P1: no refresh-token flow; expiry requires manual replacement. Transport has parser coverage but no lifecycle tests.
3. P1: no durable outbound acknowledgement or delivery outcome. A saved request is not acknowledged in Twitch.
4. P2: chat channel name is synthesized from the selected game, not read from Twitch; connection source doubles as liveness.
5. P2: project IDs are in 10px badges/secondary text and disappear in compact navigation.
6. P2: recurring promotional text competes with project, connection and command information.
7. P2: filtered Kanban tracks have fixed maximum widths and can leave large unused space before the side panel.

## Current-run visual evidence

1. `reports/twitch-review/before/01-board.png`: board and shared chat; source-backed synthetic preview, not a live account.
2. `reports/twitch-review/before/02-projects.png`: project-ID presentation and management actions.
3. `reports/twitch-review/before/03-settings.png`: manual receive-only token setup.
4. `reports/twitch-review/before/04-wide-board.png`: wide board measured at 1920px; default padding/gutter totals 47px.

The in-app browser failed to initialize. Captures use the repository's explicitly authorized headless harness.
Screenshots establish visible problems, not full accessibility or live Twitch behavior.

## Review result

The seven findings above are addressed in this iteration. Source-backed views now distinguish offline
history, explicit local testing, actual channel identity and confirmed outbound messages. Fresh installs
create no synthetic project. Project IDs remain visible, selectable and copyable. Feature and bug
requests share a project backlog with a request-type filter.

The first Twitch milestone now has device authorization, refresh, account/scope validation, guarded
EventSub recovery, persisted command replies and permission-gated title/category/moderation controls.
Chat moderation uses stable message/user/channel IDs and requires operator confirmation. No live
Twitch operations were performed during this review.

## After-change walkthrough and evidence

1. Open the backlog at 1920px. All four tracks expand to the available width:
   `reports/twitch-review/after/01-wide-board.png`.
2. Select Needs review. Track widths remain aligned with the right panel:
   `reports/twitch-review/after/02-filtered-board.png`. Both gaps measure **31px**, down from 47px;
   fixed maximum filtered widths that could leave much larger gaps were removed.
3. Open Projects. Read the 14px project ID: `reports/twitch-review/after/03-projects.png`.
4. Open Stream chat. Offline status and permission-gated controls are explicit:
   `reports/twitch-review/after/04-channel-desktop.png`.
5. Repeat at 360px. Controls reflow without page overflow:
   `reports/twitch-review/after/05-channel-narrow.png`.
6. Select Test commands locally and submit a project-addressed bug. The draft clears only on success
   and the backlog shows its Bug classification. This path is exercised by the browser journey.

The 40-capture UI gallery covers workspace/preferences, light/dark, desktop/narrow and surface states.
Reviewed representative desktop, narrow and settings captures. Impeccable's static detector returned
`[]`; visual review confirmed the incumbent theme and clearer hierarchy. Additional checks caught and
fixed inaccessible scrolling in the full chat log and closed disclosure layout measurement.

## Verification

Local results: `npm run verify:project` completed all five check steps with zero failures, then built
the plugin; `npm run test:e2e` passed all 16 browser checks (including the eight UI-quality checks).
`npm run test:ui-quality` separately passed 8/8; `npm run ui:gallery` captured 40 screenshots.
`git diff --check` and the runtime/test file-size review found no violations. `build:local -- --no-build`
installed the three assets under this checkout's root `.obsidian/plugins/coforge`.

The local Obsidian command stopped before launch because obsidian-launcher/host are not provisioned;
nothing was downloaded. Contained-host validation is delegated to the existing CI workflow.
See the PR for final command output and contained-host CI evidence. Live-account acceptance remains
pending: device approval, real account permissions, chat replies and moderation on a streamer-owned test
channel. No requirement/vi IDs are invented: `design/traceability.json` declares no requirements;
this task and owner notes record the additional product acceptance scope.

## Safety and limits

Do not modify the main checkout or copy its live CoForge project notes/public exports into source control.
No live Twitch posts, moderation, credentials or game files are used by agent verification.
Live-account acceptance remains an explicit user-operated check after automated and contained-host validation.

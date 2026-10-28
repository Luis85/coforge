# Stream, analytics and public surface redesign review

- Status: complete for the assigned design pass; parent task owns full qualification and merge.
- Journey: stream preparation, live operation, community intake, stream analysis and public sharing in BRIEF.md.
- Traceability: existing view contracts; generated requirement/interaction registries have no pending obligations.

## Coverage

These 30 canonical view IDs were reviewed as one system. Descendants retain their existing task ownership and data boundaries.

| Canonical view IDs | Design and product pass | Evidence |
| --- | --- | --- |
| `broadcast`, `broadcast-live` | Strong observed-state console; distinct live/unconfirmed styles; useful disconnected and preparation guidance; audience, chat and health remain source-attributed. | Broadcast unit test; broadcast/chat subpage journey; light/dark captures. |
| `broadcast-setup`, `guided-setup` | Separate readiness and configuration; Ready/Needed/Optional text reinforced with theme color; current guided step has a distinct surface. | Broadcast unit test; Setup keyboard/draft preservation journey; setup captures. |
| `broadcast-scenes` | Scene selection/program switch lead; separate authoring forms and source rows. Existing destructive confirmation and uncertainty controls remain explicit. | Scenes subpage capture; existing scene domain/adapter tests remain required in the full suite. |
| `broadcast-music` | Track/playlist/state console precedes transport and library; seek and volume retain accessible labels. | Music subpage capture; existing music journey remains required in the full suite. |
| `broadcast-displays` | Four named display launch/preview choices with clear separation of private controls from public preview. | Public-display journeys for all four projections, Axe and reflow. |
| `broadcast-history` | Recording selection, retained observations, export and route to statistics remain focused. | History subpage capture; broadcast unit test. |
| `stream`, `stream-channel`, `twitch-moderation` | Conversation remains primary; moderation/reference are grouped beside it. Command reference explains registration without hard-coded community branding. | Chat subpage keyboard/draft journey and captures; existing moderation guards remain required in the full suite. |
| `stream-connection`, `twitch-channel` | Current channel/connection status leads; authorization, receive-chat and auto-post decisions remain separate. | Twitch settings subpage capture and Axe; existing Twitch domain/service tests remain required in the full suite. |
| `stream-messages` | Authoring is separated from retained messages; labels show posting state, interval and last confirmed send. Corrected prerequisite location to Twitch settings. | Bot messages light/dark/narrow captures; existing messages tests remain required in the full suite. |
| `schedule` | Named plan selector; aligned fields and separate Twitch/OBS/music sections. Copy explains when external effects occur. | Baseline schedule wide/narrow captures; full operating-frame rerun required. |
| `finance`, `finance-entry` | Actual income/expense/balance grouped separately from channel-wide recurring estimates. Editor and ledger occupy distinct workspace columns. | Finance totals unit test; baseline wide/narrow captures; full operating-frame rerun required. |
| `ai-costs` | Coverage summary leads; partial known total explains missing/pending amounts and routes attention to retained attempts/manual fallback. Feature and task detail have named headings. | Baseline AI-cost captures; existing exact-cost/provenance tests remain required in the full suite. |
| `statistics` | Selected-recording mean/peak audience, observed messages and missing minutes; selected-metric availability before comparison plot. Missing values are explicitly unavailable. | Red/green summary/coverage regression; light/dark chart comparison, keyboard inspection, exact sample and missing-metric journey; captures reviewed. |
| `native-settings`, `native-vault`, `native-claude`, `native-twitch`, `native-twitch-authorization`, `native-website` | Explicit vault/project/workflow ownership guide; preserve native setting rows, explicit save/discard, secret references and external integration setup. Shared settings visual pass is owned by the parent agent. | Existing native-settings unit suite and final gallery/host run required; no native host evidence claimed here. |
| `public-kanban`, `public-chat`, `public-leaderboards`, `public-community` | Stronger capture title/summary hierarchy; stage text and color; first-ranked contributor emphasis; registration/help remains visible. No private controls or data added. | All four public journeys, both themes and 360/1280 widths, Axe, read-only and privacy assertions. |
| `public-website` | Readable standalone palette, request/leaderboard/badge anchors, explicit freshness and refresh. Mandatory timed reload removed after accessibility failure; keyboard focus and expanded plans persist while reading. | New standalone export E2E; public whitelist/escaping unit suite; final results below. |

## Review and polishing findings

- Product: separated actual EUR payments from estimated recurring commitments; USD AI usage remains independent. Summaries use existing canonical services and retained observations.
- UX: distinguished live operation from setup; named feature breakdown and plan selection; corrected prerequisite location and removed promises of optional preview capabilities.
- Accessibility: light/dark/narrow-leaf browser checks include Axe, native keyboard navigation and visible focus. The new website check caught insufficient light-theme semantic-color contrast and the forced 120-second refresh; both were corrected without suppressing rules.
- Privacy/security: public sources remain whitelist projections, code/HTML stays escaped or safely rendered, CSP stays restrictive, and the website remains script-free. No credentials, private notes or configuration enter public output.
- Reliability: navigation never starts playback, broadcasting or model work. Existing explicit preparation, final-review, mutation-intent and unknown-outcome controls remain authoritative.
- Maintenance: changes stay in product templates/styles and canonical view docs. Reused composables, services and per-leaf stores; added no new state owner or framework dependency.

## Commands and real results

- Initial `npm test -- src/plugin/tests/project/coforge/statistics-ui.test.ts`: **1 failed**, missing Selected recording overview (expected red).
- Targeted statistics, broadcast, finance and public-surface unit run: **4 files passed; 6 tests passed**, 12.77 seconds. Includes missing-viewer summary/coverage regression.
- Focused broadcast/chat subpages, statistics and public capture E2E: **7 passed**, 2.5 minutes. Both themes and narrow/wide captures reviewed.
- Initial standalone website E2E: **1 failed**, actual color contrast and timed-refresh violations (not suppressed).
- Final standalone website/public-capture E2E: **6 passed**, 2.6 minutes. Both website themes pass Axe, narrow/wide reflow, section navigation, keyboard disclosure and no-script/no-private-data checks. All four final public projections pass their original boundaries and were visually reviewed.

## Evidence paths

- `reports/stabilization/operating-views/`: initial private operating views, 1280px and 480px leaves.
- `reports/stabilization-subpages/`: every stream/broadcast task page in light/dark and 1280/360 widths.
- `reports/stream-statistics/`: populated comparison/inspector state, both themes and widths.
- `reports/product-audit/public-*.png`: public capture and standalone website review captures.

## Untested scope

These browser examples use synthetic data and do not establish live Twitch/OBS/CLI integration, actual audio output or native screen-reader behavior. The parent task owns full verification, gallery and contained Obsidian qualification. Native settings remain subject to that evidence; no downloaded host or personal vault was used by this review.

## Explicit temporary-example cleanup follow-up

The requested cleanup increment adds **Exit example** to finance, AI costs, schedule, statistics, Council, live monitoring/OBS scenes, music and Herdr. Each exit unsubscribes from its temporary source, discards sample drafts and recreates only its browser preview service. Native services remain authoritative. Live scene drafts are restored after leaving the example. Council retains example mode and drafts through ordinary navigation, then clears synthetic catalogue/run/editor buffers only on explicit exit.

`closeTemporaryExamples()` is a per-studio-pane revision signal used after successful sample cleanup. Active examples close immediately; inactive modes reset before rendering when remounted. Public-display previews also listen to this signal. Ordinary navigation never sends the cleanup signal. The browser harness supplies current-note receipts for the same reviewed cleanup protocol used by native storage; it writes no disk files.

- Preview-reset and real-ledger protection tests: **2 files / 3 tests passed**, 10.50 seconds. Tests cover active and inactive cleanup, ordinary-navigation preservation, restoration of manually authored scene drafts, and protection of a real ledger/unsaved finance draft without writes.
- Existing statistics/live/Council plus reset test run: **4 files / 5 tests passed**, 12.07 seconds.
- `npm run typecheck`: exit **0** after the complete preview follow-up.
- `npm run check:source`: code-line limits and locale parity passed, **2899 inputs / 226 translated keys** at the first preview qualification; final parent gate covers the final additions.
- New `temporary-examples.spec.ts`: eight browser cases prepared for the parent’s final stable-source run, including saved sample ledger disposal and draft preservation. Its result is pending here.

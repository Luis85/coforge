# Alerts increment: researched review, improvements and closeout

- Status: in progress
- Owner goal: deliver the next Alerts increment, review every product perspective,
  implement the missing pieces with subagents, open a PR and merge only after green checks.
- Scope: the new OBS Alerts journey and its shared integration seams. Existing
  workflow permissions, screening, project privacy and source identities remain authoritative.
- Requirements: owner Alerts request and trigger confirmation in BRIEF.md.
  Imported traceability contains no req-* or vi-* entries; acceptance IDs ALERTS-01–06
  and the dedicated module, storage, transport, player, UI and native specifications apply.

## Research and design implications

1. [OBS Browser Source](https://obsproject.com/kb/browser-source) exposes URL,
   dimensions, source shutdown and refresh controls. Setup must explain those
   controls and their consequences for ephemeral delivery, rather than just give a URL.
2. [OBS browser audio lifecycle](https://github.com/obsproject/obs-studio/issues/7878)
   explains OBS-controlled audio and monitoring. Guidance must distinguish stream
   output from local monitoring; connection alone cannot prove on-air playback.
3. [EventSource specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
   defines automatic reconnection and event IDs. Use live events without retained IDs/history;
   clear playback on loss and accept future cues after reconnect. Bound streams and waiting cues.
4. [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   calls for programmatically announced results without moving focus. Source state,
   dispatch results and failures need meaningful live regions, honest language and recovery.
5. [WCAG labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
   supports concise labels and associated help. Describe optional variables and media
   limits before failure, with unique field/help IDs across multiple Obsidian leaves.

## Review findings across product perspectives

| Perspective | Finding / decision | Increment and acceptance |
| --- | --- | --- |
| Streamer goal / frequency | Manual dispatch is buried after full configuration. | P1: Saved alerts expose variables and Fire first; editing and initial setup are secondary expandable tasks. |
| Delivery honesty / trust | Fire can claim dispatch with no source attached. | P2: Show connected sources; refuse zero-source dispatch with exact OBS recovery. Report sent source count, never infer playback/on-air visibility. |
| Reliability / media | A file removed after save fails only when the player fetches it. | P2: Recheck selected media existence/size before manual or automatic dispatch; failed preflight produces no partial cue. |
| Correctness / events | Some variable/event combinations can never resolve. | P2/P3: Domain metadata identifies supported variables; reject guaranteed-impossible enabled bindings before persistence; describe conditional public fields. |
| On-air continuity | Saving unrelated configuration clears current playback. | P2: Preserve unrelated playback during ordinary saves; revoke queued playback when access is removed, Stop is pressed, privacy is revoked or runtime unloads. |
| Accessibility | Help text inflates labels; create/delete focus can be lost. | P3: Associate help through aria-describedby, keep concise names and unique IDs, restore useful focus, preserve keyboard operation and announcements. |
| Privacy / abuse | Viewer URL must stay a read-only public boundary; encoded media paths disclose private vault names. | P2/P4: Keep loopback + opaque source URL, random media IDs, strict Host/Origin/method checks, selected-media allowlist, literal text, no private paths/records or mutation route. |
| Lifecycle / resource use | Heartbeats bypass cue backpressure; unload can overlap startup. | P2/P4: Apply one bounded SSE write policy to all frames and verify partial startup/unload/port conflict cleanup. |
| Durability / concurrency | Mock storage does not prove endpoint stability or conflicts. | P4: Exact storage/endpoint reload and external-edit/failed-save tests with retained bytes. |
| Integration / automation | Current E2E primarily proves manual dispatch. | P4: Drive actual committed StudioService events through alertsModule and a real local source; reject failed/duplicate/simulated/private events. |
| OBS playback / recovery | Decode evidence alone cannot prove audio ran. | P4: In the contained real host, verify GIF decoding, audio playback/volume, source refresh/reconnect, Stop, stable reload and unload closure. |
| Maintenance / release | Full evidence is required before merge. | P5: Final self-review, full project/UI/native gates, reviewed images, PR evidence and green CI for the exact final revision. |

## Execution plan and ownership

### P1 — independent researched reviews (complete)

Three subagents independently reviewed product/UX/accessibility, backend/privacy/reliability,
and testing/end-to-end evidence. Parent reconciled overlapping findings into this plan.
Initial evidence: service/HTTP/privacy/UI/player focused tests passed; a later unload/observer
case passed. Typecheck and native load/reload smoke passed. Initial native journey exposed
an exact-label locator defect; it was corrected. The broad preview server timed out during
its rebuild twice; this remains an unresolved verification item, not passing UI evidence.

### P2 — backend reliability and honest delivery (backend subagent)

- Expose live source count through the transport/service snapshot.
- Return a sent-source count; reject zero sources before claiming success.
- Preflight selected media before cue publication.
- Use common SSE backpressure handling for cues, clear and heartbeat frames.
- Preserve unrelated playback on save and revoke media access deliberately.
- Publish event-variable capability metadata and validate impossible automatic bindings.
- Retain startup/unload safety, ephemeral delivery, privacy revocation and read-only source semantics.
- Replace encoded vault media paths with opaque runtime IDs; bound and revoke the mapping.
- Closeout: cancel pending preflight on source membership changes, serialize bounded admissions,
  and start alert disposal concurrently with unrelated runtime cancellation.

### P3 — on-air controls and accessibility (product/UX subagent)

- Put saved-alert dispatch first and collapse configuration/setup appropriately.
- Display live source state, explicit delivery results and zero-source recovery.
- Show event-specific variable support and conditional availability.
- Explain source lifetime, refresh, audio mixing and monitoring using official OBS guidance.
- Preserve drafts, provide concise labels/descriptions and useful keyboard focus.
- Follow the existing Obsidian-compatible visual system in wide/narrow and light/dark views.

### P4 — end-to-end regression coverage (test subagent)

- Update service and UI assertions for final APIs without weakening existing guarantees.
- Add real event-to-source module integration and exact persistence/conflict cases.
- Exercise multiple sources, complete SSE frames, no replay, queue bounds and access revocation.
- Strengthen contained-native GIF/audio and source reconnect/reload/Stop/unload evidence.
- Keep tests behavior-based and bounded; parent serializes production builds/native runs.

### P5 — integrate, polish, qualify and merge (parent)

1. Read every subagent diff, reconcile contracts, run focused regressions and fix findings.
2. Run npm run verify:project; npm run test:ui-quality; npm run ui:gallery;
   npm run -s dev:obsidian -- --json; npm run test:obsidian (appropriate lifecycle coverage),
   and documentation/whitespace gates. Never overlap builds that share the build lock.
3. Review gallery and Alerts-specific native images once; implement a bounded final polish pass
   and rerun affected verification. Record real outputs and any remaining limits.
4. Fill the PR template and this plan's evidence. Create a codex/ branch and draft PR,
   attach it to the chat, enable the repository's e2e checks, and resolve CI failures.
5. Mark ready and merge only when the exact final revision's required checks are green.
   Confirm merge and report the usable Alerts journey and any untested real OBS scope.

### P6 — integrate newly available Twitch stream activity (coordinated subagents)

While PR #42 was prepared, main advanced to the Twitch operations increment (#39).
Its committed EventSub activity is now available to satisfy the original automatic
stream-alert journey. Preserve both navigation families and regenerate the combined
catalogue (103 views), then integrate this new seam before final qualification.

- Backend: reuse committed activity IDs and current channel identity; expose a curated
  set of public event bindings with safe display-name/amount/reward variables. Preserve
  verified anonymity and raid direction. Keep raw messages, user input, moderation,
  account identifiers, linked private context and stale/retained activities private.
- Product: research Twitch’s official event definitions and explain conditional variables,
  subscription recipients versus gifters, amounts/units and existing permission collection.
- Tests: actual TwitchOperations ingestion through the overlay, duplicate/failed/stale/
  channel/private suppression, plus parser direction evidence and final combined native gates.
- No new Twitch authorization, external mutations, automatic agent execution or history replay.

## Explicit limits

- No personal vault, live Twitch broadcast, or user OBS scene collection is used for tests.
- Browser-source delivery and media playback in the controlled browser are distinct from
  observing the user's live OBS program output. The interface must not conflate them.
- No public hosting, arbitrary URL media, external music licensing, or remotely writable
  alert endpoint is added by this increment.

## Evidence and closeout

Pending final integrated checks and PR/merge.

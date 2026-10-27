# Player foundations: product review and improvement pass

Status: product and technical review captured; improvement pass implemented; final verification in progress.

## Evidence and scope

Current-run headless browser flows exercise source-backed synthetic data. Screenshots under
`reports/player-foundations/` are reviewed desktop/narrow captures in both themes. They establish UI
behavior; fake HTTP/socket tests establish protocol rules. Live Twitch acceptance remains user-operated.
No personal vault was opened, and no live messages or moderation were performed.

## Journey walkthrough

1. First contact and registration: unregistered requests retain their draft and prompt `!register`;
   successful registration creates one stable player without resetting prior history. Health: functional;
   improve local-test onboarding guidance and keep greetings bounded.
2. Request/vote participation: registration and restrictions gate participation; features have a persisted
   five-minute cross-project cooldown. Health: functional; retain independent bug-report protections.
3. Player management: `players-dark-1280.png` and `players-light-360.png` show search/status/table,
   profile and explicit block confirmation. Health: accessible/reflowing; moderation is too far below
   the player heading and local-test profiles show unusable Twitch inputs.
4. Earning rules and operations: `operations-dark-1280.png` shows counters, editable rules and filtered
   records. Health: functional; group metrics for faster scanning and keep save feedback near the form.
5. Recurring messages: `messages-dark-360.png` shows paused defaults, interval editor and channel setup
   error. Health: functional; expose last confirmed send and delivery-pause reasons in the list.
6. Community environment: `community-settings-light-360.png` shows actor/currency naming and the
   named XP ladder. Health: accessible/reflowing; save/invalid-draft/navigation/focus behavior has regression coverage.

## Perspectives and findings

| Perspective | Finding | Improvement / proof required |
| --- | --- | --- |
| Viewer onboarding | Local testing does not yet explain the new registration prerequisite before a command is typed. | Add explicit guidance and registration-aware placeholder; retain real !register tests. |
| Streamer operations / UX | Player moderation is below eight stats and long descriptions. | Put actions near the selected identity; hide unavailable local-test moderation fields. |
| Reliability | A transport reconnect can leave a recurring reply queued from the previous connection. | Reset recurring intervals on loss; require current live readiness and matching stream intent before send. |
| Recovery / delivery | Paused recurring rows do not explain transport failure or show confirmed send time. | Persist safe failure reason and confirmed-send time; retain uncertain intent without automatic replay. |
| Moderation / data integrity | Reviewed timeout parameters must be frozen, and uncertain operations must survive restart. | Capture duration/reason at review; persist pending outcome and require authoritative refresh; add regression tests. |
| Economy / abuse | Repeat screening, registration and clock gaps must never mint extra rewards. | Durable milestone claims; immutable registration balances; complete-snapshot and outage tests. |
| Privacy / support | Diagnostics must not export player IDs or chat text; log retention must be explicit. | Framework catalog with safe metadata; bounded durable operational records, counters and diagnostics tests. |
| Performance | Population sorting and backlog aggregation currently repeat every countdown tick. | Separate stable profile aggregation from time-dependent display; paginate tables and bound records. |
| Accessibility | Tabs need retained panel targets; narrow tables and scrolling logs need keyboard access. | Persistent hidden tab panels, focusable scroll regions, axe + keyboard checks. |
| Statistics | Flat metrics mix participation, delivery and agent health; chat noise can displace important records. | Group metrics; retain message counters without one audit row per ordinary chat message. |

The review covers product behavior, viewer/streamer UX, accessibility, reliability, moderation,
economy/abuse, data migration, privacy/security, performance and operational support. Game actor
spawning, purchases and actual video watch verification remain outside this foundation.

## Final evidence

## Follow-up improvements

- Moved participation/Twitch actions next to player identity, hid unusable test-profile controls, and separated the
  detail component behind a read-only model/action interface. Reviewed timeout values are immutable once confirmed.
- Added dedicated Community settings for actor/currency labels and named XP thresholds. Invalid drafts are retained,
  navigation guards clear after save/discard, and adding/removing a rank moves focus to the relevant field.
- Separated stable player/backlog aggregation from countdown updates; paginated tables remain bounded.
- Grouped operational statistics and retained ordinary-chat counts without displacing the audit ring with chat noise.
- Added per-message delivery-pause reasons and last confirmed send time. Interrupted sends remain unconfirmed across
  restart and need reviewed activation; old intervals are not replayed. Due-message scheduling avoids starvation.
- Cancelled stale recurring intents on connection changes and checked live readiness/current stream intent before send.
- Split delivery, presence sampling, recurring scheduling and moderation into framework-free application services with
  explicit provider ports. Split state recovery and commit policies from serialized store orchestration.
- Added immutable post-commit event contracts and isolated failing/async observers. All new commit facts are emitted
  even when older retained history is trimmed. Explicit operator sends now persist their own intent before HTTP.
- Added restriction snapshot leases so stale reads cannot overwrite newer moderation; held unknown outcomes through reload.
- A regression reproduced a slow refresh overwriting a newer OAuth login. Credential leases now preserve the newer pair,
  and stale refresh callers reuse the validated newer account. Provider writes require documented success confirmations.
- Added privacy regression coverage so player economy, moderation and recurring text never leak into public-board output.
- Final host review reproduced a same-day filename collision between private project exports and diagnostics. Exports now
  use separate capabilities/namespaces and unique filenames; the regression proves project snapshots remain unchanged.
- Formatted new modules and kept every runtime/test file within project size limits. No dependency or test threshold changes.

## Confirmation review

Reviewed the final player desktop, named-rank narrow, grouped-operations desktop and recurring-message
narrow captures after the improvement pass. Actions are adjacent to identity, unavailable test controls are
removed, metrics are grouped, and currency/rank labels use the community configuration. No further visual
changes were needed. The static detector returned `[]`. Browser checks passed in both themes, including
narrow reflow, keyboard focus and added-rank focus. These findings are resolved; native CI is the remaining host gate.

Architecture and extension guidance: `docs/coforge/FOUNDATIONS.md`. Operator guide: `docs/coforge/COMMUNITY.md`.
Final local checks: five project gates and build passed; 145 product tests passed (five existing Windows skips), all
24 browser tests passed, the standalone UI-quality gate passed 8/8, and 40 gallery captures were generated. The narrowed
public facade also typechecked. No source/test limits or dependencies were weakened. Contained native CI is pending.
Screenshot evidence is not an accessibility-compliance certification. Live Twitch operations remain user-operated.

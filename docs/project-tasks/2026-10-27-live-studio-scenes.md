# Task: Monitor a live stream and maintain OBS scenes

- Status: in progress
- Owner scope: scene CRUD/switching plus existing-source visibility, order and membership; no source/device/audio property editor.
- Traceability: BRIEF and owner request; no generated req-/vi-* IDs exist.

## Acceptance

- Stream studio shows viewers (15-second reads), OBS health and observed rolling chat activity (5-second reads),
  source age, unavailable/offline/stale states and correct zeroes. One stalled provider cannot block another.
- Telemetry owns timers, cancels on unload and ignores changed channel/connection results. Archive remains minute-based.
- Scene/source mutations are explicit, serialized with stream controls, journaled before effects and confirmed by readback.
- Protect program/preview, last and configured scenes from deletion; preserve saved scene references on known rename.
- Delete/remove confirms the exact target. Uncertain results survive restart and require refresh without automatic replay.
- Scene copies retain shared source references and layout/visibility/order; partial copies remain visible for review.
- Existing source addition prevents nested-scene cycles; groups are managed as top-level items.
- UI preserves drafts on failure, stays honest in preview and works with keyboard at desktop/narrow widths in both themes.
- Protocol, fake-clock, failure/recovery, UI and contained-host tests; full checks, self-review and green CI before merge.

Maker preview creates an unrelated note aggregate/view; extend the existing CoForge application and OBS ports instead.
No real broadcast, scene deletion or channel write is used in agent QA.

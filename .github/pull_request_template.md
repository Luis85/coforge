## Summary

Add per-project feature group selection under Project settings → General. Explicit
saves choose Build & Improve, Stream, Community and Insights in the canonical
project note. Legacy projects show every group; an empty selection is valid.
Settings and the project switcher stay reachable, and hidden destinations resolve
to an available area.

Hiding Stream removes its navigation, board chat/toggle, stream profile and live
dock while retaining chat drafts. Shared services and agent execution continue.
Stale drafts, failed writes, note identity, unrelated frontmatter and body bytes
retain their existing protection. Project actions say Open project when the board
is hidden.

## Requirements and traceability

- Owner decision: BRIEF.md, 2026-10-30.
- Task: docs/project-tasks/2026-10-30-project-feature-groups.md.
- No imported req-* or vi-* IDs apply; design/traceability.json declares none.
- Behavioural service/UI tests, browser journey and contained Obsidian reload test.

## Validation

- Earlier focused qualification: 13 service/UI/privacy/navigation tests passed.
- Earlier UI quality: 8 passed; targeted browser journey: 2 passed.
- Earlier contained Obsidian: 1 passed; dev loop status passed, errors [].
- Isolated branch qualification is in progress; the PR stays draft until green.

## UI evidence

- Light/dark, wide/narrow feature controls inspected under reports/project-feature-groups/.
- UI gallery: 40 captures, no failures; representative captures reviewed.
- No screenshot baselines changed. Impeccable detector: [].

## Obsidian evidence

- Existing contained-host test verifies saved groups after reload, unknown
  frontmatter and exact human Markdown body preservation. Host teardown completed.
- Fresh isolated qualification results will be recorded before marking ready.

## Untested scope

No personal vault, live Twitch/OBS mutation, billable provider invocation or
external publication. Preferences affect the workspace only. Concurrent music
and OBS changes in the original checkout are excluded from this branch.
Local Node/npm are 24.20.0/11.21.1; GitHub uses pins 24.21.0/11.19.1.

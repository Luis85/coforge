## Summary

Stream studio now focuses on stream controls, scene management and Show plans.
Show plan is second after Broadcast and presents an ordered rundown beside the
selected cue, presenter notes and explicit Run controls.

Remove the program/preview monitors, audio mixer, source/layout property editors,
full studio setup and standalone output controls, together with their exclusive
UI state/helpers/styles. Read OBS targets on demand; do not poll screenshots or
unused audio settings, and do not subscribe to high-frequency audio meters.
Keep existing scene and cue action contracts, restart-review recovery, public
mapping policy, private data and no-replay boundaries.

## Requirements and traceability

- Owner scope correction and follow-through (2026-10-30), recorded in BRIEF.md.
- Requirement: docs/requirements/OBS Studio Integration.md, pbl-id 6.
- No imported req-* or vi-* obligations are declared for this feature.
- Task: docs/project-tasks/2026-10-30-obs-studio-focus.md.
- Earlier Show plan work is included; unrelated music/project-visibility changes
  are excluded from this isolated branch.

## Validation

- TDD removal/session scope: 3 failing regressions before implementation;
  5 files / 13 tests passed afterward.
- Final session notice/watch and dock regression: 2 files / 2 passed (6.61s).
- Meter subscription protocol regression failed first; protocol/production/session
  suites then passed 17 tests across 3 files (10.41s).
- Scoped ESLint with --max-warnings 0 and git diff --check: exit 0.
- Full canonical verification and CI: qualification in progress.

## UI and Obsidian evidence

- Final native: 3 files / 3 passed (41.16s) after 9.06s build. Covers start,
  BRB/resume, stop; scene creation/rename/duplicate/switch/delete; Show cue
  execution and reload without replay; reviewed overlays and privacy revocation.
  No screenshots/meter subscription or repeated audio-setting reads on Broadcast.
- Eight light/dark/wide/narrow Broadcast/Show WCAG scans plus on-air/draft checks:
  zero violations/overflow. Enabled Go live is included. Prepared-state contrast
  failed before the scoped fix and passes afterward. Public overlay captures have
  zero overflow (no accessibility-scan claim).
- Final polish regression: 3 passed (5.21s); duplicate metric strip removed while
  preserving the existing viewers/chat/health monitor.
- Browser keyboard/draft/navigation regression: 1 passed (49.0s test).
  Final npm run test:ui-quality: 8 passed (58.7s). Impeccable detector: [].
- Gallery, final dev session and canonical full gate: in progress.
- Preliminary Show plan model/authoring and host evidence is retained in
  docs/project-tasks/2026-10-30-show-plan-polish.md; final release evidence belongs
  to the focus task above.

## Untested scope

Real OBS hardware/audio audibility and public broadcasts require operator
acceptance. Native tests use contained Obsidian and loopback simulated OBS servers.
Local Node 24.20.0 differs from the pin; CI uses the pinned toolchain. No dependency
or lockfile changes, real-account mutations or screenshot baseline updates.

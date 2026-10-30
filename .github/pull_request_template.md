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

- Focused qualification: 4 files / 13 service/UI/privacy/navigation tests passed.
- Fresh isolated UI quality and feature journey: 10 passed (1.7m).
- Fresh isolated contained Obsidian: 1 passed (11.72s).
- Fresh isolated dev loop: status passed, errors [], hostErrorCount 0, pluginConsole [].
- check:views: 111 views; navigation coverage valid; sitemap current.
- Scope review and git diff --check passed; no weakened checks or baselines.
- Full local verify:project and exact final-head GitHub results are recorded in
  https://github.com/Luis85/coforge/pull/50. Merge requires successful check, ui and
  real-obsidian jobs; the e2e label enables the complete browser and host suites.

## UI evidence

- Light/dark, wide/narrow controls inspected under reports/project-feature-groups/.
- UI gallery evidence is under reports/ui-gallery/ (reviewed; never a baseline).
- Impeccable detector: [].

## Obsidian evidence

- Saved groups survive reload; unknown frontmatter and exact human body bytes
  remain intact. Test teardown completed and scratch was removed.
- Dev loop uses contained sandbox, Obsidian 1.14.4 / launcher 3.2.1; session ended.
- Evidence: reports/obsidian/cases/coforge-project-features--saves-visibility-in-the-canonical-project-note-and-restores-it-after-reload/
  and .obsidian-sandbox/logs/.

## Untested scope

No personal vault, live Twitch/OBS mutation, billable provider or external
publication. Preferences affect the workspace only. Concurrent music and OBS
changes in the original checkout are excluded from this branch. Local Node/npm
are 24.20.0/11.21.1; GitHub uses pins 24.21.0/11.19.1.

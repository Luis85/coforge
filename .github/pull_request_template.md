## Summary

Expand Project settings → General → Project features from four group switches to
18 individually selectable workspace capabilities. Service Design can be hidden
or shown independently of the Idea board, Council and CoWorkers. Group hiding
retains individual choices. Missing preferences preserve existing capabilities.

| Group | Individual features |
| --- | --- |
| Build & Improve | Idea board, The Council, CoWorkers, Service Design, Agent workflow |
| Stream | Stream studio, Alerts, Schedule, Stream chat, Twitch operations |
| Community | Community, Viewers, Economy, Community settings |
| Insights | Statistics, AI costs, Finances, Operations |

Internal tabs/editors stay with their owning feature. Essential settings and
project switching remain reachable. Chat and OBS panels are independent. Council
and workflow launch shortcuts respect saved choices; existing cancellation and
human review remain available. These preferences do not stop shared services,
change public projections or reconfigure captured work.

## Requirements and traceability

Owner follow-up recorded in BRIEF.md (2026-10-30). Inventory, boundary and
acceptance: docs/project-tasks/2026-10-30-optional-project-features.md.
No imported req-* or vi-* IDs apply. Every optional route and the compatibility
workflow alias have behavioral coverage; a catalogue test detects missing routes.

## Validation

- TDD red: 21 failed, 1 passed (unsupported features and missing controls).
  A separate shortcut test failed before Council/workflow launch filtering.
- Initial focused green: 4 files / 28 passed; added dirty-workflow case passed
  in a later 2-file / 7-test batch. Related navigation compatibility: 4 files / 7 passed.
- Browser/UI-quality: 10 passed (1.3m), light/dark, keyboard, selected counts,
  exact persisted choices, 1280/480px reflow and WCAG scans.
- Real Obsidian: 1 passed (9.69s), Service Design/group choices survive reload,
  unknown frontmatter and exact authored body bytes preserved; teardown completed.
- Dev loop: status passed, errors [], hostErrorCount 0, pluginConsole [].
- docs:views: 110 views; valid navigation coverage; sitemap current.
- Impeccable detector: []; scope review and git diff --check passed.
- Full local check uses the supported --timeout 3600000 orchestration budget;
  individual test limits and quality gates remain unchanged. Full local,
  artifact and exact-head GitHub check/ui/real-obsidian results are recorded in
  this PR before merge; the e2e label enables all browser and host suites.

## UI and Obsidian evidence

- reports/project-feature-groups/features-{light,dark}-{1280,480}.png reviewed.
  Descriptions wrap, counts remain visible, hidden groups retain readable choices.
- ui:gallery: 40 captures, no failures; representative captures reviewed. No
  screenshot baselines changed.
- reports/obsidian/cases/coforge-project-features--saves-visibility-in-the-canonical-project-note-and-restores-it-after-reload/
  and .obsidian-sandbox/logs/. Pinned host: Obsidian 1.14.4 / launcher 3.2.1.

## Untested scope

No personal vault, live Twitch/OBS mutation, billable provider or public-site
publication. Optional features control the project workspace, preserving actual
channel/vault data scope and runtime permissions. Local Node/npm are
24.20.0/11.21.1; CI uses pins 24.21.0/11.19.1.

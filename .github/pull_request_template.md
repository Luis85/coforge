## Summary

Resolve the 38 conflicts in the local merge of main. Keep the newer released
individual project-feature controls, OBS music integration and focused Show plan
surfaces, together with independent local ignore/public-export changes and the
extra navigation-order assertion. Register the imported optional-feature fixture
as a test helper so the diff self-review guard recognizes it.

## Requirements and traceability

No req-* or vi-* obligations apply; this reconciles existing owner decisions in
BRIEF.md. Details: docs/project-tasks/2026-10-30-resolve-main-merge.md.

## Validation

- git ls-files -u: empty; all 38 conflicted paths resolved and staged.
- npm run typecheck: exit 0.
- npm run verify:project -- --timeout 1800000: exit 0. All 5 check steps
  passed, 0 failed, 0 skipped (882.2s); 360 product files, 1,410 passing tests,
  0 failures and 6 existing skipped tests. Build and embedding check passed
  (1 test). UI effects are skipped because no visual definitions are declared.
  npm warned that the outer timeout option was not forwarded to check; its
  standard per-step process budgets ran successfully without modification.
- npm run test:ui-quality: 8 passed (57.8s).
- npm run ui:gallery: 40 screenshots, no failures; wide dark and narrow light
  studio layouts and the contained-host screenshot reviewed.
- npm run -s dev:obsidian -- --json: status passed, errors [],
  hostErrorCount 0, pluginConsole [].
- npm run test:obsidian -- coforge-project-features coforge-show-plan coforge-obs-music:
  3 files / 3 tests passed (39.83s).
- npm run check:self-review: no findings after registering the helper.
- git diff --cached --check: exit 0.

## Evidence and limitations

Logs and pre-resolution backups: reports/merge-resolution-2026-10-30/.
UI gallery: reports/ui-gallery/. Host evidence: reports/obsidian/ and
.obsidian-sandbox/logs/. Generated evidence is excluded from Git.

The optional node tooling/testing/suites.mjs --check command exits 1 and reports
pre-existing shell-suite manifest gaps (missing shell scripts/documentation and
older unclassified helpers). The newly imported helper classification is fixed;
no existing test, lint rule, coverage threshold or screenshot baseline is weakened.

Only the three focused real-host specs were run. No live Twitch/OBS mutation,
personal vault, billable provider or publication is claimed. Local Node/npm are
24.20.0/11.21.1; the repository pins are 24.21.0/11.19.1.

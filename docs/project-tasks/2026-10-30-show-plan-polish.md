# Task: Make show planning and live cue operation clear and reliable

- Status: implemented; full-project qualification incomplete (product-test timeout)
- Journey in BRIEF.md: OBS integration scope, Show plans retained; equal attention
  to planning and running the show. Owner requested subagents.

## Why

The selected segment is hidden in a dropdown and run controls follow the entire
editor. Selecting another saved plan can also leave a different plan loaded in
the editor, creating a risk of running or deleting the wrong target.

## Traceability

- Owner requirement: docs/requirements/OBS Studio Integration.md (pbl-id 6).
- design/traceability.json declares no req-* or vi-* obligations for this feature.
- Focused behavioral/UI tests and a contained Obsidian show-plan journey qualify
  this change without claiming generated acceptance coverage.

## Acceptance

- Show plan is the second Stream studio navigation tab, immediately after Broadcast.
- The operator can scan ordered segments, durations and action counts, select a
  segment and review its notes/actions without running anything.
- Run controls identify the loaded saved plan and selected segment. Unsaved,
  empty, busy, disconnected or recovery-blocked cues explain the next action.
- Choosing a different plan in the loader never changes the execution/deletion
  target until that plan is loaded. Failed saves retain the draft, and edits made
  during an in-flight save cannot silently appear saved.
- Cue definitions and event bindings retain existing explicit save/execution,
  private data, durable outcome and no-replay boundaries.
- Wide/narrow and light/dark layouts keep controls reachable with keyboard focus.

## Plan

1. Model subagent writes failing regressions and fixes draft/target admission.
2. UI subagent builds a scannable rundown and compact runner with focused tests.
3. Qualification subagent adds contained host interaction and reload evidence.
4. Integrate, review, run required gates, inspect batched visual evidence and fix
   concrete findings in one bounded pass.

## Out of scope

OBS screen previews and audio tuning, new OBS action kinds, real public broadcasts,
account writes, automatic broadcast starts and replay of uncertain effects.

## Evidence

- Initial node bin/app status: status ok; dependencies installed; 0 pending
  acceptance obligations. Local Node 24.20.0 differs from .nvmrc 24.21.0.
- TDD model baseline: 3 failed before loaded-plan/save guards. Final review added
  3 failing cases for stale definitions, normalized saves and invalid duration
  input. Final model + authoring suites: 2 files / 10 tests passed.
- New rundown UI assertion failed before implementation. Final focused UI suite:
  1 passed, including dirty removal protection; existing authoring regressions
  passed. Scoped ESLint and source lint passed with zero warnings.
- Navigation regression: 1 file / 6 tests passed. Operation-catalog regressions:
  2 files / 5 tests passed. Historical music codes retain their tools catalog,
  avoiding startup overflow while concurrent playback removal is preserved.
- Final npm run typecheck: exit 0. npm run test:ui-quality: 8 passed (1.5m).
- npm run ui:gallery: 40 captures; reviewed representative light desktop studio
  and dark narrow settings. No baselines changed. Impeccable detector: [].
- npm run test:obsidian -- coforge-show-plan: 1 passed (20.382s test, 22.48s
  Vitest total). Tests second-tab order, keyboard rundown, private notes/duration,
  explicit save and cue execution, exactly one scene mutation plus local marker,
  and reload persistence without replay. Eight captures across light/dark and
  1280/480 widths reviewed; all four WCAG scans have violations [], overflow 0.
  Evidence: reports/obsidian/cases/coforge-show-plan--edits-and-saves-private-segments-runs-only-an-explicit-saved-cue-and-restores-the-plan-without-replay/.
- Native review found real run-button contrast and rundown accessible-name
  defects; fixed together and confirmed by the passing host test. Initial test
  selector and Electron AxeBuilder setup issues were corrected without weakening
  assertions. Native console empty; host stopped and scratch removed. The added
  unsaved-draft WCAG assertion also passes; it exposed action-reorder label
  mismatches, now fixed. High-contrast primary styles cover both Save and Run.
  Scoped ESLint of the final action component/native test exited 0.
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned Obsidian 1.14.4 / launcher 3.2.1. Read screenshot,
  dev.log and debug-report.json; session ended (complete). An initial concurrent
  build-lock failure was rerun after the native build completed.
- First npm run verify:project raced concurrent edits: typecheck/ESLint failed
  on changing music files; product tests captured intermediate failures and hit
  the existing 600-second deadline. Lint/maker-types passed.
- Final npm run verify:project: exit 1; typecheck (70.4s), source lint (9.4s)
  and maker-types (18.2s) passed. ESLint reported two concurrent
  ScheduleMusicFields.vue prop mutations; that work subsequently fixed them,
  and targeted ESLint exited 0. Product tests timed out at 601.1s with no
  assertion failures in the captured output. Full summary: 3 passed, 2 failed,
  0 skipped in 1024.1s. No full-suite pass is claimed.
- npm run verify:artifacts: exit 0 after waiting for a concurrent build lock.
  Build passed (11.43s); prototype embedding 1 passed / 0 failed. Generated
  UI-effect checks are not applicable (no visual definitions declared).
  Full gate/artifact logs: .obsidian-sandbox/show-plan-verification-final.log
  and .obsidian-sandbox/show-plan-artifacts-final.log.
- node tooling/coforge/view-catalog.mjs --check: 110 views; sitemap current.

## Untested scope

Real OBS hardware and a public broadcast require streamer-operated acceptance.

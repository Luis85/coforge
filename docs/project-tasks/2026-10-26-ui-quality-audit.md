# Task: Restore passing UI quality and dependency audit checks

- Status: in progress
- Journey in `BRIEF.md`: operate the studio board and configure integrations accessibly.

## Why

The studio fails accessibility and keyboard checks, and native settings overflow a narrow pane.
Five audit findings remain in transitive tooling dependencies after the Dependabot updates.

## Traceability

- Requirement keys and interaction IDs: none; the imported traceability files declare no obligations.
- Existing regression coverage: `tests/e2e/ui-quality.spec.ts` and the project studio tests.

## Acceptance

- Both surfaces pass all eight existing browser quality checks without exceptions or weaker assertions.
- Accessible button names include visible labels, search has visible keyboard focus, and settings reflow at 360px.
- An audit of every installed dependency category reports zero vulnerabilities.
- Project checks, release build, dependency policy, and contained Obsidian validation pass before merge.

## Plan

1. Use the four failing checks and audit report from main as regression evidence.
2. Correct accessible naming, theme-derived text contrast, focus styles, and settings wrapping.
3. Pin patched transitive dependencies, retaining the current lint plugin and all its rules.
4. Run the full gates; review the UI gallery and contained Obsidian evidence; merge a reviewed PR.

## Out of scope

New product behavior, a visual redesign, and changes to personal vaults.

## Evidence

- Baseline: `test:ui-quality` reported 4 failed, 4 passed on main; gallery captured 40 screenshots.
- Baseline audit: 5 findings (4 moderate, 1 high).
- Implementation and final verification pending.

## Untested scope

Local Obsidian is not provisioned; use the repository's contained CI host workflow for host evidence.

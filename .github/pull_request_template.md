## Summary

Idea board → request details → Activity now exposes the captured prompt and LLM
response inside each matching agent-run dropdown. Previously these showed only
diagnostic logs. Each attempt retains private instructions/input/output, captured
provider/model/effort and timestamps; retries and reloads preserve earlier evidence.

Capture before dispatch and result validation, retain failed/rejected output,
label simulations and legacy/missing/truncated history, and render literal wrapped
text. Keep system instructions and execution logs subordinate. Preserve existing
human review, recovery, privacy and public projection boundaries.

Includes the newly merged native Codex provider (PR #54): retain visible assistant
messages, exclude internal tool/reasoning streams, redact recognized credentials,
and keep reported usage and partial workspace cleanup when evidence storage fails.
MCP shows supplied task context/submitted results without claiming the external
client's full conversation or model.

## Requirements and traceability

Owner decision in BRIEF.md (2026-10-31). No req-* or vi-* obligations are declared
in the current traceability scaffold. Research, acceptance and executed improvement
increments: docs/project-tasks/2026-10-31-idea-chat-history.md and its companion
idea-chat-history-research.md. Three subagents covered UX/accessibility/product
research, backend/provider integrity, and privacy/native qualification, followed
by independent reviews and a polishing pass.

## Validation

- Test-first evidence: initial Claude capture cases 3 failed; Codex capture cases
  7 failed; UI history 2 failed; captured-effort case failed. All subsequently passed.
- Focused Claude/privacy/MCP/Herdr suite: 6 files / 42 tests passed; additional
  Claude prose+structured-output regression passed; final Codex capture/runner
  suite 2 files / 12 tests passed; mounted UI 4 tests passed.
- First integrated npm run verify:project: 3 steps passed, 2 failed (876.0s).
  370 files / 1,468 tests passed; 1 catalogue-sync test failed; 6 existing skips.
  Fixed the UI fixture's typed effort mutation and regenerated the catalogue.
  Fix qualification: npm run typecheck exit 0; UI/catalogue tests 16 passed;
  npm run docs:views: 108 views documented, navigation coverage valid.
- Corrected full local rerun was running when the draft PR was opened. Its final
  result and GitHub checks are recorded in the PR validation/checks before merge.
  Earlier full/fast attempts superseded by upstream integration are not counted.
- npm run test:ui-quality: 8 passed (54.6s).
- npm run ui:gallery: 40 screenshots; wide dark and narrow light reviewed.
- npm run test:obsidian -- coforge-idea-chat-history coforge-provider-settings
  coforge-design-workflow: 3 files / 3 tests passed (46.88s).
- npm run -s dev:obsidian -- --json: status passed, errors [], hostErrorCount 0,
  pluginConsole []; pinned Obsidian 1.14.4 / launcher 3.2.1.
- Native history: keyboard disclosures, two distinct captures, persisted reload,
  unchanged authored body, no dispatch from reading, narrow containment; eight
  input/response screenshots reviewed across light/dark and 1280/720 widths.
- Manual Impeccable detector: [] findings. npm run check:self-review: no findings
  in 35 changed files before this evidence update. git diff --check: clean.

## Evidence and limitations

Local logs: reports/idea-chat-history-final-*.log. Gallery: reports/ui-gallery/.
Host screenshots/results: reports/obsidian/; dev logs: .obsidian-sandbox/logs/.
Generated evidence is excluded from Git. Full GitHub browser/native checks
run with the e2e label; merge only when all required checks are green.

History begins with newly captured runs. Older runs cannot be reconstructed.
Capture precedes dispatch and alone does not prove delivery. Tool/internal reasoning
turns are unavailable; external MCP clients expose only CoForge context/submissions.
Recognizable credentials in Claude/Codex response captures are redacted, without
claiming exhaustive secret detection. Retained text is bounded to 64,000 characters
per field, visibly truncated, within the existing latest-500-job retention policy.

No live billable provider call, personal vault or game repository mutation was used.
Native end-to-end calls are explicitly simulated; provider boundaries use deterministic
transport tests. Local Node/npm: 24.20.0/11.21.1; repository pins 24.21.0/11.19.1;
GitHub uses the pins. No dependencies, lint thresholds, tests or execution gates
were weakened. The original checkout and other sessions remain untouched.

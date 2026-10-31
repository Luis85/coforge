## Summary

Replace free-text AI model fields with provider-specific model and reasoning-effort
choices in workflow settings and CoWorker definitions. Add native Codex alongside
Claude, managed Herdr and Simulation, retaining custom IDs, explicit saves and
captured execution choices.

Codex uses local authentication and an ephemeral restricted model profile.
Authenticated CoForge MCP tools own repository access, protected-file checks,
finite call limits and independent worktree capture. Active file operations settle
before final capture. Record provider tokens while leaving unavailable USD cost
unknown; Claude's turn/USD flags are not presented as Codex spending caps.

Keep completed Design requests in Design with “Design complete · Ready to build”
when the next captured step is Build and current, intact Design evidence exists.
Explain recognized Claude turn/budget/output failures without exposing raw output.

## Requirements and traceability

Owner decisions in BRIEF.md: provider model settings, native Codex, and Design-column
readiness (2026-10-30). No req-* or vi-* IDs are declared in the current traceability.
Detailed evidence: docs/project-tasks/2026-10-30-provider-model-effort.md.

## Validation

- NODE_OPTIONS=--max-old-space-size=8192 npm run verify:project: exit 0.
  check: 5 passed, 0 failed, 0 skipped (931.1s); 366 product files,
  1,440 passing tests, 0 failures, 6 existing skipped tests. Build passed;
  prototype embedding: 1 passed. UI effects are explicitly skipped because
  this project declares no visual definitions.
- verify:project now uses the existing CLI's supported --timeout 1800000 process
  budget. The measured product suite was close to its former 600-second process
  ceiling. Individual test timeouts, assertions, lint and coverage are unchanged.
- npm run test:ui-quality: 8 passed (1.1m).
- npm run ui:gallery: 40 screenshots; wide dark and narrow light reviewed.
- npm run test:obsidian -- coforge-provider-settings coforge-design-workflow:
  2 files, 2 tests passed (36.84s), including persisted Codex model/effort in both
  editors, reload preservation, Design readiness and the Design handoff to Build.
- npm run -s dev:obsidian -- --json: status passed, errors [],
  hostErrorCount 0, pluginConsole [].
- Installed native Codex 0.145 with a synthetic loopback Responses endpoint:
  authenticated scoped MCP returned its bound task; a forced native image read
  was denied; native shell, patch and delegation tools were absent. No billable
  inference. Adapter tests also cover protected writes, usage, credentials,
  optional reply fields and draining active host calls before capture.
- Impeccable detector: [] across the five changed provider/settings targets.
- npm run check:self-review: no findings in 87 changed files.
- git diff --check: exit 0.

## Evidence and limitations

UI evidence: reports/ui-gallery/ and reports/obsidian/cases/.
Host reload evidence: .obsidian-sandbox/logs/.
Generated evidence is excluded from Git. Existing live public-export changes
were not authored or altered for this task.

No live/billable provider request, personal-vault launch or CF-134 retry. CF-134's
historical record retained exit code 1 and usage but not the detailed failure
subtype; its exact cause cannot be recovered from that record.

Choices follow documented provider capabilities; account policy still applies.
Codex additionally requires matching local model metadata, refreshed by opening
Codex. Native Codex qualification covered Windows; other OSes were not qualified.
References: https://code.claude.com/docs/en/model-config and
https://learn.chatgpt.com/docs/non-interactive-mode.

Local Node/npm: 24.20.0/11.21.1; repository pins: 24.21.0/11.19.1.

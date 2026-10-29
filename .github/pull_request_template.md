## Summary

Opening the repository-root vault can fail with an edited-public-export warning because its shipped public board predates project IDs. Recognize that exact historical renderer and projection on startup without rewriting the export or canonical notes. Edited HTML, unsupported fields and invalid identities still fail closed; private-project startup still retires verified generated files.

The owner authorized agents to download pinned Obsidian tooling for contained tests. Update AGENTS.md and the canonical debug/self-review skills while retaining version validation, isolated vault/profile guards and the ban on arbitrary/global installs.

Provisioning also exposed a Windows shell-quoting bug when Node/npm paths contain spaces. Invoke the native Node executable directly with argv; only the npm.cmd fallback uses a shell.

## Requirements and traceability

- Startup compatibility and project-publication/privacy requirements in BRIEF.md.
- Owner authorization to change the download rule, 2026-10-29.
- Task: docs/project-tasks/2026-10-29-public-export-startup.md.
- No generated req-* / vi-* verification fields changed.

## Validation

- Before fix: 2 startup compatibility regressions failed with the exact reported warning; 3 protection cases passed.
- After fix: 25 startup/privacy regression tests passed, including byte preservation, edited/malformed projections, hidden unsupported context and private-export revocation.
- Native Windows installer regression reproduced the C:\Program failure before the fix; installer/harness tests now 7 passed.
- Real Obsidian 1.14.4 on Windows: 4 files / 4 tests passed, covering the historical-export upgrade and reload, privacy, plugin loading and lifecycle. Historical JSON/HTML and human notes stayed byte-for-byte unchanged.
- Dev smoke: status passed, plugin loaded/enabled, errors []; its automatic view-opening helper reported a host tab-group error, so the dedicated native upgrade test provides the actual studio-view evidence.
- Source line limits/locale parity passed. Self-review and git diff --check passed.
- npm run verify:project is running; final result will be recorded before merge.
- Global suite-inventory check reports pre-existing missing framework scripts/docs. New fixtures are classified correctly and self-review is clean.

## UI and host evidence

No current UI or public-site rendering is changed; the frozen historical renderer is used only for exact ownership comparison. Native evidence is under reports/obsidian/cases/ and .obsidian-sandbox/logs/. No screenshot baseline was changed.

## Untested scope

No personal vault was opened. Live external services/model sessions were not invoked. Windows provisioning and the product startup path are exercised locally; Linux CI provides cross-platform verification. Reports, downloaded host/cache and build assets remain ignored.

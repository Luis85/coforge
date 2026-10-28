## Summary

CoForge bundles one vault-wide MCP server, activated once from native plugin settings and registered in the vault's `.mcp.json` plus the user's `~/.claude.json`. External clients discover projects and pass explicit project IDs to workflow tools. No individual game repository needs MCP configuration. Screen/Score/Plan/Build use pinned context, validated outputs and bounded file tools; Build writes an attributed worktree and final acceptance remains human.

The Council now has a Task scheduler for prompts with optional note context. It supports one-time timers, intervals and daily/weekly times in a saved timezone, routing to an agent, a council or one selected team member. The designated open desktop dispatches through existing Council admission. Missed runs and overlaps are skipped, interrupted/unknown admissions are held for explicit recovery, and prior occurrences retain their inputs and project attribution.

## Requirements and traceability

- Owner requests and confirmed decisions, 2026-10-28, in BRIEF.md.
- Generated traceability contains no req-* or vi-* obligations; none were marked implemented.
- Tasks: docs/project-tasks/2026-10-28-local-mcp.md and docs/project-tasks/2026-10-28-task-scheduler.md.
- Guides: docs/coforge/MCP.md and docs/coforge/TASK-SCHEDULER.md.
- Surface contracts: docs/components/views/native-mcp.md and council-scheduler.md; sitemap regenerated.

## Commands run

- `npm ci`: added 691 packages, audited 692; 0 vulnerabilities.
- Targeted native transport/workflow/file/registration tests include real stdio discovery and scratch Git worktree capture, malformed/stale/cross-project rejection, shared registration, queue progress and reload/unload behavior.
- Scheduler tests cover wall-clock/DST resolution, one-time consumption, overlap and missed-run skipping, non-executor protection, persistence failure, stale drafts, immutable history, uncertain-admission recovery and real paused Council admission to all three destination kinds.
- `npm run verify:project`: **exit 0**, reports/mcp/verify-clean.log. Check **5 passed, 0 failed, 0 skipped in 497.6s**; production candidate built; prototype embedding **1 passed, 0 failed**. An earlier native Herdr test timed out; isolated and final full reruns passed without threshold changes.
- Final unload ordering refinement: host/MCP suites **5 passed**; typecheck and targeted ESLint passed; `npm run verify:artifacts` passed again and rebuilt the current production candidate. MCP access and task timers are signalled closed before waiting for either module's cleanup.
- `npm run typecheck`: exit 0 after final contract/ownership changes.
- `npm run build:clickdummy -- --replace`: exit 0.
- `npm run test:ui-quality -- --config reports/mcp/playwright.config.mjs tests/e2e/journeys/task-scheduler.spec.ts tests/e2e/journeys/view-intent.spec.ts --grep 'WCAG|reflow|primary actions|native settings|task scheduler'`: **11 passed (2.3m)**. Same quality suite with temporary port 4193 because the default 4181 port was occupied; no gate was weakened.
- `npm run ui:gallery`: **40 screenshots captured**, no failures. Scheduler browser tests add eight form/list screenshots in both themes and widths.
- `npm run check:views`: **75 views documented; navigation coverage valid; sitemap current**.
- `npm run check:source`: limits and locale parity passed, **2904 inputs, 226 translated keys**.
- Self-review checker: clean, no violations or exceptions. `git diff --check`: exit 0. Impeccable detector: exit 0, `[]` findings.

## UI evidence

reports/ui-gallery/index.json and gallery.html; reports/task-scheduler/; reports/ui-intent/after/15-native-settings-*.png. Reviewed the MCP settings and scheduler form/list at desktop and narrow widths, in both themes. Browser checks cover accessibility, reflow, keyboard reachability, no text/control overlap, explicit recipient routing, draft preservation, timezone validation and archiving. The example is labelled memory-only and invokes no provider. No screenshot baseline was changed or committed.

## Obsidian evidence

Real-Obsidian dev/test commands report obsidian-launcher 3.2.1 is not provisioned; the final test command exits 2. Nothing was downloaded or launched. In-memory host tests cover startup/unload and real Council admission contracts; configuration/transport tests use scratch files and a real scratch Git worktree. User MCP/Claude settings and personal vaults were not modified.

## Untested scope

Real Obsidian rendering and live Claude/Herdr/Twitch/OBS sessions remain unqualified locally. MCP needs Node.js 22+ on PATH; CoForge cannot control an external client's own tools/history/model/usage. Native typed Council provider restrictions remain authoritative for scheduled work. Build requires a clean game repository and human review. Council/v2 execution is not exposed by the MCP increment. The existing Windows suite skips six Unix fake-CLI cases, exercised in Linux CI. Local Node is v24.20.0; `.nvmrc` pins v24.21.0. Reports, screenshots, scratch data and build outputs remain ignored.

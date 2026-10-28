# Task: Schedule private agent, team-member and council work

- Status: done
- Journey in BRIEF.md: Agent task scheduler.

## Why

The streamer needs recurring private agent work without manually resubmitting the same prompt. Each occurrence must keep its recipient, context, timing and execution evidence without replaying missed or uncertain work.

## Acceptance

- Create, edit, pause/resume and archive project-owned schedules with a prompt and optional note context.
- One-time timers, repeating intervals and daily/weekly times show a saved timezone and next occurrence.
- Select an agent, a council, or a team with one explicitly selected member; validate project/team membership at dispatch.
- Only the designated open desktop dispatches; missed runs are skipped. Persist intent before admission, retain occurrence/run evidence, and never replay unknown outcomes after restart.
- Skip occurrences while the previous run is active and display the reason; no overlapping run is created.
- Use the Council execution kernel, existing limits and final review; context is a snapshot and unrelated notes are preserved.
- Include empty, validation/error, inactive-executor and recovery states in the UI.

## Traceability

Owner request 2026-10-28; generated traceability has no req-* or vi-* entries.

## Plan

1. Timing and scheduling service tests first, including DST, reload, save failures and deduplication.
2. Private persistence and Council admission adapter; a focused Council scheduler subpage.
3. Product checks, browser evidence, host verification where provisioned and self-review.

## Evidence

- Timing/service/host/UI suites: 13 passing tests, including real paused Council admission to agents, selected team members and councils.
- Weekly DST gap regression: reproduced a failure, extended the bounded calendar search, then timing/service suites passed (10 tests).
- Browser quality plus native-settings and scheduler journeys: 11 passed (2.3m), including accessibility, reflow, drafts, validation and archiving in both themes.
- `npm run ui:gallery`: 40 captures, with eight additional scheduler form/list captures reviewed under `reports/task-scheduler/`.
- `npm run check:views`: 75 views documented, valid coverage and current sitemap.
- Final `npm run verify:project`: exit 0; check **5 passed, 0 failed, 0 skipped in 497.6s**. Production candidate built and prototype embedding **1 passed, 0 failed**. An earlier Herdr timing failure passed in isolation and in this final full run without threshold changes.
- Final unload ordering refinement: host/MCP suites **5 passed**, typecheck and targeted ESLint passed; production candidate rebuilt.

## Untested scope

Real Obsidian is not provisioned in this checkout; native host commands report launcher 3.2.1 is missing and nothing was downloaded. Live native-provider sessions remain unqualified; browser examples are explicitly simulated. Existing Windows-only skips remain documented in the review template.

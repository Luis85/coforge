## Summary

The studio had multi-purpose pages, inconsistent page/form seams and no checked view inventory. This stabilization documents 73 focused views, generates their sitemap, separates Broadcast/Chat/Workflow/Council tasks into subpages, and unifies leaf-responsive frames, controls and keyboard focus. Drafts and explicit execution/review boundaries remain intact.

It also fixes Council startup reviving vault listeners/polling after unload, with four delayed-I/O/cleanup-handoff regressions. Independent product, UX/accessibility, privacy/reliability and maintenance reviews drove the final polishing repairs.

## Requirements and traceability

- BRIEF.md: every private/native/public view needs a clear goal and next action; comprehensive product review and final improvement pass.
- Council PRD: OPS-01–03 and AC-26. Existing generated traceability has no req-* or vi-* obligations.
- User request: one frontmatter/Markdown file per view, generated sitemap, complete journey review, focused subpages and consistent UI.
- View contracts and shared conventions: docs/components/; complete journey matrix and five review reports linked from docs/project-tasks/2026-10-28-plugin-stabilization.md.

## Commands run

- [x] npm ci: 691 packages added, 692 audited, 0 vulnerabilities.
- [x] npm run verify:project: exit 0; nested check **5 passed, 0 failed, 0 skipped in 526.0s**. Production candidate built; prototype embedding **1 passed, 0 failed**.
- [x] npm run test:e2e: initial full run **133 passed, 9 failed**; it exposed obsolete navigation assertions, a responsive-restyle timing assertion, Public displays overflow and a hidden setup shortcut. Repairs retain the original safety/reflow assertions.
- [x] Final affected browser run: **19 passed (5.4m)**, including all prior failures, every new subpage and changed form/focus routes in both themes. GitHub's e2e job reruns the complete suite on this revision.
- [x] npm run test:ui-quality: **8 passed (1.7m)** on the repaired build.
- [x] npm run ui:gallery: **40 screenshots captured**, no capture failures; representative state/theme/width families reviewed.
- [x] npm run check:views: **73 views documented; navigation coverage valid; sitemap current**. Catalog tests cover schema, graph, source/link/navigation drift and output freshness.
- [x] npm run check:source: code-line limits and locale parity passed, 2869 inputs / 226 translated keys.
- [x] npm run check:self-review -- --json: clean, no findings or approval exceptions; git diff --check: exit 0.
- [x] Impeccable detector: exit 0; one verified false positive for an unchanged unrounded chart-legend line. No suppression or weakened gate.

## UI evidence

reports/ui-gallery/gallery.html and index.json contain the final 40-capture gallery. reports/stabilization/operating-views/ covers all 16 routes in both themes and wide/narrow leaves; reports/stabilization-subpages/ covers every new local task page. The CI browser artifact retains these new capture families. The shared frame, form boundaries, selection/focus, task state, Public displays wrapping and preserved drafts were visually reviewed. No baseline was accepted or committed.

## Obsidian evidence

npm run -s dev:obsidian -- --json and npm run test:obsidian both exit 1 locally: obsidian-launcher 3.2.1 is not provisioned. Nothing was downloaded or launched. The three affected contained-native specs were adapted to the new navigation while preserving exact-note, reload-paused, no-external-example, safety and error assertions; syntax/source checks pass. The e2e label opts into the existing real-Obsidian CI job before merge.

## Untested scope

Live Twitch/OBS/Claude/Herdr sessions, production-vault scale and OS screen-reader behavior are unqualified locally. Browser examples are explicitly simulated. The local project suite retains the existing six Windows-skipped Unix fake-CLI tests; Linux CI exercises its platform-supported suite. Local Node is v24.20.0; .nvmrc/CI use v24.21.0. Generated UI-effects checks explicitly skip because this project declares no generated visual definitions.

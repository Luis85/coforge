# Task: Public streaming workspace, planned streams and AI cost visibility

- Status: in progress
- Base: PR #20 merged as 5628945; local/product/browser/real-Obsidian/GitGuardian checks passed.
- Traceability: owner requests and confirmed choices in BRIEF; generated requirement/vi-* arrays empty.

## Scope and acceptance

1. Safe Markdown: real Markdown parser, escaped Vue rendering, no HTML execution, vault embeds or automatic
   remote media; audit request cards/drawer, plans and other appropriate long-form fields. Source editors/logs/diffs stay literal.
2. `!context`: registered/unrestricted viewer, known open request ID across projects, durable append with author/time,
   event dedupe, bot acknowledgement, automatic screening reset and stale running-result rejection.
3. Four public read-only views: explicit whitelist projection, live Twitch-only chat, ribbon/popout controls,
   stable titles independent of vault/project identity, privacy protection when private content enters a capture window,
   owned cleanup and real-host tests. Document capture boundaries; never expose private host controls as an overlay.
4. AI analytics: per-feature/per-task USD, every attempt including failures, provider-reported cost captured before
   result interpretation, manual fallback for missing/Herdr costs, durable attribution and visible coverage gaps.
   No guessed prices, FX conversion, inferred subscription charge or double counting.
5. Schedule: canonical Markdown per planned stream; date/time and local timezone, project, Twitch metadata,
   OBS scenes and playlist. Create/edit/cancel, open script/topics/storyboard note, explicit preparation with
   independent checked application steps; no unattended live-channel changes, playback or go-live.
6. Fresh evidence-based product audit across streamer/operator/community/developer perspectives; concrete polish,
   keyboard/contrast/reflow/empty/error/recovery checks, privacy sentinels and bounded visual confirmation.
7. Full project gate, UI quality/gallery, contained-host lifecycle/popout tests, self-review, exact-head green CI and merge.
8. Private viewer CRM notes for registered and unregistered observed viewers, preserved human annotations,
   coalesced writes, private-note access from player management, and Git ignore protection plus tracked-data audit.
9. Independent left/right private studio panel collapse, accessible reopen controls, retained drafts and reclaimed space.
10. Move status indicators into the native Obsidian status bar; owned mount/unmount, no duplicates on reload,
    no embedded studio footer, and no private status data in capture windows.
11. Card context menu: right-click and keyboard access, state-aware actions and reasons, current-context guards,
    review-sensitive navigation/confirmation, and no action menus in public views.
12. Viewer-facing !help onboarding/topics, correct actor/currency vocabulary and bounded Twitch replies.
13. Per-project editable stage prompts, defaults/reset/assembled preview, canonical project-note persistence,
    correct dispatch composition and unchanged execution/output/review guards.

## Review constraints

- In-app browser controller failed to initialize (missing kernel assets). Repository-authorized headless browser
  checks and contained Obsidian CI are available; capture new review evidence after this increment is implemented.
- No live broadcast, Twitch write, real agent dispatch or personal vault is used for agent QA.
- No subagents: current instructions do not authorize delegation.

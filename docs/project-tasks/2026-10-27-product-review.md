# Streaming workspace product review

Scope: the current streaming-workspace increment, following the merged live-studio
foundation (PR #20). Source review and fresh browser evidence cover streamer flow,
viewer participation, privacy, accessibility, persistence, cost accounting and
maintenance. Generated requirement/interaction arrays are empty; acceptance is
recorded in BRIEF and the streaming-workspace task document.

## Evidence and walkthrough

The in-app browser controller could not initialize (missing kernel assets). This
review uses the repository-authorized headless browser journeys instead. Screenshots
are review evidence, never accepted baselines, and remain ignored under `reports/`.

| Step | Journey | Fresh screenshot / evidence |
| --- | --- | --- |
| 1 | Private board, right-click and keyboard actions | `reports/product-audit/board-desktop.png`; card-menu browser journey |
| 2 | Add viewer context, reopen request, inspect rendered emphasis/code | `reports/product-audit/request-context-markdown.png`; stale-result and append-only note tests |
| 3 | Collapse navigation/chat and preserve a draft; narrow board | `reports/product-audit/board-narrow-collapsed.png`; panel browser journey |
| 4 | Actual EUR income/expense and recurring plan maintenance | `reports/finance/light-1280.png`, `dark-360.png`; both theme journeys and axe |
| 5 | Inspect failed AI attempts and add missing Herdr usage | `reports/product-audit/ai-costs-desktop.png`; decimal arithmetic, archival and stale-edit tests |
| 6 | Save a local show plan, script and explicit preparation | `reports/product-audit/schedule-desktop.png`, `schedule-mobile.png`; note-preservation and prep-gate tests |
| 7 | Read-only public board/chat/recognition | `reports/product-audit/public-*.png`; public projection sentinel and capture-curtain tests |
| 8 | Project stage edits, preview, save/reset and navigation guard | prompt browser journey; frontmatter and restricted-argv tests |

Desktop AI costs and narrow schedule screenshots were inspected directly. Finance
was rechecked in both themes after the shared-spacing changes. Full gallery and native
CI evidence are recorded with the PR after the final gates finish.

## Findings and polishing pass

| Perspective | Finding | Improvement / verification |
| --- | --- | --- |
| Streamer | Finance lacked the same outer rhythm as other operating views | Shared page gutters, aligned finance filters/form rows, consistent section spacing and first-entry alignment; light/dark/narrow browser coverage |
| Streamer | Full chat → board navigation discarded an unsent message | Chat draft and testing mode moved into per-view store; regression checks draft retention through navigation and collapse |
| Streamer | Panel collapse needed a visible return path and actual reclaimed space | Labelled toggle buttons with expanded/controls state, preserved mounted panels, narrow board/chat mode; width and keyboard/browser assertions |
| Viewer | A command list alone did not explain participation | `!help` onboarding and concise topic replies using configured actor/currency names; registration rules include context |
| Viewer | New detail must not silently use an obsolete approved plan | Context appends with identity/time and reopens screening; request fingerprint rejects prior task results; original body and attribution retained |
| On-air privacy | Private project switches could unexpectedly change capture content | Public Kanban pins a project; explicit retarget action; frozen read-only source and sentinel tests |
| On-air privacy | Moderated text could remain on screen or return after late delivery | Subscribe to all three chat-clear/delete event types; remove retained text and retain bounded tombstones; actual bot echoes remain public without command loops |
| On-air privacy | A replacement pane or plugin stylesheet teardown could expose host UI | Capture curtain, stable title, independent adopted stylesheet and owned-window close on unload; native CI case exercises replacement and lifecycle |
| Accessibility | Card actions needed a keyboard route | Standard context menu plus explicit actions button; state-aware disabled reasons and review navigation; browser keyboard check |
| Accessibility | Manual cost editing needed predictable focus | Focus moves to the amount field and returns to the originating task after save/cancel; public/new-view axe checks and responsive table containment |
| Accounting | Failed result interpretation could lose reported usage; missing looked like zero | Capture usage before schema/result application, archive every attempt, exact decimal sums, explicit reported/manual/unavailable/simulation sources |
| Accounting | Growing cost history could mount an unbounded table | Filterable summaries, 50-attempt pages, retained history independent of operational pruning |
| Planning | A saved plan must not act as an unattended live-control command | Passive canonical note; reviewed revision required per preparation step; no playback/go-live from planning; stale/cancelled plan tests |
| CRM | One damaged note delayed other profiles; rename and recovery could fail | Serialized writes, atomic index replacement/retry, explicit refresh/re-index, failure rotation, coalescing and visible pending/saved counts |
| Persistence | A deleted ledger could appear as an empty history | Detect removal after observation; preserve unknown frontmatter/body and reject concurrent edits; canonical-note tests |
| Security | Rich text and note properties can trigger privileged rendering/plugins | Allowlisted Markdown nodes, no HTML/media/transclusion, note-property defanging, script-free public export and CSP-bound offline bootstrap |
| Developer | Prompt preview normalization differed from actual saved dispatch | Shared stage normalization used by preview and runner; sparse per-project overrides, defaults/reset; unchanged tool/schema/review gates |
| Developer | CRM growth amplified repeated recognition scans | Aggregate authored requests and unique voters once, then project profiles; existing recognition/public-board assertions remain authoritative |

Strengths preserved: project/request identity stays stable; notes remain canonical;
public views receive no private host capability; simulations are explicit; irreversible
review remains a streamer action; EUR cash and USD usage remain separate; failures
retain drafts and source data.

## Limits requiring real operator validation

Local Obsidian was not provisioned; the dev loop explicitly reported this and did
not download or launch a host. Native popout/status/note tests run through the
contained CI vault. A browser preview cannot prove OBS's platform-specific window
matching or audio capture. No personal vault, live broadcast, real Twitch mutation,
paid agent dispatch or actual music transmission is exercised by QA. OAuth/OBS/Herdr
integration contracts remain covered by simulated ports and existing test suites.
Previously discarded historical costs and anonymous video watchers are unavailable.
Ignore rules do not erase historical Git data.

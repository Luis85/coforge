# Channel work and shared visual foundations

- Status: in progress
- Journey in `BRIEF.md`: review every private/native/public surface; community recognition, private viewer management and operational recovery.

## Direction and composition

The owner selected an expressive studio. The shared theme now supplies accent, success, caution and information surfaces, stronger page titles, visibly selected local navigation, native focus, themed text selection and tabular figures. The existing 1440px frame, leaf-relative gutters and task-specific board/public/native boundaries remain explicit. No decorative animation delays work.

The complete catalog is partitioned into 33 Build surfaces, 30 stream/analytics/native/public surfaces, and the 10 surfaces reviewed here (including the shell).

## View coverage

| View ID | Redesign and next step |
| --- | --- |
| `studio` | One typed destination contract drives Stream, Build, Community and Insights. Scope-aware breadcrumbs distinguish channel, vault and selected-project work. Duplicate footer settings links are removed; the switcher owns Projects. |
| `community` | Larger contribution overview uses the same eligible all-project projection as the leaderboard. Ranking modes lead into contributor evidence. |
| `community-profile` | Selected contributor identity has a distinct outcome surface; recorded contribution facts precede request links. |
| `community-badges` | Earned recognition and locked progress have distinct visual treatment, with readable descriptions and recorded evidence. |
| `community-settings` | Explicit channel-wide configuration scope and saved/unsaved state. Environment, future earning rules and rank ladder remain separate forms with guarded drafts. |
| `population` | Observed and registered counts are distinct; the registration-gap shortcut applies a reversible filter and clears unrelated search. Currency circulation retains its configured name. |
| `viewer-detail` | Recorded stats, registration and presence facts precede participation/moderation controls. Private note access and exact-target confirmation retain their existing contracts. |
| `operations` | Historical unconfirmed events lead to an exact retained-log filter. The summary explicitly directs current recovery to the owning tool. Cumulative counters and log retention stay separate. |
| `activity` | The panel identifies cross-project activity and the request-opening action; events without a request remain informational. |
| `help` | The guide teaches the same four navigation families, then the ordered community-to-reviewed-increment journey. |

Native integration ownership also receives a responsive definition-list layout shared with the stream group's revised settings introduction. The native settings rows retain their native form vocabulary.

## Behavioral evidence

`studio-insights-ui.test.ts` first failed for both missing decision summaries, then passed with the implementation. Together with `population-ui.test.ts`: **2 test files, 4 tests passed**. The tests verify exact observed/registered counts, reversible registration filtering, historical uncertain-event filtering without replay, explicit moderation confirmation, and guarded invalid community-settings drafts.

The shared frame's incumbent render pass captured all 16 destinations, both wide and narrow: **16 tests passed (3.7m)**. Final integrated render, accessibility, project and host evidence belongs in the parent task report.

## Improvement and polishing

- Move viewer statistics ahead of destructive controls so inspection leads moderation.
- Count historical uncertainty only in the retained log; never imply it is a current unresolved incident queue.
- Provide one visible Clear viewer filters action per result state.
- Keep selected state visually distinct from keyboard focus, and keep summary text legible against semantic surfaces.
- Preserve exact data scopes, safe diagnostic exports and public/private projection boundaries.

## Limits

No personal vault, live Twitch account, external agent session or real OBS output was used. Local Obsidian is not provisioned; native qualification is delegated to the repository's existing CI job. Screenshot evidence alone does not establish assistive-technology compatibility.

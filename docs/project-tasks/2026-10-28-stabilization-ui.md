# Stabilization: shared UI, accessibility and layout review

- Status: UI implementation, independent review and final visual confirmation complete; executed test results recorded by the root task
- Scope: all 16 private operating destinations, shared controls and page seams; the journey review covers the view inventory and task boundaries.
- Baseline: 64 screenshots plus computed metrics in `reports/stabilization/before-views/` (16 destinations, light/dark, 1280/480px leaves inside an 1800px desktop).
- Current evidence: `tests/e2e/journeys/stabilization-layout.spec.ts` writes `reports/stabilization/operating-views/` and performs Axe WCAG 2.1 A/AA scans for each route/theme/leaf width.

## Findings and implemented fixes

| Finding | Evidence | Resolution |
| --- | --- | --- |
| P2: Council begins flush against the workspace edges; its spacing disappears in the preview. | `before-views/council-light-1280.png`, `metrics.json`: all four padding values are `0px`; Council used raw native spacing variables unavailable in this preview. | Shared CoForge spacing aliases resolve the accepted design-system tokens, with native token fallback. Council now uses the same operating-page frame. |
| P2: Chat, Community settings and Workflow settings use different gutters and container widths from the other operating pages. | Baseline metrics: narrow gutters 14, 18 and 20px; wide max-widths range from 1100–1480px or none. | One shared frame owns page top/side/bottom spacing, maximum width and centering for all 15 standard operating destinations. The board keeps its full-width Kanban canvas. |
| P2: Council definition layout responds to desktop viewport size instead of the Obsidian leaf size. | Failing regression: at a 480px leaf in an 1800px desktop, expected one grid column, received two. | Use the existing named `plugin-shell-leaf` container query for Council fields/editor. AI cost filters and summary now use that same responsive seam. |
| P2: Unqualified `cf-btn` controls render as bold text without the shared secondary-button affordance. | `before-views/ai-costs-dark-480.png`, `schedule-dark-480.png`. | Bare buttons receive the normal theme surface/border and hover treatment. Explicit primary, secondary, ghost and danger variants retain their roles. |
| P2: Editable project fields appear as floating text, while finance fields have visible surfaces/borders. | `before-views/settings-light-1280.png` compared with populated finance controls. | Shared `cf-field` inputs/selects/textareas receive the same themed surface, border, radius and text color. Specialized composers and native settings rows retain their own controls. |
| P2: AI task button visibly says “Add cost” but its accessible name begins “Edit cost”. | Populated AI cost Axe scan fails `label-content-name-mismatch`. | Accessible name now begins with the visible Add/Edit action, followed by the stable feature/task context. Existing browser expectations updated. |
| P2: New task subpages require a consistent navigation seam. | Journey review splits stream operations and Council configuration/monitoring. | Shared `CfSubpageNav` receives a wrapping, theme-aware navigation seam, current-page indicator and native visible keyboard focus. Subpage panels share one section-gap rhythm. |

## Review by perspective

- Product and UX: preserve the Obsidian studio vocabulary; each standard destination has an explanatory heading and a consistent arrival seam. Stream tools and Council goals are separated by the journey work. A board and a read-only capture are intentionally different canvases.
- Accessibility: real browser scans cover rendered private destinations, including populated Council, finance, schedule and AI costs. Leaf reflow is checked independently of viewport width. This is automated WCAG evidence, not a screen-reader certification.
- Theme and visual craft: foregrounds, surfaces, borders, accent and form controls continue to inherit Obsidian theme colors. Spacing aliases use the existing accepted design-system scale. No new palette, decorative animation or font introduced.
- Reliability and privacy: these changes affect presentation and accessible names. Definitions, worker permissions, data persistence and public projection boundaries are unchanged. Live services are unavailable in the browser examples and remain explicitly labelled.
- Performance: the new frame uses CSS container queries and shared rules; it adds no resize observer or layout-reading runtime loop. The browser contract reads geometry only in tests. Native startup/lifecycle performance remains outside this visual evidence.
- Maintenance: the operating frame and subpage seam are centralized in `page-shell.css`, rather than copied for each new feature. A regression checks standard gutters/widths and populated Council/cost reflow, so future viewport-based drift fails visibly.

## Verification

- Before implementation: `npx playwright test tests/e2e/journeys/stabilization-layout.spec.ts --grep 'Council definition editor'` failed as intended, expected 1 column and received 2.
- Initial full matrix: 29 passed, 4 failed in 8.3 minutes. Two failures identify the AI-cost accessible-name mismatch; two use the old “Studio settings” navigation label while the shared build already uses “Project settings”. Both source/test corrections are in the final diff. Final `npm run test:e2e` must verify them against the rebuilt preview.
- A batched screenshot inspection confirmed the Council frame, narrow editor stacking and shared subpage seam. It also caught the generated preview's `[aria-current="page"]` outline being mistaken for keyboard focus; the final shared subpage rule separates underline selection from `:focus-visible` outline, with a keyboard regression.
- `npm run check:source` initially stopped at a concurrent root-owned change (`council-module.ts: 403/400`); root owns the repair and final check. The UI-owned CSS files remain below 400 code lines.
- Root records full project gates, gallery review, detector results and native-host limitations in the stabilization task and PR.

## Evidence limits

The screenshots are the source-backed synthetic browser preview. No live Twitch, OBS, Claude or Herdr session is exercised. Native Obsidian rendering and OS accessibility integration require provisioned host tooling; browser scans cannot establish those properties. The baseline covers default/empty states; populated forms are covered by the browser contract and existing Council/workflow/finance journey tests.

## Independent product/documentation polish

The final page catalog was cross-read against the changed source. The Twitch channel editor moved to Stream chat → Twitch settings, but its first catalog draft still belonged to Stream studio → Setup. The catalog owner was asked to correct the parent, route and entry point. Panel entry text must describe inline content rather than imply a clickable page that does not exist. These corrections make the generated sitemap reflect the shipped journey, not the pre-stabilization composition.

## Final confirmation pass

The root's final full browser run owns the server and rebuilt preview. Fresh final-build captures were inspected in one confirmation pass:

- `reports/council/definitions-light-1280.png`, `definitions-dark-360.png`, `preflight-light-360.png`, `monitor-dark-1280.png`, `workflow-light-1280.png`, `workflow-message-dark-360.png`: field boundaries are clear; long forms stack inside a narrow leaf; the current subpage uses an underline while the active textarea retains its separate focus ring. Preflight, simulation, completed contribution and explicit execution controls remain distinct.
- `reports/finance/light-1280.png` and `dark-360.png`: shared controls remain consistent through actual/recurring entry states, totals and row actions. The narrow layout stacks the editor above the ledger without hiding the save action.
- `reports/guided-setup/tools-dark-360.png`: the optional setup flow, current step, disabled native action and primary next step remain readable and distinct.
- `reports/live-studio-scenes/editor-light-1280.png` and `editor-dark-360.png`: scene selection remains separate from taking a scene live; forms and source controls stack with readable native action affordances.
- `reports/herdr-workflow/configured-dark-360.png`: provider/model controls, restrictive access contract, spending limitation and unavailable connection are presented as separate facts; prompts remain editable source text.

No additional blocking visual issue was found in those listed captures. The remaining complete operating-frame/subpage captures are reviewed as the same full run produces them; its executed result is recorded by the root task. No screenshot-baseline update was made. The documented Twitch editor parent and entry have also been rechecked and corrected to Stream chat → Twitch settings.

The refreshed operating matrix subsequently exposed two existing form wrappers outside `cf-field`: the schedule editor and AI-cost filters still rendered unframed controls in light mode. The shared control-surface rule now explicitly covers those wrappers, with a border-affordance assertion in their browser cases. Specialized board search and chat composer rules remain separate. A timing-only frame assertion was also changed to poll the same exact expected dimensions after leaf resize, allowing Chromium's container query restyle to settle; no threshold was weakened. These two affected routes and the timed assertion require the root's final affected rerun.

The same final screenshot batch showed the native preview's current-page outline still applying to the sidebar's bottom Project/Community settings items, because the existing reset covered only items inside `nav`. The existing selection/focus seam now covers every sidebar item; the browser regression checks Project settings selection without an outline and a separate visible keyboard focus indicator. Final confirmation of this narrow fix belongs to the root's affected rerun as well.

The all-subpage reflow test found a persistent Public displays overflow at 360px. Its failure screenshot shows the long “Show selected project on stream Kanban” button imposing its nonwrapping minimum width on the grid item and cropping the explanatory paragraphs. The displays panel now has `min-width: 0`; its existing buttons are constrained to the panel width and wrap. The strict subpage overflow assertion remains unchanged and must pass in the affected rerun.

The final Team messages capture exposed an inline standalone label/textarea outside the field primitive, leaving the label at the textarea's baseline and the empty editor unframed. `CouncilMessages` now wraps the same visible label and draft-bound textarea in `cf-field` and uses the existing Council section gap for the form. This also removes its unnecessary fixed DOM ID, so multiple plugin leaves do not share that label target. Message behavior and available actions are unchanged.

The one requested Impeccable mechanical detector pass returned a single warning at
`statistics.css`'s `.cf-series-mark` (`border-top: 3px solid`). Source inspection
confirmed this is an unchanged, unrounded chart-legend line encoding series style,
not an accent border on a rounded card. It is a false positive; the solid/dashed/
dotted line affordance is intentionally retained. The detector exited 0. This
does not replace the rendered gallery and interaction review.

## Final affected-build verdict

The final affected build's regenerated captures confirm the fixes. Public displays at light/360px wraps its long project button and explanatory paragraphs without cropping; dark/1280px retains the two-column display list. The History dark/360px, Chat light/1280px, Twitch settings dark/360px, Bot messages light/360px, Herdr workspaces dark/360px and Workflow runs light/1280px subpages were inspected in `reports/stabilization-subpages/`. Each presents its own task, a visible current-page/focus state and an actionable native-unavailable or empty state. The repaired setup location link is covered by the root's affected browser run.

The refreshed `operating-views/schedule-light-1280.png` and `ai-costs-dark-480.png` show the shared bordered controls; `settings-light-480.png` shows current selection without a false keyboard-focus outline. Representative final `reports/ui-gallery/` Studio and native-settings preview captures were inspected across light/dark, 1280/360px and the generated default/loading/empty/error/disabled families. The gallery records its declared variants; the custom Studio shares an initial read model across those variant labels, so actual recovery-state behavior is established by journey tests rather than inferred from gallery labels.

Scoped verdict: no functional or visual blocker remains in the inspected stabilized views and subpages. No further cosmetic change was made after this confirmation. Shipping still requires the root's recorded green project/affected-browser checks and explicit disclosure of the unprovisioned native host and untested live external integrations.

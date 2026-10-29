# Studio redesign: bounded visual review

- Date: 2026-10-28
- Reviewer scope: private frame and Build families.
- Evidence: 28 saved screenshots from the current task's regenerated operating-view run,
  under `reports/stabilization/operating-views/`. Every image listed below was opened and inspected.
- Variants: light/dark themes, 1280px/480px leaves inside the desktop harness.
- Timing: these captures predate the new cleanup panel and the final board-grid/span and workflow-action
  placement corrections. They establish the findings; the root task owns the single confirmation batch.

## Concrete findings and bounded polish

1. **Adjacent board cards overlap on the wide leaf.** In
   [board-light-1280.png](../../reports/stabilization/operating-views/board-light-1280.png) and its dark
   counterpart, the Inbox and Up next card edges cross their gutters. The new 210px child-column minimum
   in `build-workspace.css` exceeded the existing grid tracks, which can be 190px or 205px. The child and
   track minima must agree. The Build owner corrected this in the source for the confirmation batch.
2. **The workflow's primary request action appears too late on the narrow leaf.** In
   [workflow-light-480.png](../../reports/stabilization/operating-views/workflow-light-480.png) and its
   dark counterpart, Start · Screen appears below all four captured steps, around y1290. The selected
   request is already visible much earlier. With root authorization, the existing manual-decision,
   blocked/error and next-step/review/restart action block was moved before Captured workflow steps in
   `ConfiguredWorkflowExecution.vue`. Conditions, handlers, labels and manual-step keys are unchanged;
   controls are not duplicated. `git diff --check` for this move passed. Execution tests and the final
   image confirmation belong to the root qualification pass.
3. **Desktop decision icons occupied unintended full-width grid rows.** The captured board summary
   shows icons and arrows on separate rows. The broad `span` selector also matched `CfIcon`'s rendered
   spans. Root already narrowed that selector in source. The confirmation batch should show compact,
   aligned decision rows and recover some board height.

No additional clipping, overlapping controls or unreadable primary labels were found in these inspected
variants. The long configuration forms and Council catalogue remain scrollable task surfaces; that
length alone is not a defect. No additional styling changes were made by this reviewer.

## Inspected surfaces

Every row covers all four files named `{surface}-{light|dark}-{1280|480}.png`.

| Surface | Visual health and task support |
| --- | --- |
| studio | Channel workspace scope is clear on wide leaves. Native-only broadcast controls are disabled honestly in the harness. Local subpages wrap within the narrow leaf; live metrics show unavailable sources instead of invented zeroes. |
| board | New request remains findable, review/moderation counts have explicit labels, and the private chat is separated from the backlog. The two grid findings above need confirmation. At 480px the first cards remain visible near the bottom of a 1000px viewport; the stacked context/decision area is tall but operable. |
| workflow | Project identity, request automation state, request selection and captured steps are legible in both themes. The existing primary action was moved earlier as described above. |
| workflow-settings | Step selection and the field editor form a clear two-column workspace on wide leaves and a single-column sequence on narrow leaves. Provider/model help and explicit save semantics remain visible. The step list scrolls independently when needed. |
| council | Vault scope and selected-project context are distinct. Definitions, intake, monitoring and storage tasks remain separate local pages. The prerequisite callout offers its actual Run monitor action; the catalogue and empty editor guidance are clear. Narrow subpage labels wrap without clipping. |
| projects | Stable project IDs, selected state, backlog/review counts and Open board are distinct. Add project remains the page action. The narrow project row wraps its controls inside its surface; the switcher carries the current-page indication. |
| settings | Project brief, workspace boundaries, workflow navigation, runtime checks and backup tools form distinct sections. Narrow labels/help and controls stay inside their pane. The backup action explicitly names its private studio-wide scope. These captures do not contain the later cleanup panel. |

## Shared-frame observations

Stream, Build, Community and Insights groups are readable in the wide frame. The compact sidebar keeps
one consistent icon column, section separators and a reachable help control. Current-page accents are
visually distinct from ordinary hover backgrounds. The top bar keeps destination labels and copyable
project IDs within narrow leaves; channel and vault scope text is visually reduced while preserved for
assistive technology.

Project context appears deliberately on project work, while Channel workspace and Vault workspace
pages avoid a misleading selected-project breadcrumb. The request automation badge is explicit enough
to distinguish it from Council executor state. Purposeful accent surfaces support the owner's more
expressive direction without giving disabled or unavailable controls an enabled appearance.

## Evidence limits

These are browser-harness captures, not evidence of a live Twitch/OBS/Herdr/Claude session or a personal
vault. Screenshot inspection cannot establish keyboard behavior or accessibility compliance; the
separate Playwright/Axe and contained-host checks supply that evidence. The new cleanup preview requires
its own final UI capture and tests. No server or extra test suite was started for this review.

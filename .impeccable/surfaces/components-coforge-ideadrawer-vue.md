---
version: 1
slug: "components-coforge-ideadrawer-vue"
primary_target: "src/plugin/presentation/components/coforge/IdeaDrawer.vue"
related_targets:
  - "src/plugin/presentation/components/coforge/ReadableContent.vue"
  - "src/plugin/presentation/components/coforge/IdeaDrawerHeader.vue"
  - "src/plugin/presentation/components/coforge/IdeaSectionNavigation.vue"
  - "src/plugin/presentation/components/coforge/IdeaOverviewTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaWorkflowTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaPlanTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaIncrementTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaSessionsTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaAICostsTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaActivityTab.vue"
  - "src/plugin/presentation/components/coforge/IdeaReviewActions.vue"
  - "src/plugin/presentation/composables/coforge/idea-sections.ts"
  - "src/plugin/presentation/composables/coforge/use-idea-drawer.ts"
  - "src/plugin/presentation/composables/coforge/use-dialog-focus.ts"
  - "src/plugin/styles/coforge/idea-drawer.css"
  - "src/plugin/styles/coforge/idea-sessions.css"
  - "src/plugin/styles/coforge/idea-ai-costs.css"
---

# Request details surface

Mode: Operate. Extend the inherited CoForge studio system across all seven request
sections. Product authority is BRIEF.md; visual authority is DESIGN.md. This
contract records local information architecture and interaction decisions only.

## Direction contract

THESIS: Make one request's next valid action clear through a stable workspace,
with evidence preceding its final review decision.

OWN-WORLD: Inherit native interface typography, Obsidian theme colors, quiet
neutral reading surfaces, accent selection, semantic status text and shared
studio controls. Keep the existing component and icon language. No replacement
palette, font, imagery or decorative material is introduced.

STORY: Understand the original request, follow its captured workflow, read saved
specifications, inspect changes and verification, then decide. Sessions observes;
AI costs explains retained usage and coverage; Activity holds conversations and
recovery before the timeline. Navigation never dispatches work.

FIRST VIEWPORT: Compact request identity sits above a consistent drawer capped at
1040px. A 190px section column precedes one purpose-led reading pane. At leaf
widths of 700px or less, section buttons wrap above it. The current workflow
precedes improvement passes; Increment starts with changes and places its final
review form after evidence.

FORM: Code-led extension of the incumbent modal drawer. Keep stable section IDs
in lifecycle order: Overview, Workflow runs, Plan & Design, Increment, Sessions,
AI costs, Activity. One workspace replaces per-section width changes; no new
visual-world selection or raster concept is required for this inherited system.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

No raster assets ship. DESIGN.md remains unchanged as the inherited authority.
Qualification and the final verdict belong to the request-detail task record;
this documentation does not certify pending checks.

## Interaction contract

Captured agent content is a reading task. Present structured JSON with labelled
fields and lists, Markdown with the existing safe renderer, and exact retained
source behind a keyboard-accessible disclosure. Announce incomplete or shortened
reading previews; never guess missing content. Keep tool commands and diffs as
code. Share this treatment across Activity, Sessions, Council and workflow outputs.

- Overview leads with Original request and keeps its unsaved edits through
  section navigation using a request-keyed kept-alive component. Closing or
  changing requests is outside that draft-retention guarantee.
- Plan and Design have independent saved/missing states and retain provenance;
  planned acceptance criteria do not imply executed verification.
- Increment orders summary, files/diff, verification and criteria before collapsed
  assessments. The explicit final review follows in the same reading scroll;
  Overview, Plan & Design and Activity route to it through Review increment.
- A missing required review note has an adjacent alert associated with its field
  using `aria-invalid` and `aria-describedby`. Service eligibility and review
  requirements stay authoritative.
- Section changes reset the content scroll without moving focus from navigation.
  Visible native disclosure summaries participate in the focus trap; hidden
  disclosure controls do not. Escape closes and focus returns to the opener.
- Sessions and AI costs remain read-only. Preserve unknown, simulated, reported,
  observed and verified distinctions, private transcripts and recovery holds.

## Implementation evidence and limits

Current source establishes the layout dimensions, section purposes, explicit
review handoff, kept-alive Overview, scroll reset and focus filtering. The current
synthetic captures in `reports/request-panel/after/` show all seven sections in
light/dark themes at wide and narrow sizes, plus the Increment decision position.
They demonstrate presentation with synthetic data; empty Sessions and host-required
AI costs do not establish populated native behavior or ledger coverage. Native
qualification, review-note error recapture and final review status are recorded in
`docs/project-tasks/2026-11-01-request-detail-overhaul.md`.

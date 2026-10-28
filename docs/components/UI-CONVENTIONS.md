# CoForge view composition

Use the [view contracts](sitemap.md) to find a surface by user goal before adding
another destination. A page owns a leading task; a focused subpage separates a
different task without adding another global sidebar item. Inline task panels
remain children of their owning page and do not imply host tabs.

## Frame and spacing

[`page-shell.css`](../../src/plugin/styles/coforge/page-shell.css) owns the
standard operating-page frame: 1440px maximum width, centered content, and shared
page top/gutter/bottom spacing. At a leaf width of 600px or less it uses the same
narrow frame for each standard page. Respond to the named `plugin-shell-leaf`
container, not the desktop viewport: an Obsidian pane can be narrow inside a wide
window. Avoid repeating root padding and maximum widths in a view's stylesheet.

[`base.css`](../../src/plugin/styles/coforge/base.css) maps CoForge spacing and
semantic colors to the accepted design system and native Obsidian theme. Use
`--cf-space-*` for shared grouping, `--cf-page-*` for the frame, and native theme
colors for text, borders, surfaces and status. View-specific grids still express
the task: a Kanban board, editable workflow and recorded-stream chart need
different internal layouts.

The idea board retains a full-width workspace canvas and independently collapsible
chat. Native integration settings use Obsidian's settings container and settings
rows. Public capture views use the stream display shell and public projection.
These are deliberate surface boundaries, not copies of the operating-page frame.

## Heading, navigation and controls

- Use `cf-page-heading` for the view's title, concise purpose and relevant actions.
- Use [`CfSubpageNav`](../../src/plugin/presentation/components/coforge/CfSubpageNav.vue)
  with the shared `studio-pages.ts` constants for task subpages. It is a labelled
  navigation landmark with native buttons and one current page. Tab, Enter and
  Space retain their native behavior; do not apply tablist roles without the
  corresponding keyboard contract.
- Use `cf-subpage-panel` for shared section gaps. Preserve mounted models when
  switching subpages would otherwise lose a draft; store-backed drafts can also
  survive component recreation. Navigation itself never saves or dispatches work.
- Use `cf-field` for a labelled input/select/textarea with help text. Native settings
  use `PluginSettingsRow`. A new inline form should not create an unframed control
  style when an existing form primitive expresses the same role.
- Use `cf-btn-primary`, `cf-btn-secondary`, `cf-btn-ghost` and `cf-btn-danger` for
  action priority. Wrap long action labels inside narrow panels. Selection indicators
  and `:focus-visible` outlines represent different states.

## State and action ownership

Vue scripts bind typed composables; composables and per-leaf stores own behavior.
Shared page models use typed injection when child forms must edit the same draft,
as Broadcast setup does. Do not mutate a model received as a prop. Service calls,
vault writes and external effects stay behind existing application/host contracts.

Sidebar navigation may restore the last local page. A shortcut naming a specific
task must select that task through the guarded store helpers (`openStreamTool`,
`openWorkflowTool`), so a retained settings/admin page does not hide the promised
destination. A blocked dirty-configuration transition must preserve both the
current page and draft.

Show the relevant empty, pending, unavailable, error and completion states in the
owning surface. When a primary action needs a prerequisite elsewhere, explain it
and provide a working route, as Council admission does for executor designation.
Keep execution controls, external-effect confirmation and unknown-outcome recovery
explicit. Read-only public roots never receive private studio host capabilities.

## Verification

`stabilization-layout.spec.ts` checks the actual shared frame, control affordances,
focus, Axe scans and reflow across all 16 routes, two themes and wide/narrow leaves.
`stabilization-subpages.spec.ts` exercises every local task page with keyboard
activation and captures. The broader journey suite verifies the corresponding
effects and recovery boundaries. Screenshots are review evidence, not baselines.

Keep the one canonical view document current, run `npm run docs:views`, and require
`npm run check:views` plus the project's normal qualification gates before merging.

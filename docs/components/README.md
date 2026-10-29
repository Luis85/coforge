# Views and navigation

The [information architecture](INFORMATION-ARCHITECTURE.md) explains the
Build & Improve, Stream, Community and Insights task families, project versus channel scope, and
the boundary between global destinations and focused local tasks.

The [generated sitemap](sitemap.md) describes every shipped product destination,
local subpage, task panel, dialog, native settings surface and public capture.
[sitemap.json](sitemap.json) provides the same contracts for tools.

The [UI composition conventions](UI-CONVENTIONS.md) describe the shared frame,
navigation, controls, state ownership and intentional surface boundaries.

Each view has exactly one authored frontmatter-plus-Markdown file in [views/](views/).
The file describes one user goal, entry points, available actions, states, privacy
boundary and journey tags, with a link to its implementation. A view's children
support the parent goal; navigation subpages separate distinct tasks.

Routes are local state locators, not browser URLs or Obsidian deep links. A panel
or dialog is documented independently when it owns a focused task, but this does
not give it an independent host tab. Reusable headings, cards, charts, fields,
list renderers, framework authoring scaffolds and layout wrappers are components,
not additional product destinations. `StudioApp` and `PluginSettings` are the two
generated product entry screens. `StreamSurfaceView` is the shared wrapper of the
four separately documented public captures.

## Updating a view

1. Edit its one file under `views/`; keep `id` and filename equal.
2. Set `parent` to a quoted vault link such as `"[[docs/components/views/studio]]"`,
   or `null` for an independent entry. The reader normalizes links to stable IDs
   for the generated sitemap and checks route ownership against source contracts.
3. Link the actual `component`; describe the goal and observable completion.
4. Preserve a `coverage` mapping for each root route or local navigation state.
   When one view has both a local state and a compatibility locator, use an array
   of mappings in that same canonical document rather than adding another view.
5. Regenerate and check:

```sh
npm run docs:views
npm run check:views
npm test -- src/plugin/tests/project/coforge/view-catalog.test.mjs
```

The underlying CLI also accepts `node tooling/coforge/view-catalog.mjs` and
`node tooling/coforge/view-catalog.mjs --check`.

The generator reads all source documents in a deterministic order. It rejects
missing fields, missing component files, broken local Markdown links, duplicate
IDs/routes, missing parents and parent cycles. Coverage reads `StudioView`,
`IdeaDrawerTab`, the shared local page constants and the public surface registry;
missing, stale or duplicate route mappings fail. An unreadable or empty navigation
contract fails rather than silently reducing coverage.

## Frontmatter contract

| Field | Meaning |
| --- | --- |
| `id`, `title` | Stable filename identity and user-facing name. |
| `goal` | The one outcome this surface helps the user achieve. |
| `audience` | Private streamer or public viewer/capture audience. |
| `kind` | `shell`, `page`, `subpage`, `panel`, `dialog`, `native` or `public`. |
| `route` | Unique local state or host entry locator. |
| `parent` | Clickable vault link to the owning view, or `null`; generated tools receive its stable ID. |
| `component` | Existing repository-relative implementation path. |
| `entry`, `actions`, `states` | Nonempty lists of entry points, actions and meaningful states. |
| `journeys` | Tags connecting the surface to the product journey review. |
| `privacy` | What may be visible and the boundary to public data. |
| `coverage` | Optional `{ group, key }` mapping, or array of mappings, to live navigation contracts. |

Markdown carries the purpose, entry and next action, state/recovery behavior and
composition boundary. This is documentation of implemented behavior, not a claim
that every native integration has been tested. Verification evidence and remaining
limits belong in the stabilization task report and PR.

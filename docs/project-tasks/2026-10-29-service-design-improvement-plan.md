# Service Design improvement and polishing plan

- Status: in progress
- Owner journey: [Service Design](../../BRIEF.md#service-design-owner-decisions-2026-10-29)
- Scope: the new Service Design increment and its integration into the private studio.
- Delivery owner: primary agent, with independent persistence, end-to-end and product-review subagents.

## Intended outcome

A project owner can describe a service, map its delivery across a customer journey,
identify weak points and improvements, and reopen the resulting notes in Obsidian.
The grid and the notes describe the same saved service. Editing, switching projects,
refreshing and changing storage folders preserve the owner's work.

The confirmed increment has one blueprint per project, ordered journey steps,
five core layers, and linked actor/role, touchpoint/channel, system, pain-point and
opportunity notes. Research informs presentation and recovery; it does not expand
the owner's entity model or introduce new automation.

## Research and implications

- A blueprint connects the customer's journey to visible and hidden service delivery.
  Its boundaries distinguish customer interaction, customer visibility and internal
  support. Show the five named lanes and the three named boundaries, so the grid
  communicates the method rather than presenting an arbitrary matrix.
  [NN/g: Service Blueprints — Definition](https://www.nngroup.com/articles/service-blueprints-definition/).
- Map an end-to-end service using actual customer, frontline and support knowledge;
  inspect handoffs and trouble spots. The editor should make it easy to link actions,
  systems and people, then record pain points and opportunities.
  [18F: Service blueprint](https://guides.18f.org/methods/decide/service-blueprint/).
- Clarify the scenario, customer and goal before mapping; analyze the resulting map
  for redundant work and opportunities. Offer short Markdown prompts in the existing
  blueprint editor instead of adding mandatory fields. The owner can record whether
  the map describes an existing or proposed service in that same note.
  [NN/g: Service Blueprinting — A Digital Template](https://www.nngroup.com/articles/service-blueprinting-template/).
- Programmatically associated row and column headers let assistive technology retain
  cell context. Use a semantic data table with a caption, scoped headers, ordinary
  buttons and a labelled scroll region; a custom ARIA grid is unnecessary.
  [W3C WAI: Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- Obsidian properties support literal YAML values and quoted internal links,
  including lists of links. Store identities and relationship fields as frontmatter
  and authored detail as Markdown; preserve unrelated note data during metadata edits.
  [Obsidian Help: Properties](https://obsidian.md/help/properties).

## Increment 1 — Reach and understand the service map

Priority: release requirement. Owner: primary implementation agent.

- Add a project-scoped Service Design main-navigation destination under Build & Improve.
- Explain the empty journey: describe the service, add ordered journey steps, then map
  evidence, customer actions, frontstage actions, backstage actions and support processes.
- Present one blueprint grid whose columns follow saved step order. Name the line of
  interaction, line of visibility and line of internal interaction at the correct boundaries.
- Keep title, current project selection and next action clear without repeating the
  project-work banner removed by the owner. Use existing studio tokens and controls.
- Give native-unavailable, no-project, no-blueprint, no-step, loading, invalid-note,
  validation, conflict and no-search-match states a concrete next action.

Acceptance: navigation reaches the selected project's blueprint; every layer can be
created from an explicitly named grid cell; an empty map explains its next step.
Evidence: component behavior tests, wide/narrow light/dark captures and contained host.

## Increment 2 — Create, connect and refine every approved entity

Priority: release requirement. Owners: primary agent and end-to-end test subagent.

- Create and edit all approved note kinds. Existing kinds and stable identities do not
  change when a title, Markdown description, relationship or order changes.
- Require a journey step for the five grid layers; allow reusable supporting entities
  at blueprint scope or associated with a step.
- Offer related entities from the same project and blueprint only, with readable names
  and kind context. Keep an inventory for supporting entities that do not occupy a grid lane.
- Surface notes from the grid and inventory, and provide an explicit Open note action.
- Preserve separate project drafts across navigation and selection. Confirm replacement
  before an unsaved draft is overwritten; keep drafts after failed writes and Refresh.
- Capture the project and submitted draft for async saves. Disable editing during save,
  or preserve any edits made after submission rather than replacing them with the result.

Acceptance: create blueprint → step → action → linked actor/system → pain point →
opportunity; edit and reorder without changing identity; switch away/back without
losing a draft. A rejected save changes no canonical note and retains its draft.
Evidence: service and UI tests plus real-Obsidian create/edit/reload journey.

## Increment 3 — Make canonical note persistence dependable

Priority: release requirement. Owner: persistence-hardening subagent.

- Use a versioned typed frontmatter schema and one Markdown note per blueprint/entity.
- Reject duplicate blueprints, duplicate IDs, malformed owned notes, unknown references,
  self-links and links across project/blueprint ownership before writing.
- Load without mutating canonical notes. Reject stale editor revisions and compare exact
  previous bytes inside the atomic host write, including edits made after the last load.
- Preserve unrelated YAML properties and exact Markdown body bytes during metadata edits.
- Make failures recoverable without falling back to sample data or replacing invalid notes.
- Configure a vault-relative root with retained folder history. Existing notes stay in
  place and remain discoverable after a root change and after plugin reload.
- Preserve existing settings if they cannot be parsed; reject escaping, hidden, reserved,
  overlapping managed and public-export paths. Bound collection size and link counts.

Acceptance: exact-note assertions cover wikilinks, unknown properties and CRLF body;
stale and concurrent writes preserve the newer note; root changes preserve old and new
notes; corrupt settings survive a rejected update unchanged.
Evidence: focused in-memory host tests, service tests and contained host reload.

## Increment 4 — Protect privacy and integration boundaries

Priority: release requirement. Owners: persistence subagent and primary agent.

- Keep Service Design out of public viewer projections and capture surfaces.
- Register current and retained private roots with public-folder overlap checks and
  managed-note restrictions. Validate these roots before publication can start.
- Protect custom private roots from accidental Git publication while preserving existing
  ignore rules. Do not claim that ignores revoke already published content.
- Keep domain/application code framework-free, host operations behind ports, behavior in
  composables and per-view state in stores. Do not introduce global singletons.
- Keep runtime and test files within repository line limits. Log no note content or raw causes.

Acceptance: public-folder overlap is rejected for default and custom retained roots;
ordinary agent note-authoring cannot bypass managed Service Design note ownership;
public rendering receives no new private records.
Evidence: folder-policy and integration regressions, source review and required gates.

## Increment 5 — Accessibility, pane behavior and performance

Priority: release requirement. Owners: primary agent and independent product reviewer.

- Give the table a caption, row/column associations and contextual add/select names.
- Use labelled fields, explicit save status and actionable error announcements.
- Keep keyboard focus visible; move it predictably when opening or replacing an editor.
- Preserve usable controls in narrow Obsidian panes; scroll the map horizontally inside
  its labelled region, and stack the editor without widening the whole workspace.
- Check long titles, large Markdown, an empty map, multiple entries in a cell, many steps
  and no matching inventory results in both native themes.
- Avoid automatic writes or provider work on navigation. Bound vault scanning and avoid
  redundant full loads while the same action is busy.

Acceptance: keyboard-only create/edit path works; every control has a useful name;
wide and narrow captures show no clipped controls or workspace-level horizontal overflow.
Evidence: semantic component assertions, UI-quality checks and screenshot review.

## Increment 6 — Independent closeout and delivery

Priority: release requirement. Owner: primary orchestrator.

1. Compare the complete implementation to each acceptance item above. Record findings,
   assign fixes to the owning agent and rerun affected behavioral checks.
2. Review product usefulness, UX, accessibility, data integrity, privacy, reliability,
   performance and maintenance using the completed UI and canonical-note evidence.
3. Run `npm run verify:project` (includes `npm run check`), `npm run test:ui-quality`,
   `npm run ui:gallery`, and the contained Obsidian dev loop. Run `npm run test:obsidian`
   for lifecycle/host-API changes. State any environmental limitation explicitly.
4. Review gallery and host screenshots. Keep generated reports and sandbox files untracked.
5. Run the self-review skill. Fill the PR template with real output, UI/host evidence,
   traceability and untested scope; update this plan with observed results.
6. Open and attach the PR. Inspect CI, resolve failures and merge only after required
   checks are green and review findings are closed. Do not force-push or publish a release.

## Evidence and completion tracking

Implementation and focused review are complete for the captured scope; delivery
remains in progress. The primary task and PR template record exact command output.
The imported design has no requirement or interaction entries; no generated
traceability file is edited.

The implemented page provides the five core lanes and three service boundaries,
all approved supporting kinds, canonical note opening, Markdown preview, searchable
relationships and related-entity exploration. Separate project drafts, explicit
replacement recovery, focus targets, an unfiltered entity total and a computed
cell index address the initial source-review findings. Storage hardening covers
exact-byte conflicts, unrelated note data, retained roots and private-folder
protection, including pre-existing Git-ignore negations.

The built interface follows the incumbent `DESIGN.md` and the
[Service Design surface contract](../../.impeccable/surfaces/components-coforge-servicedesignview-vue-92e2bacb.md):
native typography and theme tokens, the shared centered operating frame, open
sections, separators, existing controls and a locally scrolling table. The owner's
spacing correction added Service Design to that shared frame, restored section
spacing and left-aligned table content. This extension introduces no global visual
system change or raster assets; `DESIGN.md` and `.impeccable/design.json` are not
rewritten. `PRODUCT.md` remains a pre-existing legacy title and tagline without
the current product schema; this task records that drift without repairing it.

Final independent review inspected all five corrected native PNGs in
`reports/service-design-review/`: wide/narrow light/dark maps and the wide dark
external-edit recovery editor. Its disposition was **ship for the captured UI and
product scope**, with no material findings. This is a bounded review disposition,
not confirmation of full verification or delivery.

Observed checks and evidence (2026-10-29):

- Service Design component tests: 4/4 passed; domain/storage tests: 17 passed.
- Integration checks: 14 Service Design, 5 startup and 7 public-folder tests passed
  (26 total), including both configuration orders and failed-write reservation release.
- `npm run test:ui-quality`: 8 passed (46.1s).
- `npm run ui:gallery`: 40 captures, `failures: []`; wide light and narrow dark
  gallery captures reviewed. Feature-specific native captures are separate.
- Focused native Service Design spec: 1/1 passed, exit 0 (24.358s), `errors: []`
  and clean teardown. Captured host: Obsidian 1.14.4 on Windows, isolated `.nq` vault.
- Five WCAG 2.1 A/AA accessibility reports each contain `[]`; the mechanical
  detector also reported `[]`. These automated results supplement screenshot review.
- Native geometry reports show 32px left/right gutters, a 24px editor heading gap,
  and zero page/editor horizontal overflow. Narrow maps retain 312px of internal
  table overflow in their scroll region.

`npm run verify:project` and the full `npm run test:obsidian` are running; their
final results remain pending. The final contained dev-loop result, sitemap
regeneration/check, self-review, PR qualification and merge must be recorded before
delivery is complete. An earlier view-catalog check exited 1 for a stale generated
sitemap; it is not a passing gate.

| Increment | Current status | Remaining closeout evidence |
| --- | --- | --- |
| Reach and understand | Implemented; captured review passed | Full project gate |
| Create and connect | Implemented; focused component/host checks passed | Full host suite |
| Canonical persistence | Implemented; 17 domain/storage tests passed | Full project and host gates |
| Privacy/integration | Implemented; 26 integration/startup/public tests passed | Full project gate |
| Accessibility/pane behavior | Captured review passed; UI-quality 8 passed | Full host suite |
| Delivery | Pending | Final command results; sitemap; self-review; green PR checks; merge |

## Outside this increment

Multiple blueprints per project, typed directional dependency arrows, collaboration,
workshop facilitation, automatic research/AI generation, public blueprint publishing,
diagram export, schema migration of arbitrary existing notes, deletion/cascades and
new integrations require separate product decisions. Timing, metrics, regulations,
research sources and current/future-state descriptions can be authored in existing
Markdown; this increment does not claim dedicated structured workflows for them.

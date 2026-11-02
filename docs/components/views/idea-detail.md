---
id: idea-detail
title: Request details
goal: Decide the next valid action for one request.
audience: streamer
kind: dialog
route: studio.selectedIdea
parent: "[[docs/components/views/board]]"
component: src/plugin/presentation/components/coforge/IdeaDrawer.vue
entry:
  - On Idea board, open a request card or request row.
actions:
  - Choose detail tab
  - Run eligible stage
  - Cancel active run
  - Close
states:
  - No selected request
  - Active attempt
  - Stage error
  - Review pending
journeys:
  - request-to-recognition
privacy: Private vault workspace; excluded from public projections.
order: 26000
type: PBI
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Request details

## Purpose

Understand one request, follow its captured workflow and review the resulting
increment. All seven sections share the request identity and navigation; each
starts with a purpose statement.

| Section | Task and content order |
| --- | --- |
| Overview | Original request, community context and votes, screening and prioritization, then improvement feedback and polished output. |
| Workflow runs | Automation context, current workflow and next eligible action, captured steps and results, then improvement passes and their history. |
| Plan & Design | Independently labelled Implementation plan and Design specification. Each has its own saved or Not saved state; a missing plan does not hide a saved design. Acceptance criteria remain planned criteria. |
| Increment | Reported summary, changed files and diff, coding observations and verification evidence, acceptance criteria, then collapsed post-build findings and the final review form. |
| Sessions | Read-only observation of active and previous parent sessions and observed native assistants. Activity owns captured prompts and responses. |
| AI costs | Read-only retained ledger for this request and project, with known subtotal, coverage, provenance and individual attempts. Unknown amounts are not zero; simulations remain separate. |
| Activity | Captured agent attempts with prompt, response and recovery disclosures, followed by the request timeline. |

Sections retain their stable internal destinations: `overview`, `workflow`,
`plan`, `increment`, `sessions`, `ai-costs` and `activity`. Opening a section never
starts work or changes a request's lifecycle. Sessions and AI costs expose no
execution or charge mutations. Services remain responsible for valid transitions.

## Entry and next action

On Idea board, open a request card or request row. Return through the owning
[Request board](board.md) surface. The header retains request ID, status, category,
project/source, title and author, with Open note, deletion and Close controls.

Workflow runs owns captured step decisions and execution controls. When final
review is available, Overview, Plan & Design and Activity offer **Review
increment**, which opens Increment. The final review form follows Increment's
evidence in its reading scroll. It retains Archive, Request changes and Accept
increment with the existing eligibility gates. Request changes requires a review
note of at least three trimmed characters; an invalid note receives an adjacent
alert associated through `aria-describedby` and `aria-invalid`.

## States and recovery

No selected request; active attempt; stage error; review pending; stopped workflow
with preserved changes; independently missing plan/design; no sessions; cost
history unavailable or loading. Empty Sessions explains where work is managed.
Outside Obsidian, AI costs explicitly identifies the required host and substitutes
no estimate.

Inspect action errors and retained attempt evidence before retrying. Saved state
or observed external confirmation is evidence of completion; an unconfirmed
effect requires inspection before another mutation. A stopped Inbox request with
preserved changes exposes Increment review and explains Restart. Detail navigation
never releases the durable hold.

## Composition and boundaries

Source: [IdeaDrawer.vue](../../../src/plugin/presentation/components/coforge/IdeaDrawer.vue).
The surface extends [the studio design](../../../DESIGN.md): native interface
font, Obsidian theme palette, shared buttons and labelled fields. It introduces no
new visual identity or image assets.

All sections use the same drawer width, capped at 1040px and constrained by the
available pane. A 190px navigation column sits beside the reading area in wide
leaves. At a leaf width of 700px or less, navigation becomes a compact wrapping
row above the content. Its visible hints are hidden in that layout; accessible
descriptions remain associated with the section buttons. Long text wraps, the
request heading can scroll in short panes, and content retains its own scroll
region. Selection and keyboard focus remain distinct.

Section buttons are ordinary buttons in a labelled navigation landmark, with
`aria-pressed`, `aria-controls` and purpose hints. Choosing a section resets its
reading position to the top while retaining focus on navigation. The Overview
component stays alive while moving between sections for the same request, keeping
unsaved prioritization edits. The drawer's review-note draft also survives section
changes; this does not promise persistence after closing or selecting another
request.

Focus moves to Close on opening and returns to the invoking control on closing.
Tab stays within visible dialog controls, including native disclosure summaries;
controls hidden inside closed disclosures are excluded. Escape and the backdrop
close the dialog. Panels share this workspace rather than acting as browser
routes. Entry animation respects reduced motion.

Journey tags: `request-to-recognition`.

## Evidence boundaries

Agent-reported summaries, illustrative diffs, host-captured changes, executed
verification and planned criteria remain visibly distinct. Expanded Activity
attempts retain literal private transcripts and captured provider/model identity;
current settings never reconstruct historical prompts. Saved workflow definitions,
attempt provenance, explicit recovery and mandatory human acceptance remain
authoritative.

Captured prompts, answers and instructions use the shared `ReadableContent`
reading view. JSON becomes labelled fields and lists; Markdown becomes formatted
prose. Nested encoded JSON is decoded for display only. Exact retained text stays
inside an initially closed, keyboard-accessible Original text disclosure, with
capture truncation and reading limits called out explicitly. Untrusted HTML,
embeds and privileged links never execute. Command logs and diffs remain code.
The same reader serves Council answers and captured inputs, workflow and
polishing results, Herdr prompts and assistant messages in Sessions/Peek.

Implementation and qualification evidence is recorded in
[the request-detail task](../../project-tasks/2026-11-01-request-detail-overhaul.md).
The local design contract is
[the IdeaDrawer surface brief](../../../.impeccable/surfaces/components-coforge-ideadrawer-vue.md).

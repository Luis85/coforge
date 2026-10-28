# Final product and content polishing review

Reviewer: fresh subagent after the implementation and initial independent review.
Scope: all view-contract goals, entries, actions and states; generated parent tree;
BRIEF.md journeys; changed view composition; and focused source verification of
native publishing, CLI setup, capture launching, schedule/finance and Council
run evidence/handoff. Runtime edits belong to the root task and journey owner.

## Findings and completed documentation improvements

| ID | Finding and user consequence | Correction |
| --- | --- | --- |
| C1 | Viewer website settings described only saving the folder; it omitted **Write board now** and **Set up GitHub Pages**, leaving the public-sharing journey incomplete. | Document both primary actions, the saved-folder prerequisite, managed workflow ownership and the streamer's commit/push/Pages-source steps. Local export is distinct from remote deployment. |
| C2 | The capture launcher claimed every action creates a fresh tab and offered a nonexistent local project chooser. It omitted the private embedded preview boundary. | Distinguish fresh Open actions, Show selected project reuse, global project selection and embedded Preview. Explain why the detached public window is the capture target. Verified against `StreamDisplaysPanel`, its composable and `stream-views.ts`. |
| C3 | Schedule did not document opening the canonical topics/script note, and finance only listed pausing a plan. | Document **Open Markdown note**, refresh/body preservation, independent preparation effects, and both pause/activate plus confirm/cancel deletion. |
| C4 | CLI settings omitted **Check Claude Code** and its saved-path/version-only qualification. | Document the action, version-only check, native executable warning and distinct Workflow settings versus Project settings responsibilities. |
| C5 | Council's completed typed-plan handoff had no focused view contract, and the recovery contract attributed monitor actions to the recovery-tools component. | Add `council-plan-handoff.md` under the run monitor with exact eligibility, selections and explicit workflow handoff. Align recovery with bounded allowance extension, private export, reassignment and consent-based settled-history removal. The catalogue now has **73** contracts. |
| C6 | Authorization docs advertised Disconnect and scope inspection controls absent from the shared authorization panel; public leaderboards claimed a metric-selection state although all rankings are read-only. | Replace with actual connect/reconnect, authorization-link/cancel actions, both authorization entry locations, and independent empty/ranked states. |

The native Claude child component contained an obsolete instruction to choose
the provider in **Studio settings**. Root corrected it to **Workflow settings**,
aligned workflow-readiness messages with **Project settings**, and updated the
integration guide. The parent settings intro also names the current destinations.

## Product-goal assessment

The 16 operating destinations have one leading task. Broadcast preparation,
scene maintenance, music, public-display launching and history are now explicit
local subpages. Chat, Twitch configuration and recurring messages no longer
compete in one pane. Workflow execution and manual Herdr administration have
separate entry state. Council authoring, intake, execution and definition-folder
configuration are separated, with a shared navigation seam.

Request overview, plan, increment and activity remain focused children of one
request rather than separate global destinations. Native integration settings
remain vault-wide; project/workflow settings retain their narrower scope. The
public website and four capture views retain read-only goals and explicit public
projection boundaries. Inline panels document their actual owners and do not
invent independent host tabs or browser routes.

Definitions and captured evidence remain distinct from execution permission.
The Council-to-workflow handoff preserves the existing request workflow and final
code review. Publication, stream preparation, music playback and provider work
remain explicit actions. No undocumented new product behavior was introduced by
this documentation pass.

## Executed checks and limits

- `npm run docs:views`: **73 views documented; navigation coverage valid; sitemap generated**.
- `npm run check:views`: **73 views documented; navigation coverage valid; sitemap current**.
- Focused `view-catalog.test.mjs`: **1 file / 3 tests passed** after the added contract.
- Source cross-checking and one available Council narrow capture were inspected.
  The capture came from the still-running matrix and was not treated as final
  visual qualification. No browser/server/full-suite process was started here.
- Parent task owns final full-suite, gallery, keyboard/accessibility and native
  host qualification. This source/documentation review does not qualify live
  Twitch/OBS/Claude/Herdr accounts, production vault scale or OS screen readers.

Verdict: the documented task structure is coherent after C1–C6 and the source-copy
correction. Require the parent's final verification before merge; no additional
product-scope blocker was found in this pass.

# Project workflows

Open **Project settings → Agent workflow → Idea Board Workflow** to maintain the
selected project's process. Its flat row also contains **Step attempts**,
**Timing & limits**, **Answer / output templates** and **Herdr**, in that order.
Open an individual request's **Workflow runs** detail tab for captured execution.
**Project settings** keeps
the general project prompt, game brief, paths, links and implementation permission.

New and legacy projects resolve to the standard Screen → Score → Plan → Design → Build
workflow. Existing effective prompts, agents, models, votes threshold and limits
are retained. Opening the editor does not rewrite a legacy project note or run an
agent. **Use standard workflow** explicitly saves its definition.

## Edit the process

Configure the board buckets first, then the ordered steps inside each bucket.
The default outline is **Inbox** (Screen, Score), **Up next** (Plan), **Design**
(Design), **In progress** (Build), and **Accepted** (the reviewed outcome).
Select a bucket to edit its name and description. Add intermediate buckets,
move them up/down with all their steps, or remove them once empty. Inbox and
Accepted keep their start/outcome roles and positions even when renamed.

Select a step to edit it in the left-aligned detail panel. **Bucket** moves it
to the end of another nonterminal bucket; the row's up/down buttons reorder
within its bucket. Add a step or preset to the selected bucket. Execution follows
bucket order and then local step order. Empty buckets execute nothing. Accepted
contains no executable steps: only the existing human acceptance action can
accept changes. A completed analytical workflow remains in its last process
bucket without claiming a shipped increment.

Reordering can break an earlier-result dependency. The draft and dependencies
are kept; repair the identified input/order before saving. Save remains explicit.
Import/export and independent project copies include buckets and step assignments.
Legacy definitions acquire compatible grouping in the editor without rewriting
their notes or captured runs. Existing custom step order is preserved.

The private Idea board uses the saved buckets. Existing grouped runs keep their
captured labels/placement; occupied removed or renamed process buckets remain
visible as **Earlier workflow** columns. Legacy requests retain their lifecycle
placement. Stopped/held and flagged requests stay in Inbox, archived requests in
the Archived filter, and only accepted requests enter Accepted. A completed Design
stays in Design until Build starts. Public viewer/capture boards retain their
screened lifecycle columns and never receive private bucket definitions.

Add, duplicate, rename, remove or move any step, including the standard five. The
ordered list is the execution order; step IDs remain stable through rename/reorder.
New copies receive new IDs. Save changes explicitly. Saved revisions apply to new
runs; existing runs retain their captured definition and project context.

AI steps choose a saved **CoWorker**, or manual provider/model/effort settings,
with supported options for the selected provider. Native Codex is available
alongside Claude Code, Herdr and Simulation. A fresh run resolves and captures
the enabled CoWorker; existing runs retain their captured profile and effective
configuration. Steps also choose instructions, result contract, project access,
automatic continuation, minimum votes and required earlier result types. Contracts
are Markdown, screening, RICE, plan, Design specification or code change. Access is no project access,
read-only project access or editing in an isolated worktree. A code-change result
requires editing access. Instructions cannot grant more tools or accept work.

Required results must have an earlier producer. Execution binds the latest valid
result of each selected type; without explicit requirements it passes the latest
available results. Historical outputs remain attributed artifacts. Viewer text,
repository content and earlier results are always untrusted model input.

Approval and checklist steps persist a human checkpoint without occupying the AI
worker. Complete required items and continue explicitly. This acknowledges that
checkpoint; it does not approve code or claim tests were executed by CoForge.

The automatic run interval throttles new background runs. Automatic steps inside
an existing run continue immediately; manual steps pause. Project automation must
be resumed for automatic AI continuation. Timeouts bound CoForge's wait. Native
Claude budget/turn caps do not enforce spending by an interactive Herdr agent.

**Idea board automation on startup** selects **Start paused** or **Start playing**
for the next CoForge startup. Legacy definitions start paused. Save explicitly;
changing or saving this preference does not start or resume current work. Startup
recovery and required host services settle before automatic admission. Council,
scheduler and event startup policies remain separate; unknown effects never replay.

**Copy workflow from another project** previews a saved valid workflow and its
startup choice, then copies it into an independent destination draft with a new
revision. Source notes and runs remain unchanged. Project-local templates are
cleared with warnings; Council/nudge selections require explicit destination
repair before Save. Vault-wide CoWorker selections remain. Unsaved destination
edits require an explicit replacement acknowledgement. Copying never dispatches.

## Import and export JSON

Use **Import JSON** to choose a file or paste an object. **Preview import** validates
it without changing saved data. Editing the JSON invalidates that preview.
**Replace draft** replaces only the local draft; **Save workflow** commits it.
Invalid imports and failed or stale saves preserve your existing draft.

**Preview workflow export** captures the current draft. Copy that JSON or save it
to a private plugin file; its path is shown. Reopen the preview to include later
draft edits. Exports include instructions verbatim, so review them before sharing.
Connection settings, workspace path fields, runs, recovery data and request history
are omitted. The general project prompt remains separate in Project settings.

For example, this small workflow produces an analysis and then waits for approval:

```json
{
  "format": "coforge-workflow/v1",
  "revision": "example-v1",
  "name": "Analyze and review",
  "limits": {
    "timeoutSeconds": 180,
    "maxTurns": 12,
    "maxBudgetUsd": 1,
    "intervalSeconds": 10
  },
  "steps": [
    {
      "id": "analysis",
      "name": "Analyze proposal",
      "instructions": "Summarize the proposal, uncertainties and next questions.",
      "kind": "ai",
      "output": "markdown",
      "access": "none",
      "provider": "demo",
      "model": "sonnet",
      "automatic": false
    },
    {
      "id": "review",
      "name": "Review analysis",
      "instructions": "Read the analysis before continuing.",
      "kind": "approval"
    }
  ]
}
```

Simulation calls no model. Select a supported real provider to run actual AI work.
The initial managed Herdr agent profile supports Claude Code; other manually
controlled Herdr agents are not interchangeable workflow profiles.

## Execution, changes and recovery

Start a workflow from the monitor or a request's actions. Each request has its own
pinned run, attempt history and outputs. Checkpoints are correlated to the run,
step and revision; an old checkbox cannot complete a changed checkpoint. Other
projects can continue while one run waits for human input.

Editing steps share one verified isolated Git worktree. Later reading steps inspect
that worktree. Every attempt has a fresh result channel. Diffs are cumulative
against the run's base commit. Failed or cancelled steps retain captured changes
and reported costs/tokens; model-written cost/test claims are never accepted.

Any actual changes require final streamer review, regardless of step names or
editable approval nodes. Acceptance checks workspace recovery and verifies the
current files still match the reviewed diff. It does not merge Git or deploy.
Finishing without changes finishes the process only; it does not ship a feature.
The idea board keeps its product states, separately from the workflow cursor.
Omitting screening never automatically publishes a previously private request.

Project paths/general context and displayed RICE estimates cannot change during
an unfinished run. Future workflow definitions remain editable. To apply a new
process to existing work, stop/recover the old run, review any pending changes and
use the card's explicit Restart workflow. Previous runs and their original
names/results remain preserved.

Right-click **Stop workflow** commits a durable operator hold and returns the
card to Inbox. Automatic ticks, startup Play, event triggers, MCP and ordinary
Start calls cannot release it. Only right-click **Restart workflow** starts a
fresh first-step run after active attempts settle. Workflow saves, copies and
request edits never unlock the card. Late results retain evidence in the old run.

If stopped work has preserved changes, its detail view explains **Stopped —
preserved changes need review**. Inspect Increment and accept or request changes
using the existing human review controls. Acceptance still verifies the attributed
workspace; requesting changes preserves old diff/worktree evidence and keeps
Inbox and the hold. Unknown task/cancellation outcomes require inspection and
acknowledgement before Restart. Neither recovery nor review automatically restarts.

Herdr cancellation stops the local wait; its agent can continue externally. Inspect
the original session before acknowledging recovery. Only a verified idle original
target allows reuse. An uncertain or replaced target retires its worktree from
reuse while preserving its files; start fresh after inspection. Reload never
replays an attempt. Externally edited managed progress is stopped for inspection;
it cannot manufacture trusted completed steps. Use note bodies for human annotations.
Removing managed fields also keeps their private origin guard; restore the original
metadata from note history before accepting preserved changes.

The actual configured request folder is protected by managed Git ignore rules,
including custom folders outside `CoForge`. Private folders cannot overlap the
public export folder or Obsidian configuration. Ignore rules do not remove files
already tracked by Git; existing repositories still need an index/history review.

AI costs identifies each task's captured run, step name and definition revision.
Renaming/removing a step never rewrites historical attribution. Manual checkpoints
do not create fictitious AI costs or token usage.

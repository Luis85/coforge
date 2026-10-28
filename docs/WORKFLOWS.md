# Project workflows

Open **Workflow settings** in the Build navigation group to maintain the selected
project's process. **Agent workflow** monitors execution. **Project settings** keeps
the general project prompt, game brief, paths, links and implementation permission.

New and legacy projects resolve to the standard Screen → Score → Plan → Build
workflow. Existing effective prompts, agents, models, votes threshold and limits
are retained. Opening the editor does not rewrite a legacy project note or run an
agent. **Use standard workflow** explicitly saves its definition.

## Edit the process

Add, duplicate, rename, remove or move any step, including the original four. The
ordered list is the execution order; step IDs remain stable through rename/reorder.
New copies receive new IDs. Save changes explicitly. Saved revisions apply to new
runs; existing runs retain their captured definition and project context.

AI steps choose their instructions, provider/model, result contract, project access,
automatic continuation, minimum votes and required earlier result types. Contracts
are Markdown, screening, RICE, plan or code change. Access is no project access,
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
start a fresh run. Previous runs and their original names/results remain preserved.

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

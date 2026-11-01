# Inspect workflow sessions

Open **Sessions** on a private Idea card, or choose the Sessions tab in its
drawer. The running count refers to parent attempts. Select an attempt to read
its provider, captured model, status, elapsed time and last observed activity.

## Working, completed, or interrupted

New managed native sessions stay working through quiet periods. CoForge follows
the CLI's result and original process state; elapsed time is observation rather
than a work deadline. **Stop** ends the user's task. A validated final result is
saved for review. A connection closing without a usable final result is shown as
interrupted, with the available evidence and changes retained.

When original processes are confirmed stopped, **Continue** starts another main-workflow
attempt on the retained task without requiring timeout, budget or retry-epoch
configuration. It does not silently replay work or release a user Stop. An
unknown original execution remains held for recovery. Earlier captured attempts
keep their original limits and lifecycle in secondary execution details.

External MCP sessions retain a separate boundary: CoForge waits for submitted
results or task cancellation, and cannot infer the external client's model state
from one HTTP connection closing.

## Peek

New native Claude and Codex attempts publish bounded, sanitized observations
while they work. Peek shows public assistant messages, tool names/status and
observed output. It links to the exact original attempt's captured task,
response, retained changes and recovery information when those resources exist.
Failed attempts explicitly identify missing captures and unknown historical causes.

Native assistants appear beneath their parent only when provider events establish
an association. Claude can associate activity through an Agent tool ID without
exposing a separate native session ID; these rows are labelled tool-linked.
Unavailable child detail does not establish that no delegation occurred.

Scroll upward or choose **Pause follow** to read earlier entries. New retained
observations increase the unread count. **Resume follow** returns to the latest
entry. Closing Peek or switching projects leaves execution unchanged.

This is a partial observation feed, not a complete provider transcript. Raw SDK
events, hidden reasoning, unrestricted tool-argument payloads and SDK context records are excluded
from this feed. Recognizable credentials and private absolute paths are redacted.
Individual observation text is limited to 2,048 characters, with a truncation
notice. Older entries can be omitted by its 128-event / 32,000-content-character
retention bounds, with truncation disclosed. Recorded activity is not proof of a
successful increment; use the actual verification evidence and human review.
Native SDK tool turns are provider observations, not automatic test verdicts.
Captured Docker verification records keep their separate source fingerprints
and isolated-execution labels.

New MCP coding tasks marked `mcp-worktree-v1` can show bounded host-observed
command events, sanitized command displays/digests and captured outcomes. These are not the external client's full
conversation or CoForge-owned SDK assistants. Exit zero establishes process
completion, not a test verdict or unchanged source. A task with no emitted event
does not establish that no command is running; its client can inspect the
original command through the MCP status tools.

Background observations are persisted separately from execution-control writes.
They do not advance result acknowledgement or keep a completed Build lane occupied.
An unavailable or invalid observation file can leave gaps in Peek without changing
the provider result or cost. Execution-journal failures still require recovery.

Older attempts and already-running workers may have no live capture. Demo,
legacy external MCP and Herdr sessions retain their existing history/status without
claiming a native live feed. CoForge does not scan SDK databases or global
rollouts to reconstruct missing observations.

## Read-only terminal follow

For supported native parent attempts on Windows desktop, choose **Read-only terminal** to open a separate console
following the same parent attempt's sanitized observations. Child selection in
Peek does not change the terminal's parent scope. Opening a follower neither
resumes a saved session nor attaches to the provider's input. Close its window
to stop following; the agent continues independently.

Terminal follow requires a supported native Node installation, using the
configured background-worker Node executable when present. It uses a private
bounded feed and fixed observer script, without SDK credentials or provider
control. Other platforms and hosts without terminal support can use Peek.
Uncertain observer launches are not automatically repeated; they never block
the workflow, its recovery or another provider attempt.

Observation capture is best effort. Capture or display failure cannot authorize
work, advance a step, change its result, stop the provider or replay an attempt.
The existing explicit execution, recovery and human-review controls remain in
their normal workflow views.

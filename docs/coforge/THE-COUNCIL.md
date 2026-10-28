# The Council

Open **The Council** in the Build navigation group. Definitions, source notes,
messages, run evidence and costs are private. None of these surfaces adds content
to the viewer board or accepts code changes.

## Set up specialists and a council

Select a project, open **Definitions**, and create its default team. Create agents
with a name, role, instructions, provider/model and output default. Add the agents
to the team's ordered roster, then create a council and choose its members.

The standard council asks every member for an independent opinion, followed by
every member's solution proposal. Solutions receive the complete saved opinion
collection. Earlier opinions never enter other opinion invocations. Earlier
solutions never enter another solution invocation unless a custom round explicitly
binds that earlier collection. An optional synthesis is an additional contribution.

Round order, participants, instructions, supported output contracts and completion
rules are editable. A partial policy must retain at least one successful member;
missing contributions remain explicit. Revisions and inputs are captured for each
run. Editing a definition affects future work, while disabling a target or revoking
membership blocks the next affected action.

Use **Open note** to inspect the canonical Markdown. Renames preserve IDs;
duplicates receive new IDs. Invalid definitions and references remain visible and
unavailable to new runs. Imports show a replacement preview before saving. Exports
contain authored instructions and configuration; review them before sharing.

The definition-folder settings preview changes without moving or deleting files.
New definitions use the saved folders. Previously identified notes remain
discoverable through the vault's metadata index after a move to another private
folder. Public export and host configuration locations are rejected.

## Submit a note

Designate the desktop that will execute work. Other desktops may inspect saved
work but cannot dispatch. Reload always pauses execution.

In **Submit and preflight**, select a team, an agent or council, and an existing
private Markdown note. **Run preflight** resolves the captured source, definitions,
participants, context, providers and limits without a model request or delivery.
Only explicitly selected context notes and the team's bounded information snapshot
enter a prompt. Check the native runtime when using Claude.

Submit explicitly, then resume execution. Every contribution is committed to the
private journal and published to the source before the next member starts.
Submission is bound to the displayed preflight. A changed source, definition,
selected context or execution limit requires another preflight instead of silently
executing a different capture.
Simulation uses deterministic fake output and requires a new destination inside
`CoForge/Tests`; it leaves the original note unchanged and does not qualify a live
provider. The browser example is explicitly enabled and entirely in memory.

The analytical native Claude path uses an isolated temporary directory, no tools,
no MCP servers and no persisted provider conversation. Managed Herdr is rejected
when its adapter cannot enforce the typed invocation's isolation; there is no
permissive fallback. Existing Herdr workflow support retains its existing behavior.

## Watch an inbox

Choose **Watched inboxes**, select an agent/council, the project's proposal workflow,
or its team information board, and save a private folder binding. Subfolders are
off by default. Notes settle for two seconds. Draft notes and empty notes wait;
Ready-only intake is available for deliberate submission.

Use **Mark source Draft / Ready** or the backlog's state controls. Ordinary Boolean
`Draft` and `Ready` frontmatter properties are supported too. CoForge assigns its
own namespaced identity; leave that identity and submission generation unchanged.
Changing state does not cancel already admitted work or rerun a processed generation;
use the run's pause/cancel or explicit Run again controls for those operations.

Preview existing files before activation. Leave them unselected to skip the
baseline, or select an explicit backlog. Later arrivals, including arrivals while
Obsidian was closed, are reconciled after restart while execution stays paused.
Generated contributions, repeated events and ordinary edits do not rerun a
submission. **Run again** creates a new generation. Queue-capacity failures defer
admission without marking a note processed.

**Reset activation** pauses only the selected inbox and removes its activation
baseline. It preserves source notes, runs and replay tombstones. A new preview and
explicit activation are required; processed generations cannot replay, while
previously unprocessed backlog may be selected deliberately.

## Compose proposal workflows

**Council workflows** saves an explicit v2 definition alongside the project's
existing workflow. Reuse agents and councils, add human approvals/checklists and
message actions, and bind inputs by producer, exact artifact or ordered collection.
The council step uses the same protocol and receives every attributed contribution.
Human waits release the provider slot.
Acknowledged checkpoint choices are included as attributed inputs to later agents.
Message templates can include those choices explicitly with `{{decisions}}`.
These choices remain checkpoint decisions and cannot approve code.

Generic note subjects carry no viewer identity, votes, rewards or implementation
permission. Idea mode requires an explicit existing Idea. A structured plan output
is validated against the plan contract; arbitrary discussion prose or synthesis
cannot be renamed into an implementation plan.

For a completed, published typed plan, the monitor offers an explicit handoff to
an existing request in the same project. The selected plan becomes an attributed
input to that request's saved workflow. All of its configured steps, project
permissions, worktree isolation and final human code review remain authoritative.
The handoff does not publish the discussion, merge files or approve an increment.

## Messages and recovery

Team information is available to later runs under the team's visible context
policy; posting it does not wake every member. Directed requests need allowed
recipients, current grants and remaining inherited root budgets. Information and
replies never automatically start another task. Sender identity, threads, lineage
and delivery identity come from the host. Stopping a root conversation stops future
dispatch for it and its descendants.

The monitor separates provider execution from publication and message delivery:

- **Publishing:** repair the saved result's note write without another model call.
- **Attention with an unknown outcome:** inspect the original external attempt,
  then explicitly acknowledge uncertainty before retrying. A retry may incur another
  charge; the original attempt remains retained.
- **Source edited:** preserve the edits and either continue using the original
  captured input or cancel and submit a new generation. Another edit requires a new
  acknowledgement.
- **Generated section edited:** preserve the human version and recorded artifact;
  inspect the conflict or explicitly publish retained results to another existing
  private note. Deleted sources are never recreated automatically.
- **Waiting for human:** complete required checklist items and acknowledge the
  checkpoint. This cannot accept code changes.
- **Allowance exhausted:** record an explicit, bounded extension with a reason.
  Consumed/reserved work remains counted, original inputs and permissions stay
  pinned, and the journal retains the policy change. Extending a root does not
  widen a stricter child scope unless that scope is explicitly selected. Inspect
  uncertainty and retry/resume separately; recording an extension starts no work.

Private exports retain inputs, definitions and attempts. Readable settled histories
may be removed after explicit confirmation; active or uncertain work, pending
publications and unresolved deliveries block removal. Submission and projection
tombstones remain so pruning cannot replay old submissions or reinterpret results.

Provider-reported cost and token counters remain attached to attempts, including
failed attempts. Missing cost stays unknown. AI costs aggregates these records
privately and supports its existing manual fallback where provider cost is absent.
The root execution allowance accumulates automatic action/provider-wait time;
queued work, human waits, pauses and unloaded intervals do not consume it.
An explicit message expiry is a separate wall-clock policy.

## Verification scope

Requirement tracking is in `design/council-traceability.json`; the source PRD and
its AC-01–26 release scenarios are retained separately. Deterministic, fault-injected,
contained-vault and browser evidence do not replace live-provider or native-host
qualification. Real Obsidian tooling was unavailable in this checkout; the owner
explicitly requested continuing with native verification unavailable.

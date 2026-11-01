# Product brief: CoForge

> Read this before changing anything. It is the owner's statement of what this plugin
> is for; `design/` says what the prototype contains, this file says why.
> Agents: do not invent product decisions. Every `TODO(owner)` is a gap: ask the user
> to answer it, then write the answer here. This file is yours to edit and is never
> overwritten by regeneration.

## Product goal

CoForge lets a streamer and their community build a game together with AI agents,
from inside Obsidian. Viewers submit `!request` and `!vote` chat commands. Ideas get
stable IDs and flow through injection screening, RICE prioritization, planning,
design, implementation and mandatory streamer review. Votes signal demand; RICE remains an
explained estimate. Community recognition credits idea authors and accepted increments.

It works when a streamer can run the complete loop (request → vote → screen → score →
plan → design → build → review → recognition) in the studio view, with every idea kept as a
Markdown note in the vault.

Source: the owner's local prototype (`PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`
in the CoForge prototype ZIP), ported to this plugin.

## Users

### The Council (owner decisions, 2026-10-28)

The owner requested implementation of The Council PRD and explicitly accepted all
12 proposed defaults in its section 14:

1. Reusable agents belong to the vault; teams and councils belong to a project.
2. Setup creates a default project team; councils select ordered members from it.
3. The standard protocol runs independent opinions, then solution proposals. Each round can use sequential round robin or concurrent fan out (owner revision, 2026-10-28).
4. An optional chair adds synthesis without replacing any member's contribution.
5. Team information becomes context without waking every member.
6. Delegation needs explicit recipients and finite limits inherited from the root request.
7. Activation previews existing files; reload reconciles arrivals and pauses execution.
8. Ordinary edits do not rerun work; Run again creates a new submission generation.
9. Generic notes use typed analytical subjects; creating/linking an Idea is explicit.
10. Destinations share one execution kernel; councils compile their protocol into it.
11. Existing v1 workflows retain their semantics; new capabilities use explicit v2 definitions.
12. One designated desktop executes work. Council, schedules and event dispatch
    execute only while CoForge is active. The durable Build exception below
    governs already-admitted native Builds after Obsidian closes.

Definitions are canonical Markdown. Run evidence and local publication/delivery intents
are durable and private. Round robin persists and projects each contribution before
the next member; fan out prompts all members against the same captured round inputs
and completes durable publication before the next round. Unknown provider outcomes
require explicit recovery without replay.
Opinion rounds cannot read previous opinions through prompts, tools or provider history.
Editable definitions never grant capabilities or bypass final host review of code changes.
The full release scope and acceptance scenarios are in `docs/coforge/THE-COUNCIL-PRD.md`.

Council entry journey (owner revision, 2026-10-28): opening The Council starts on
Ask the Council, with an intake for a new question/task seeking advice or opinions
and a history of ingested tasks. Definition editing, existing-note submission,
watched inboxes and execution administration are secondary tools. A newly authored
question is a private analytical Markdown task, preserving the existing captured
preflight, explicit submission and execution/recovery gates. Saved task notes and
retained admissions must remain discoverable after reload; navigation never starts
a provider request.

Council usability (owner revision, 2026-10-29): use visible subpage tabs consistent
with other studio pages. Intake selects a Council directly, resolving its owning
team internally, and shows the chosen Council, participating CoWorkers and rounds.
Make setup prerequisites actionable and activity visible with honest queued,
running, paused, human-waiting and attention states. Keep explicit review and
execution gates. Workflow setup includes an Ask Council action; the owner chose
to wait for the answer and make it available to later workflow steps.

Council follow-through (owner request, 2026-10-29): perform a researched IA review
and a subagent-driven improvement increment through end-to-end qualification,
polishing, PR and merge only when green. Organize the existing Council tasks into
Ask, Activity, Setup and Automation with visible secondary navigation; retain
stable internal routes and existing project/vault scopes. Make readiness,
context recipients, answer reading and recovery discoverable. Started workflows
must not silently adopt later Council/provider/project-instruction edits.

The Idea board appears first in Build navigation, followed by The Council and
Agent workflow (owner correction, 2026-10-28).

Project settings structure (owner revision, 2026-10-29): make Project settings a
persistent main-navigation entry at the bottom. Move Agent workflow and its
Workflow runs, Herdr workspaces and Workflow settings into a Project settings
subpage. Group project configuration into focused General, Requests, Repository,
Agent workflow, Runtime, and Data & examples tasks. Navigation preserves existing
draft, explicit save, execution, privacy and recovery boundaries.

Public component documentation (owner revision, 2026-10-29): all public-view
component contracts have Public as their parent, including the four capture views
and the viewer website. This is an independent documentation family; each public
surface keeps its own entry, read-only projection and lifecycle.

Navigation correction (owner, 2026-10-29): the expanded left navigation needs more
width and should fit ordinary desktop-height panes without unnecessary scrolling.
Remove the repeated project-work-context banner from work views. The project
switcher remains the active-project identity and navigation control; private
visibility stays indicated there and in project settings.

Board correction (owner, 2026-10-29): remove the board decision-summary section
(`cf-board-decisions`). The backlog proceeds directly to its existing filter tabs
and toolbar; Needs review and Flagged remain available through those tabs.

Workspace management (owner, 2026-10-29): rename the Build navigation group to
Build & Improve, first in navigation, followed by Stream, Community and Insights.
Each main navigation group can collapse independently, with its
state saved in CoForge's localStorage. Review the view documentation and correct
its owning-parent relationships against the actual interface.

Reusable Council agents are called CoWorkers in the interface. Provide a dedicated
CoWorkers page in Build & Improve for inventory, creation, editing and management.
Keep existing canonical definitions, stable IDs, memberships, revisions and tool
restrictions compatible. Teams and councils retain their project scope.

Ask the Council includes a vault-file picker that adds selected notes as a list of
wikilinks to the task input, preserving the existing input and submission gates.

The private Kanban card menu includes Send to the Council. It prepares an assessment
of the screened item, its open gaps and possible next steps, preserves an existing
Council draft until explicitly replaced, and requires the usual review and submission.
It never changes the request's status or starts implementation by itself.

### Project requests and privacy (owner decisions, 2026-10-28)

- Each project configures its Request Object in Project settings: a plain Markdown
  frontmatter class label such as Business Idea or Feature Idea, optional typed
  properties, and its own maintained category list. No external class plugin is required.
- Definitions and category changes apply to new requests only. Existing notes retain
  their captured schema, class, values and recorded category; old categories remain
  available when filtering that project's backlog.
- Private projects remain usable by the owner and are excluded from viewer discovery,
  public projections and viewer commands. Privacy changes revoke owned local exports;
  already deployed GitHub Pages content requires republishing.
- AI costs retain and group costs for agents, teams and councils, including failures,
  retries and delegated work. Captured identities survive later definition edits;
  unavailable usage stays explicitly unknown and simulations stay separately labelled.

### Community economy (owner decisions, 2026-10-28)

- Economy is a main-navigation page. Configure a currency fee and optional XP,
  reputation, virtual reward or lootbox benefits for every stream command, including
  help and registration. Fees and benefits can be zero. Failed, rejected and duplicate
  commands do not charge or reward.
- Viewers earn currency through observed live stream participation before game
  registration, so they can afford registration/help fees. Presence is limited to
  available chat-presence evidence; anonymous video viewers are not identified.
- Configure base income per minute for normal viewers and premium income for verified
  current-channel subscribers. Premium is the subscriber's total rate and replaces
  base income. Unknown subscription status uses the base rate without claiming verification.
- Rewards deliver virtual currency, XP or reputation, or perks queued for explicit
  streamer fulfillment. Lootboxes use configurable weighted rewards and disclose odds.
  Both command-usage bonuses and currency purchases/redemptions are supported.
- Charges, outcomes and fulfillment records are durable and deduplicated. No real
  payment, automatic external perk fulfillment or invented starting balance is introduced.

A streamer operating a second-screen studio while on air. The studio must be
understandable at a glance, work without credentials in a clearly labelled demo, and
connect to the local Claude Code CLI. Viewers interact only through chat.

### Stream finances (owner decision, 2026-10-27)

- First increment uses EUR and manual income/expense entry, with description, category, date and optional recorded-stream attribution.
- Recurring subscriptions/expenses are planned commitments with weekly/monthly/yearly cadence and active/paused state.
  They do not generate actual payments. Show their estimated monthly equivalent separately from actual totals.
- Provide create/edit/delete, month and stream filtering, and actual income, expenses and balance. Financial data stays
  private in the vault and is excluded from the public viewer board. No bank/payment API or automatic Twitch revenue import.

### Herdr integration (owner decision, 2026-10-27)

- Follow the local Herdr Companion approach: native executable/session configuration,
  workspace and agent controls/status, and explicit dispatch of CoForge requests to ready agents.
- This increment integrates request dispatch and workspace/agent controls, not the Companion's full
  terminal or folder-worker UI. CoForge's existing screening, automation and review remain authoritative.
- A reviewed dispatch prefixes the project's general agent prompt and includes the selected screened
  request. Verify the target agent identity and project directory before sending. Delivery is not completion.
- Persist intent before mutations; hold pending/uncertain actions across reload without replay.
  The streamer refreshes, inspects Herdr and explicitly acknowledges recovery before another mutation.

### Herdr workflow provider (owner request, 2026-10-28)

- Add Herdr to per-project workflow-step configuration, with an agent and model choice for each step.
- The installed Herdr 0.9.5 can forward model arguments at agent launch, but does not expose a generic
  existing-agent model setter/verifier or task-correlated structured result/cost API. Delivery is not completion.
- Each step attempt launches a dedicated Herdr agent with its selected agent type/model; no existing live
  agent is restarted or silently reconfigured. Initial managed launch support uses the verified restrictive
  Claude Code profile; other Herdr kinds stay available in manual controls but are not claimed workflow-safe.
- Completion uses an automatic task-correlated result file with schema validation. A matching attempt,
  project, request revision and nonce plus observed post-send settling are required; terminal text/status alone
  cannot advance work. Classifiers have one narrow result-file write exception; Plan remains read-only apart
  from that private result channel; Build edits a separate worktree and reports an independently captured diff.
- Herdr interactive agents do not expose trustworthy token/cost usage or enforce the native print-run USD/turn
  limits. Display those boundaries honestly; never substitute model-written counters or generic Herdr metadata.
- Track provider-reported input/output tokens (and cache read/create separately), retain usage on failed attempts,
  and aggregate known counters/coverage privately in AI costs. Inclusive input requires complete cache counters.
- Preserve project/agent identity checks, durable mutation intent, no uncertain-action replay, review gates,
  cost provenance and private/public boundaries. Herdr's own agent permissions must be described honestly.

### Configurable workflows (owner decisions, 2026-10-28)

Bucket workflow redesign (owner request, 2026-10-31): configure the Idea board's
ordered buckets from Inbox to Accepted, then the dedicated ordered AI/human steps
inside each bucket. Support configurable intermediate buckets and keep the step
detail panel aligned left. Bucket and step identities remain stable; explicit
Save applies the definition to future runs. Existing runs retain captured
definitions, and legacy workflows keep their execution order. Inbox/Accepted
retain their lifecycle roles; editable buckets never bypass screening, recovery,
worktree permissions or final human acceptance. Empty buckets execute nothing;
removing a populated bucket requires moving its steps first. Historical requests
remain visible when their captured buckets differ from current configuration.
The private board adopts these buckets; public/capture projections retain their
existing screened lifecycle contract. Research/specification and the test-first
implementation plan are in `docs/project-tasks/2026-10-31-bucket-workflows.md`.
Deliver through subagents, qualify and polish, then push/open/merge a PR only
after local and GitHub checks are green.

Workspace/workflow increment (owner requests, 2026-10-31):

Long-running Build execution (owner revision after CF-135, 2026-10-31):

Activity polishing (additional owner request): Studio activity rows must remain
inside their panel. Wrap long request/event text, align markers/timestamps/open
actions and retain vertical scrolling, keyboard access and request-detail links
without horizontal overflow or clipped event content.

- Support Builds lasting multiple hours/days, including observed tasks approaching
  100 hours. A normal short-step wall-clock timeout must not terminate an admitted
  background Build. Give long execution a separately captured policy, with
  explicit resource bounds and an optional execution deadline.
- The owner chose a persistent local background worker: an admitted Build may
  continue when Obsidian closes or the plugin reloads. Reopening attaches to the
  original execution and reconciles durable evidence; it never blindly resubmits.
- The owner chose separate Build and short-task lanes on the designated desktop,
  then requested configurable maximum concurrent runs on each lane so multiple
  Design and Build items can progress in parallel. Keep defaults at one each;
  configure the caps vault-wide. Raising a cap admits queued work; lowering it
  does not cancel active work. Preserve per-idea/workspace exclusion and explicit
  provider spending limits.
- Keep worker liveness, last provider activity, disconnected observation,
  cancellation request, confirmed termination and final completion distinct.
  Heartbeats do not prove useful progress. Quiet time may warn without killing
  healthy execution. A sleeping/offline local machine cannot make progress.
- The worker owns its provider process, tool access, workspace lease and private
  durable journal. Obsidian remains the canonical note writer and applies verified
  results idempotently. Preserve final human review and existing operator Stop /
  Inbox hold / explicit Restart behavior.
- Worker/OS crashes and unknown process outcomes require inspection/recovery;
  missing heartbeats do not grant authority to start a duplicate writer. Retain
  bounded hot summaries and private evidence independently of renderer memory.
- Existing captured attempts and limits are not silently changed. CF-135's timed
  out attempt and partial code are preserved; do not automatically adopt, replay
  or retry it. Native Claude/Codex worker-backed Build is the first supported
  execution path; external MCP, Herdr and Council keep their explicitly separate
  lifecycles until qualified, with no provider fallback.

Background Build retry (owner request, 2026-10-31): provide an explicit
**Retry Build in background** action for existing requests. Keep their completed
workflow steps, retained results and complete attempt history, and create a fresh
background Build attempt instead of restarting the workflow from its beginning.
Earlier attempt snapshots and partial-work evidence remain attributable. The
operator reviews the transition before dispatch; active/unknown original work,
changed request inputs and missing managed progress cannot silently bypass
recovery, screening or final human review. Deliver through subagents, then
commit/push/open a PR and merge only after local and GitHub checks are green.
The owner chose continuing from reviewed partial work: capture the actual
retained cumulative changes and continue them in a fresh worker-owned workspace,
keeping the original workspace and evidence. Do not silently substitute a clean
tree for existing partial code. If no workspace or real changes ever existed,
review an explicitly identified clean repository snapshot instead. Legacy
foreground execution has no trustworthy persisted process birth identity;
cessation is operator-confirmed and must not be presented as OS-verified.

Improve & polish (owner request, 2026-10-31): make an explicit action available
from the Kanban card context menu and feature detail in every bucket, including
accepted/shipped requests. Every invocation opens a feedback modal. Capture this
feedback with the current result and improve its actual type: request text,
screening/RICE/Plan/Design or code. Preserve the primary workflow checkpoint,
completed steps, historical attempts and original artifacts. Configure one
manual AI pass in workflow settings using either a CoWorker or explicit
provider/model/effort, instructions and limits. The pass is never automatic.
Keep its generated result separate until human Apply or Discard. Approved text
versions reference genuine auxiliary results without rewriting the original
request body; future steps explicitly consume the approved version. Code passes
continue a reviewed immutable source in the persistent background worker and
Apply copies reviewed files to a fresh resource owned by the primary workflow.
Original workspaces and journals stay untouched. Reopen accepted cards for
review; applying or discarding that reviewed result closes that review without
awarding the feature's original completion credit again.

Polishing card feedback (owner request, 2026-11-01): Kanban cards must visibly
identify an in-flight Improve & polish pass on the current result. Project the
saved auxiliary run and its execution state separately from the main workflow
hint, so a reload retains the feedback and a polishing job does not appear to be
the primary Build. Distinguish queued/running work, attention and a completed
result awaiting Apply or Discard. Settled historical passes must not leave an
active polishing indicator. Keep the card's bucket and primary workflow history.
Polishing must use the shared execution, worker and result systems. Repeated
confirmation, callbacks and reconciliation must not create duplicate runs,
attempts, workspaces, results or cost records. Include genuine polishing-run
costs and usage in AI Costs with the owning project's attribution; unavailable
provider costs remain unavailable rather than being fabricated.
Board alignment (owner report, 2026-11-01): Inbox's Add control and independently
wrapping column text must not push its first card below neighboring cards or
empty states. Align column headings, descriptions and content while keeping
configurable labels readable and the Add control accessible.

- Save the independent left-navigation and right-chat collapse choices in localStorage
  and restore them after reopening. Responsive chat defaults apply only when the
  owner has no explicit saved choice. Storage failures must leave controls usable.
- Each project configures idea-board automation to start in Play or Paused on
  reopening CoForge; missing preferences retain the paused default. Saving this
  preference does not immediately run or resume work. Keep interrupted/uncertain
  attempt recovery, project permissions and final review; Council, schedules and
  event automation keep their separate startup policies.
- AI workflow steps choose either a saved enabled CoWorker or manual provider,
  model and reasoning effort. A CoWorker supplies its saved role/instructions and
  execution profile alongside the step's task prompt. Step/project host permissions
  remain authoritative. Capture the resolved definition for each run; later edits
  affect future runs, and unavailable profiles never silently fall back.
- Saved request workflows from other projects can be selected as independent
  copies into the destination editor draft. Save explicitly; copying never starts
  work and edits never change the source project. Review and repair project-owned
  template/Council/team references rather than granting cross-project authority.
- Per-feature Workflow runs belong in the feature/request detail view. Project
  workflow settings retains Step attempts, workflow controls, configuration and
  Herdr setup; navigation preserves current drafts, review and recovery controls.
- Agent workflow uses one flat tab row in this order: Idea Board Workflow,
  Step attempts, Timing & limits, Answer / output templates, Herdr. Rename the
  configuration tab to Idea Board Workflow. Timing/limits and templates have
  their own panes, with the existing explicit definition/template save boundaries.
- Project settings and native Obsidian integration settings action footers must
  meet the bottom of their visible scroll area, with an opaque surface and no
  underlying page showing through. Retain host status-bar visibility and usable
  controls in narrow/short panes and both themes.
- A Kanban card's context menu can stop its workflow and return it to Inbox.
  Persist an operator hold: Play, reload, events and agent/API requests cannot
  restart it. Only the user's context-menu Restart workflow action releases the
  hold and starts a new run from its first step. Retain stopped-run history,
  partial work and recovery evidence; preserved changes require explicit human
  review before a fresh run can start.
- Review notifications throughout the plugin and improve the feature-detail
  attention row. Icons must not grow into empty columns; text, actions and dismiss
  controls must align and wrap clearly in narrow panes. Keep readable severity,
  accessible announcements and all recovery/error information.

Deliver this increment subagent-driven, then create and execute a comprehensive
improvement/polishing plan, qualify all increments end to end, perform a final
polish, and commit/push/open/merge a PR only when all checks are green.

Design-column readiness (owner correction, 2026-10-30): keep requests whose
Design is complete and whose next captured step is Build in the Design column.
Show "Design complete · Ready to build" clearly; do not add another column or
move the request to In progress before Build starts. Only current, valid saved
Design evidence may claim completion.

Provider model settings (owner request, 2026-10-30): selecting a provider in
Agent workflow settings or a CoWorker definition exposes real supported model
and reasoning-effort choices. Save the selected values and capture them for
execution; missing effort preserves the provider default for legacy definitions.
Preserve explicit custom model IDs. Simulation has no model/effort call. Provider
and model capabilities constrain effort; account access remains provider-owned.

Codex provider (owner addition, 2026-10-30): add the locally authenticated Codex
CLI to workflow and CoWorker providers with its real model/effort choices. Preserve
captured definitions, scoped CoForge tools, isolated worktrees and final review.
Use a private, text-only native model profile and host-checked MCP file operations;
never allow native shell, browser, file/image or delegation tools to bypass scope.
Codex's step timeout and finite CoForge tool-call allowance apply; the existing
turn setting bounds those calls. Claude's native turn/USD flags do not cap Codex
spending. Keep missing dollar cost unknown and record provider token usage when
available. Local model metadata must recognize the requested model before dispatch.

Kanban workflow correction (owner, 2026-10-30): add a separate AI Design step after
Plan and before Build. It creates a saved design/specification that Build receives
alongside the plan. Design has read-only project access; Build retains isolated
worktree editing and mandatory streamer review. Show planned requests in a Design
column before building/review. The standard definition used for future runs includes
Design; saved custom definitions and captured runs retain their existing steps.
Workflow settings provides the Design preset for explicitly updating a custom process.

Follow-through (owner, 2026-10-30): perform a subagent-driven improvement and
polishing pass, push the completed change, open a pull request and merge only
after the required local and GitHub checks are green.

Workflow increment (owner, 2026-10-29): AI workflow steps can select an optional
reusable Answer/Output Template. Templates belong to one project and are canonical
Markdown files, with create, read, edit and delete controls inside the plugin.
The Markdown supplies output-format guidance alongside the existing validated
result contract. Runs retain the template content captured at admission; later
template edits or deletion do not reinterpret existing work.

Overhaul the complete workflows interface so its process is easy to understand,
manage and extend. Review product usability, information architecture, accessibility,
privacy, reliability and maintainability; document and execute a comprehensive
improvement/refactor plan through subagents and end-to-end increments. Close with
an improvement and polishing pass, open a pull request and merge only after all
required local and CI checks are green. Preserve explicit saves, draft/conflict
recovery, project scope, host permissions and final human review.

- Give agent workflows a private Workflow settings subpage under Agent workflow, alongside Workflow runs and Herdr workspaces (owner revision, 2026-10-28). Agent workflow belongs to Project settings (owner revision, 2026-10-29); configuration and execution monitoring remain distinct local tasks.
- Each project owns its workflow. New projects start with the standard Screen/Score/Plan/Design/Build process.
- The streamer can add, rename, duplicate, remove, replace and reorder all steps, including core steps.
  Support AI steps and manual approval/checklist steps. Each AI step has a prompt, provider/agent/model,
  validated output contract and explicit access profile. Step IDs stay stable through edits and reordering.
- Import and export a workflow as a versioned JSON object. Import validates and previews replacement of
  the editor draft; saving is explicit and atomic. Exports contain definitions and authored prompts,
  never credentials, repository paths, job history or live workspace/recovery state.
- Preserve exact workflow revisions, instructions, inputs and agent choices for existing runs and history.
  Editing a definition cannot reinterpret an active attempt. Legacy projects resolve to equivalent standard
  definitions without rewriting their notes until an explicit save. Preserve unrelated note properties/body.
- Manual checkpoints persist without occupying the AI worker. Checklists require their required items and
  explicit streamer input; completing a checkpoint does not accept code or publish a request.
- Execution design: semantic output contracts and access permissions are separate from step identity/order.
  Prior outputs are immutable, attributed artifacts treated as untrusted input. A shared isolated run worktree
  lets later read/edit steps inspect earlier changes; every attempt keeps its own result channel and cost record.
- Host policy stays outside editable definitions: project implementation authorization, verified native tool
  restrictions, external uncertainty recovery and final streamer review of actual code changes. A process
  that ends without code changes finishes its workflow only; it does not fabricate an increment or ship a feature.
  Removing screening never automatically makes private requests public. No imported workflow starts by itself.

### OBS music integration without a built-in player (owner decisions, 2026-10-30)

- Remove CoForge's local music library, playlist editor and audio player. A community
  plugin can handle personal playback; CoForge does not manage its library or files.
- Keep music in stream-plan preparation, scenes and automations through existing
  OBS Media/VLC sources (owner confirmation). Plans assign optional sources to Live
  and BRB scenes. Preparation explicitly adds missing memberships disabled while OBS
  is off air; it preserves existing source memberships and never sends playback.
- Show plan cues combine scene visibility with play, pause, stop, restart, mute and
  volume. Existing explicit execution, event opt-in, durable intent and uncertain
  outcome recovery apply. OBS owns source configuration and playback; activating a
  source can start media according to its OBS settings.
- Preserve existing music files, metadata and playlist notes. Legacy plans remain
  editable without erasing old playlist properties. Retain old OBS Now playing
  ownership records for safe clearing/removal; the retired player emits no events.
- Community-plugin selection, installation and direct API integration are outside
  this change. Alert audio and OBS audio/media controls stay available.

## Surfaces (from the design)

### OBS Alerts (owner request, 2026-10-29)

- Provide an Alerts URL for an OBS Browser Source. From the plugin, the streamer
  dispatches saved viewer-facing text templates with variables, GIFs/images,
  audio/music and video to react to stream events.
- Include manual dispatch and explicitly enabled automatic bindings to existing
  CoForge events (owner confirmation). Provide template authoring, testing,
  duration/volume controls and a stop/clear action in the Stream navigation.
- The overlay is transparent while idle, queues alerts, and runs while CoForge is
  active on the same desktop as OBS. Save its local URL across plugin reloads.
  Missed alerts are not replayed after reopening or reconnecting.
- Serve only prepared public alert content and explicitly selected supported media;
  preserve project privacy and screening boundaries for automatic event variables.
  Alert definitions stay private; a source URL grants read-only overlay access.
- Keep manual dispatch prominent during a stream, show live source connections,
  and distinguish sending a cue from observing playback. Check media before
  dispatch and explain source lifetime, audio routing and reconnect behavior.
  Ordinary unrelated template saves preserve playback. Unsupported automatic
  event/variable combinations are rejected before saving an enabled binding.
- Reuse the Twitch operations increment’s permission-filtered, committed activity
  facts for supported follow, subscription/gift, cheer, raid and redemption alerts.
  Public variables are explicitly whitelisted; anonymous identities remain anonymous,
  incoming and outgoing raids remain distinct, and retained or missed activity is not replayed.

### Studio architecture and redesign (owner decisions, 2026-10-28)

- Overhaul the information architecture documented in `docs/components`, then redesign every view as part of one system around user goals, correct data and useful insights.
- Use a more expressive studio: stronger color, larger summaries and more visual emphasis. Keep Obsidian theme compatibility, canonical data ownership and explicit execution/review/recovery boundaries.
- Review the complete result from product, UX, accessibility, privacy, reliability and maintenance perspectives, apply an improvement/polishing pass, and open, qualify and merge the pull request after checks are green.
- Provide an explicit preview-and-confirm cleanup for the loaded sample workspace and local chat-simulator content with their related history, and let the user close temporary examples. Preserve manually authored and Twitch requests even when tested with simulated AI. Older requests without reliable provenance must be identified as ambiguous and kept by default; provider choice alone never authorizes content deletion.

### Agent task scheduler (owner decisions, 2026-10-28)

- Save tasks with a prompt and optional explicit vault-note context, routed to an agent, a council,
  or one explicitly selected member of a project team. Team scheduling does not wake every member.
- Support one-time timers, repeating intervals and daily/weekly schedules with visible saved timezones.
- Execute only while the designated Obsidian desktop and CoForge are open. Skip missed occurrences;
  do not replay work after reopening. Existing execution permissions, finite limits, durable evidence,
  uncertainty recovery and final human code review remain authoritative.
- If a previous occurrence is still active, skip the next occurrence and display the reason.

### Agent tools and event automation (owner decisions, 2026-10-28)

- Make CoForge MCP action tools the enforced default for Council agents. Disable native file,
  shell, browser, delegation and other MCP action tools in the host-controlled launch profile.
  Each invocation receives only its captured context, authorized inputs and approved agent-task
  recipients; independent opinions cannot inspect prior opinions or browse the vault-wide server.
- Expose the enforced policy in agent setup and provide usable CoForge-only setup instructions
  for external Claude sessions. The host still owns permissions, limits and final code review.
- Attach saved workflows to named project or application events. Support both request development
  workflows and Council/v2 workflows. Request workflows require an existing request supplied by
  the event or explicitly selected in the binding; generic events never create an Idea implicitly.
- Workflow nudges create an attributed task for an explicitly selected agent with the supplied
  prompt. Existing delegation membership, recipient and finite-budget checks remain authoritative.
- Only the designated open desktop dispatches event automation while execution is resumed.
  Enable bindings explicitly; preserve event/definition snapshots, deduplicate admissions, hold
  uncertain outcomes without replay, and bound event chains to prevent trigger loops.

### Streaming workspace increment (owner decisions, 2026-10-27)

- Four read-only stream views (Kanban, Twitch chat, leaderboards, community) each have a ribbon icon that
  opens a fresh tab in Obsidian's main workspace (owner revision, 2026-10-28). Tabs can be detached manually;
  detached window names remain stable for OBS capture. They expose only an explicit
  public projection, without private notes, prompts, paths, account IDs, logs, moderation controls or finances.
  Chat includes live Twitch chat only, never local simulation or private bot diagnostics.
- AI cost analytics use native USD, separate from the manual EUR finance ledger. Show costs per feature and
  every task/attempt, retain failures/retries, and distinguish reported, manual and unavailable amounts.
  Tasks without a reliable provider cost (including Herdr) allow clearly labelled manual entry. Usage cost is
  not an inferred cash payment, and missing cost is not zero.
- Each project can edit its Screen/Score/Plan/Build task prompts, starting from defaults, reset individual
  prompts and preview the assembled dispatch. Store them in the project note alongside the general prompt.
  Existing tool/output/review execution gates remain authoritative.
- Each project can also override the AI provider and model independently for Screen, Score, Plan and Build.
  Unset fields inherit that project's existing defaults; legacy notes keep their current behavior. The initial
  choices include Claude Code, Simulation and the verified Herdr managed Claude profile. Queued attempts retain their chosen
  provider/model, including when another project is selected. Configuration cannot change underneath active work.
- Review every private, native-settings and public display view for a clear user goal and next action, then improve
  concrete navigation, hierarchy, empty/error-state, accessibility and spacing findings without replacing the native design.
- The stream schedule stays local to CoForge. Each planned stream has an Obsidian-compatible Markdown note
  for topics, scripts and storyboards, plus date/time, project, Twitch metadata, OBS scene choices and optional OBS music sources. Preparation is explicit; planning never automatically updates a live channel or starts playback/a stream.
- Render authored Markdown in requests, plans and appropriate long-form fields. Logs, configuration editors
  and diffs retain their source/code formatting. Rendering must not execute HTML, transclude vault notes or
  automatically load external media, especially in capture views.
- `!context CF-123 <details>` lets registered, unrestricted viewers add context to an open request. Context
  retains author/time, appends without deleting the original request, invalidates previous screening/planning
  and returns the request to screening automatically. In-flight results for an older request revision cannot apply.
- `!help` explains the viewer journey, with short follow-up topics for requests, progress and community rules.
  It is available before registration and respects Twitch's message length limit and configured actor/currency names.
- Every viewer observed through chat or available chat-presence data receives a private Markdown CRM profile,
  regardless of game registration. Preserve human annotations/unknown properties; observed fields and game
  statistics are maintained from their authoritative services. This does not identify anonymous video viewers.
  Protect private profiles, raw requests/projects, scripts, stream histories, costs/finances and plugin data from
  accidental Git publication; only the explicitly public export folder is intended for publication.
- The private studio has independent left-navigation and right-chat collapse controls, with reachable reopen
  controls and preserved drafts. CoForge's status indicators live in Obsidian's native status bar, not a studio footer.
- Private Kanban cards provide a keyboard-accessible context menu with currently valid actions. Backend gates
  remain authoritative; mandatory streamer review is not bypassed. Public capture views remain read-only.
- After implementation, perform a comprehensive product/UX/accessibility/privacy/reliability/maintenance
  review, address concrete findings in an improvement/polishing pass, and merge only after checks are green.

- CoForge studio (view, entry): idea board, stream chat, agent workflow, community, studio settings.
- CoForge settings (native settings tab): ideas folder, Claude Code, Twitch and viewer website.
- First milestone: reliable Twitch connection, chatbot request/bug intake and replies, channel title/category controls,
  and explicit streamer moderation actions (single-message deletion, timeouts and bans).
- Viewer website (GitHub Pages): a read-only, script-free page with the idea board, leaderboards and badges.

## Data it works with

- Idea notes (canonical, one Markdown note per idea in the configured ideas folder,
  default `CoForge/Ideas`): ID, title, description (note body), category, status,
  author, screening, RICE and plan properties. CoForge never rewrites the note body
  after creation and preserves unrelated properties. Ideas whose note changes outside CoForge
  after screening return to the inbox for a new screening (see docs/coforge/INTEGRATIONS.md).
- Project notes (canonical, frontmatter plus Markdown in the CoForge vault): stable identity,
  project name and brief, agent settings, and the local repository/worktree configuration.
  Each project has its own requests and workflow. A project's repository may be outside the vault;
  the vault is the streamer's CoForge command centre, not the game repository.
- Plugin data (`coforge-state.json` in the plugin folder): votes, increments,
  contributors, registered players, community environment/ranks, balances/reward claims,
  operational counters/history, recurring messages/delivery intents, chat, agent runs and settings.
- Obsidian secret storage: Twitch access/refresh token pairs for streamer and bot (referenced by name only).
- Public viewer board (default `CoForge/Public`): `index.html`, `styles.css`, `board.json` with screened ideas,
  vote counts, scores, plans, display names and badges only. Deployed to GitHub Pages from the vault
  repository's `main` by `.github/workflows/coforge-pages.yml`; CoForge writes files, the streamer pushes.

## Must-have journeys

- The streamer loads the sample workspace, sends `!register`, then `!request CFP-001 Add a lantern` in the chat
  simulator, sees `CF-116` acknowledged and a new note `CoForge/Ideas/CF-116 Add a lantern.md`.
- A second registered simulated viewer sends `!vote CF-116`; a repeated vote is reported as already counted.
- The streamer screens, scores, plans, designs and builds the idea from the idea drawer (demo
  agents), inspects plan and increment, and accepts it; the author's badges update.
- With automation resumed, enabled stages run one at a time; restarting Obsidian pauses automation.
- With the viewer website set up, accepting an idea and pushing the vault moves its card to Accepted on the
  GitHub Pages site; flagged and unscreened requests never appear there.
- With Claude Code configured, screening/scoring run without tools, planning reads the
  game repository and building edits files only in a separate Git worktree.
- The streamer adds multiple projects, each saved as an Obsidian-compatible Markdown note,
  with a local workspace path, optional Git repository and website URL, and a description.
  Each project has a readable stable project ID and its own request backlog.
- A viewer submits `!request CFP-001 Add a lantern`. A project ID is mandatory; missing or unknown IDs
  create no request. The request keeps that project as its parent, regardless of which board the streamer is viewing.
- Projects keep processing requests in the background when the streamer views another project.
  Stream chat, the Twitch connection, contributors and community recognition are shared across projects.

## Out of scope

- Mobile (desktop-only: the Claude Code and Git adapters run native processes).
- An interactive viewer portal (the website is read-only), the prototype's HTTP ingestion bridge,
  commits/merges/pushes of the game or the vault. Twitch chatbot replies and OAuth onboarding are now in scope.

## Decisions

- 2026-11-01: simplify coding dispatch. Future native Build and polishing
  admissions use a dedicated owned worktree and the provider's normal coding
  tools, shell, tests and native assistants. Docker images and approved-command
  lists are not prerequisites for this ordinary flow. Preserve already captured
  attempts and their existing execution contracts. A worktree separates Git
  changes, not the operating system: use explicit supported provider workspace
  permissions under the current desktop account, without administrator rights
  or a silent bypass-permissions fallback. Keep original-process/descendant
  lifetime, cancellation, retained changes, cost provenance and human acceptance
  boundaries. Classifiers and read-only steps retain their intended access.
- 2026-11-01: CF-133 follow-up: fix plugin-origin edits being reported as
  outside changes and make failed Builds explain the available cause and next
  action. Preserve genuine external-edit protection, captured-input invalidation,
  original execution ownership, retained changes and explicit recovery. Missing
  historical diagnostics must remain unknown rather than inventing a cause.
  Add a dedicated read-only AI costs tab in request details, scoped to the
  request and project, with attempt breakdown, known USD subtotal, provenance,
  token coverage and explicit unavailable/simulated values. Include failed and
  retried attempts without double-counting native assistants. Reuse canonical
  cost history; viewing costs never dispatches or changes a provider or charge.
- 2026-11-01: add Sessions on private Idea cards to inspect active and previous
  AI attempts. Reuse the card drawer for a session list and read-only live Peek:
  observed assistant messages, tool activity, verification output, elapsed time,
  last observed activity and access to existing increment changes. Nest native
  assistants only when provider events establish their association; unavailable
  or tool-linked identities must be described honestly. Providers continue to
  coordinate their own assistants. Add an explicit read-only terminal follow of
  the same sanitized feed. Opening, observing or closing an inspector never
  starts, resumes, sends input to, cancels or takes over an agent. Interactive
  handoff is outside this increment. Keep observations bounded, private,
  persistent where available, isolated per project/attempt and excluded from
  model/public projections. Do not retain raw provider output, hidden reasoning,
  credentials, SDK-global instructions or tool arguments in this feed. Capture
  failures cannot advance, fail, replay or change execution ownership.
- 2026-11-01: workflow agents may use their provider's native subagent feature
  and execute tests. The dispatched Claude/Codex agent coordinates its own native
  children inside the parent invocation; CoForge does not dispatch or administer
  CoWorker children for this feature. Implement through dedicated subagents,
  qualify and polish the full flow, then open a PR and merge only when checks are
  green. Retain captured execution permissions, private evidence, isolated
  workspaces, finite execution limits, explicit recovery and final human review.
  This supersedes the earlier blanket native-delegation/test-tool prohibition
  for explicitly enabled, supported workflow invocations; existing captured runs
  retain their original capabilities. Test execution requires actual isolation
  and observed outcomes; a model's summary is not an executed test result.
  Authentication follow-up (owner choice): keep the existing Codex CLI sign-in
  and its SDK-managed global AGENTS/skills context. Use the canonical native
  credential store; do not clone OAuth bundles or require a new sign-in/API key.
  Global context never expands CoForge's tool permissions. Keep invocation
  SQLite/log/model-profile state private; native provider rollout files remain
  provider-owned. Captured CoForge instructions/task text are distinct from
  additional SDK-managed context, rather than a claim to capture every provider
  prompt augmentation.

- 2026-10-31: review the first complete CF-133 intake-to-increment run through
  dedicated product-perspective subagents, then perform a subagent-driven plugin
  improvement and polishing pass so agents can present better-quality increments.
  The pass improves bounded repository discovery, truthful execution/quality
  handoffs and private increment-review evidence within existing capabilities and
  mandatory human review. Preserve the original request/run evidence. Follow-up:
  commit and push the improvements, open a PR and merge only after all required
  checks are green.

- 2026-10-31: Idea board request details expose the captured prompt and LLM
  response inside each corresponding Activity agent-run disclosure. Keep attempts
  distinct and retain private evidence through reload, failure and retry. Historical
  runs without captured evidence say so; do not reconstruct sent prompts from later
  settings. Simulations are explicitly labelled. Preserve literal text, provider/model
  attribution, existing execution/review gates and exclusion from public projections.
  Research and implement the increment through subagents in a dedicated worktree,
  qualify and polish it end to end, then open a PR and merge only when green.

- 2026-10-30: extend Project features with individual selections for every
  standalone workspace capability, including Service Design. Keep the four group
  controls and list Idea board, The Council, CoWorkers, Service Design, Agent
  workflow; Stream studio, Alerts, Schedule, Stream chat, Twitch operations;
  Community, Viewers, Economy, Community settings; Statistics, AI costs, Finances
  and Operations. Their internal tabs and editors remain part of their owning
  feature. Project settings, the project switcher, recovery and vault integration
  setup remain reachable. Missing individual preferences retain existing features;
  saving is explicit and per project. These remain visibility preferences: data,
  public projections, shared services and captured/background work keep their
  existing behavior. Hiding an entire group retains its individual selections.

- 2026-10-30: select visible feature groups independently for each project in
  Project settings. Hide unused navigation groups and their related panels (for
  example Stream chat and live stream controls). This is a workspace preference;
  shared stream/community services and background work keep running. Existing
  projects retain all groups until explicitly changed. Project settings and the
  project switcher always remain reachable; saving is explicit and reversible.

- 2026-10-29: implement the three proposed Twitch integration increments end to end:
  reliable live operations (capabilities, activity, moderation, ads and raids), community
  interaction (Channel Points, redemption queues, polls and predictions), and content/
  improvement (clips, markers, private reports, audience information and optional explicit
  Twitch schedule publishing). Coordinate with the concurrent OBS integration; OBS owns
  broadcast production and its studio controls. Twitch operations remain channel-wide.
  Add a permission-aware data catalogue with source age, collection gaps and unavailable
  capabilities. Request additional scopes only for explicitly enabled features. Preserve
  exact target confirmation, durable intent, unknown-outcome recovery, app-owned reward
  restrictions, private data and human review. Stream plans remain local until explicitly
  published; private scripts and project context are never published to Twitch. Collect
  events only while this designated Obsidian desktop is open; a separate always-on service
  was discussed as a future product decision and is not part of these three increments.
  Use subagents, complete E2E qualification and an improvement/polishing pass, then open
  and merge the PR when all required checks are green. No real Twitch-account mutation
  is implied by automated qualification.

- 2026-10-29: expose the maintained CoWorker roster and definition-based subagent
  dispatch through the existing vault MCP server. Assistants can author private
  tasks for a CoWorker or council, preflight them, explicitly dispatch, inspect
  durable runs and published contributions, and request cancellation. Use the
  existing execution kernel, provider/model definitions, project/team scope,
  finite limits, submission deduplication and human review/recovery gates.
  Authoring never starts execution; dispatch respects the operator's paused state.
  Invocation-scoped Council tools retain their narrower isolation. Existing
  request workflow tools remain the route for screened implementation work.
  Also wrap the official Obsidian CLI for agents to inspect the current CoForge
  vault: explicitly bind and verify its identity on every call. Expose bounded
  inventory, search, Markdown and note-metadata reads. Ordinary note authoring uses
  Obsidian's atomic vault API with exact previous-content checks; managed CoForge
  notes, watched sources, public exports and host configuration keep their existing
  service/permission gates.

- 2026-10-28: ship one local MCP server for all projects in a CoForge vault, explicitly activated once from the plugin.
  Activation registers it in the vault's `.mcp.json` and Claude Code's user-level `~/.claude.json`.
  Discover projects through the shared server and require an explicit project ID on project/task tools;
  adding or changing a project needs no new MCP configuration. Do not write each game repository's settings.
  Expose step tools so external agents can perform at least Screen, Score, Plan and Build themselves,
  including the context, validated result submission and bounded repository tools needed by those steps.
  Keep project identity, screening, worktree isolation, durable attempt evidence and final streamer review.
  Preserve unrelated client configuration and make activation errors recoverable.

- 2026-10-23: the prototype's HTTP ingestion bridge for other chat platforms stays out of the plugin.
- 2026-10-23: untrusted text is sanitized at intake and before every model run; edits made outside CoForge
  invalidate screening (integrity fingerprints), and chat intake is rate-limited because every request becomes a note.
- 2026-10-26: support multiple vault-backed projects whose game repository paths may be outside the vault.
- 2026-10-26: share stream/chat/community, with separate project boards and workflow configuration.
  Switching projects does not stop background agent processing.
- 2026-10-26: viewer requests must explicitly identify their parent project. This supersedes the earlier
  selected-project routing decision. Projects expose a workspace path, optional repository and website URL, and a description.
- 2026-10-26: Git repository URLs are metadata links only. Adding one does not clone a repository or initialize Git.
- 2026-10-26: hide the native Obsidian view header inside the CoForge view; CoForge provides its own studio header.
- 2026-10-27: prioritize Twitch as the first milestone. The chatbot is the primary interface between the plugin and viewers.
  Include title/category updates, message deletion, timeouts and bans. Add `!bug <project-id> <description>` alongside requests.
  Remove fictitious channel information and redundant marketing copy; project IDs must remain legible and discoverable.
- Implementation defaults for the Twitch milestone: fresh installs start without invented projects;
  sample data and local command testing require explicit actions. Automatic public bot replies are opt-in.
- 2026-10-27: `!register` creates one persistent channel-wide player profile. Registration is required
  for `!request`, `!bug` and `!vote`; existing contributor history is preserved without silently registering people.
- 2026-10-27: viewers wait five minutes between feature requests across projects. Bug reports retain
  separate intake protections and do not consume or reset the feature-request cooldown.
- 2026-10-27: population management lists registered players and their activity/economy. Block restricts
  CoForge participation; mute is a Twitch timeout; ban is a Twitch channel ban. Actions require explicit targets.
- 2026-10-27: credit registered, eligible players observed in chat while the stream is live. Label this
  tracked chat-presence time, not verified video watch time. Do not credit offline, missing-data or disconnected gaps.
- 2026-10-27: adjustable starting rules are 1 coin and 1 XP per credited minute; 10 reputation and 10 XP
  per screened feature; 50 reputation and 50 XP per accepted feature; one rank per 100 XP (starting at rank 1).
  Registration grants no initial balance. Rewards are recorded once per milestone with durable evidence.
- Greeting implementation: prompt unregistered viewers on their first observed message, with at most
  one registration greeting per viewer per 24 hours. Public greetings use the existing opt-in chatbot reply setting.
  Registration creates the player account; spawning an actor in the external game remains a later game-runtime integration.
- 2026-10-27: maintain recurring stream messages in the plugin, with editable text and intervals plus
  per-message pause/activate. Post only while live, with automatic bot messages enabled; never replay missed intervals.
- 2026-10-27: dedicated Community settings name the community actor (default Agent) and currency
  (default gold), and configure earning rules and named ranks with minimum XP thresholds. This named
  rank ladder replaces the earlier fixed 100-XP progression decision. The starting rank is Agent at 0 XP;
  further names/thresholds are configured by the streamer. Existing balances are preserved when labels/ranks change.
- 2026-10-27: the technical review includes clear application/integration contracts, separated concerns,
  post-commit events and independent test seams for maintenance and further development.

## Open questions

- None recorded.

## Service Design (owner decisions, 2026-10-29)

- Add Service Design to main navigation under Build & Improve. Each project owns
  one Service Blueprint, with ordered journey steps and a grid of customer actions,
  frontstage actions, backstage actions, support processes and physical/digital evidence.
- Support creation and editing of separate, linked notes for those layers and for
  actors/roles, touchpoints/channels, systems, pain points and opportunities.
- Use canonical Obsidian-compatible frontmatter plus Markdown, stable IDs and
  wikilinks. A vault-wide configurable root defaults to `CoForge/Service Design`,
  with project subfolders and one note per blueprint/entity. Root changes affect new
  notes only; existing notes remain discoverable. Preserve unrelated frontmatter
  and body bytes on metadata edits; external edits require refresh before saving.
- Service Design is private project work and is excluded from public projections.

## Streamer workflow increment (2026-10-27)

### OBS integration scope (owner revision, 2026-10-30)

- The main OBS integration is stream operation and scene management: start,
  pause/resume and stop the stream; switch scenes; create and edit scenes.
- Show plans remain in scope (owner confirmation, 2026-10-30). Improve and polish
  planning and running the show equally, using subagents. Make segment order,
  durations, notes and actions easy to review, with clear saved/draft boundaries
  and explicit cue execution. Preserve private plans, durable outcomes, paused
  event automation after reload and recovery without replay.
- Show plan is the second Stream studio navigation tab, immediately after
  Broadcast (owner correction, 2026-10-30).
- Keep OBS screen previews and audio tuning in OBS. CoForge does not need to
  reproduce those views or settings. Capture devices, source properties and output
  configuration also remain in OBS, as in the existing workflow baseline below.
- Remove the obsolete preview monitors, audio mixer/settings, source/layout
  property editors and full-studio/output setup controls (owner follow-through,
  2026-10-30). Retain connection/readiness setup, stream controls, scene management,
  Show plans, public displays and history. Stop background screenshot/meter polling
  for removed views; retain the observed state needed by supported cues. Push this
  change, open a pull request, fix required checks and merge only when green.
- This supersedes the 2026-10-29 expansion into full OBS setup and live production,
  including its preview and audio-management scope. The earlier three-increment
  plan is historical; it does not require recreating every OBS control in CoForge.
- Pause retains the existing BRB-scene behavior while broadcasting; Resume restores
  the previous scene. Scene editing retains the existing scene/source-membership,
  visibility and ordering operations described below.
- Setup and navigation never broadcast. Credentials stay in secret storage; stream
  keys are write-only. Public displays keep explicit projections. Shared-source
  edits disclose their live impact. Multi-step actions retain individual outcomes;
  unknown effects are never replayed. Event automation is explicit, bounded and
  paused after restart, with no missed-event replay or implicit agent authority.

### Existing workflow baseline

- The plugin opens on a stream-preparation dashboard. The streamer connects an already running OBS Studio
  through obs-websocket v5, selects a go-live and BRB scene, checks readiness, then explicitly presses Go live.
- Go live starts broadcasting through OBS. Pause switches to the configured BRB scene while the stream stays
  live; Resume restores the previous scene. Stop ends the OBS broadcast. Connection/reloads never start a stream.
- OBS remains responsible for stream-service credentials/output configuration. CoForge stores only the OBS
  connection profile and a password reference; the password stays in Obsidian secret storage.
- Every committed workflow interaction publishes a named event, including requested, confirmed, rejected or
  uncertain outcomes; observed external OBS changes are distinct facts. Failed observers cannot alter effects.
- Each project has an optional general agent prompt, saved in its canonical project note and prefixed to every
  agent dispatch for that request's parent project. It does not widen the agent's allowed tools or worktree boundary.
- Remove the reserved scrollbar gutter between the main content and shared chat panel.
- The streamer can explicitly open installed OBS from CoForge. Detect standard native installations, allow a full
  executable path, reuse an existing process and wait for its local WebSocket server. Never launch a second instance
  or auto-start a broadcast. Initial OBS output and WebSocket/password setup remains required once.
- Edit Twitch title, category, tags and broadcast language in CoForge. Link to Twitch's branding editor
  for profile images, banners and accent styling; channel panels remain editable on Twitch.
- First-time stream setup is guided, optional and reopenable. Detect OBS installation/running state without
  launching it, explain missing WebSocket/authentication/scenes and Twitch app/account/permission/chat settings,
  and provide working setup controls. Readiness comes from current connections, not saved fields. Review of OBS
  output destination/audio/video is explicitly human-confirmed; the guide never reads stream keys or goes live.
- While on air, retain one private JSON history object per stream with a sample each minute, including live
  viewers/channel metadata, follower and subscriber totals/points, Twitch chat and CoForge community/request/
  bot/moderation activity, and OBS health. The streamer accepts the additional follower/subscriber read scopes.
  Unavailable measurements remain null with source status; missed/offline intervals are not invented.
- Stream statistics selects a saved stream, plots recorded metrics over elapsed stream time, and compares it
  with up to three earlier completed streams from the same channel. Charts preserve missing-data gaps and
  provide exact sample values. Audience metrics lead by default; engagement and OBS health remain selectable.
- Stream studio monitors live viewers, observed chat activity and OBS health with explicit source age/status.
  Live monitoring does not increase the one-sample-per-minute archive cadence.
- Manage OBS scenes from the plugin: create, rename, duplicate, delete and switch; manage existing sources'
  scene-item visibility, order and membership. Scene copies share existing sources. Source properties, capture
  devices and audio configuration remain in OBS. Mutations share stream-control serialization and durable
  intent/recovery; unknown effects are not replayed. Destructive actions show the exact target for confirmation.

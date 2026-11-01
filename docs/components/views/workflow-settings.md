---
id: workflow-settings
title: Idea Board Workflow
goal: Save the process that new requests will follow.
audience: streamer
kind: subpage
route: "studio.workflowTool = settings (compatibility: studio.view = workflow-settings)"
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/WorkflowEditorView.vue
entry:
  - Open Project settings, Agent workflow, then Idea Board Workflow.
actions:
  - Configure ordered buckets and descriptions
  - Add, reorder or remove empty intermediate buckets
  - Assign steps to buckets
  - Add or select step
  - Reorder or replace
  - Edit prompts and provider
  - Assign a saved CoWorker or configure provider/model/effort manually
  - Choose startup Play or Paused
  - Copy another project's saved workflow into a draft
  - Preview import or export
  - Save or discard
  - Attach an event trigger
  - Manage project Markdown answer templates
states:
  - No project
  - Standard defaults
  - Saved
  - Unsaved draft
  - Validation error
  - Active-work guard
journeys:
  - workflow-configuration
privacy: Private vault workspace; excluded from public projections.
coverage:
  - group: studio
    key: workflow-settings
  - group: workflow
    key: settings
order: 88000
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

# Idea Board Workflow

## Purpose

Save the process that new requests will follow.

Each project owns a v1 definition with stable step IDs. Existing runs keep captured revisions. Import changes the draft after preview; saving is explicit.

Configure the Idea board's bucket sequence first, then its nested steps. Select a
bucket to edit its name/description or a step for the shared detail panel. Inbox
and Accepted keep fixed start/outcome roles; intermediate buckets can be added,
reordered with their steps and removed once empty. Each step belongs to one
nonterminal bucket. Empty buckets are visible and perform no work. Bucket order
and local step order define the flat captured execution sequence. Invalid result
dependencies preserve the draft and block Save until repaired.

Legacy definitions are grouped only in the editor draft until explicitly saved.
Existing runs retain their captured process. The private Idea board retains
occupied earlier-workflow columns when configuration changes, while public
surfaces retain their established screened lifecycle projection.

Choose a saved vault CoWorker for an AI step or configure provider, model and
effort manually. Available values follow the selected provider. A CoWorker's
current enabled definition is captured when a new run starts; retries retain the
captured identity and configuration. Repository access and human review gates remain.

Automation on startup defaults to Paused for legacy workflows. Play applies only
after CoForge reopens and startup recovery settles. Saving, importing or copying
this preference never resumes current automation. Council, scheduler and event
startup policies remain separate, and interrupted/unknown work is never replayed.

Copy workflow from another project lists actually saved valid workflows in
available projects. Preview shows the source startup choice and cleared local
template/Council/nudge bindings. Copy into draft deep-clones a new revision;
mandatory destination bindings must be repaired before Save. Vault-wide CoWorker
IDs remain selected. Source notes and source runs stay unchanged. Replacing an
unsaved destination draft requires an explicit acknowledgement.

## Entry and next action

Open [Project settings](settings.md), choose [Agent workflow](workflow.md), then Idea Board Workflow in its flat navigation. Add or select steps, assign CoWorkers or manual AI settings, choose startup mode, preview a saved workflow copy or JSON transfer, then Save explicitly. Step attempts, Answer / output templates and Herdr are sibling tabs. Request-specific Workflow runs is in request details. Council and event-trigger links use the existing draft guard and never dispatch work.

## States and recovery

No project; Standard defaults; Saved; Unsaved draft; Validation error; Active-work guard. The workflow draft is retained while moving between local tasks. Leaving the authoring workspace or changing projects still uses the dirty-draft guard. Import and cross-project copy replace only the explicitly reviewed draft; Save remains separate.

## Composition and boundaries

Source: [WorkflowEditorView.vue](../../../src/plugin/presentation/components/coforge/WorkflowEditorView.vue), embedded inside [WorkflowView](../../../src/plugin/presentation/components/coforge/WorkflowView.vue). Project settings owns the H1 and main-navigation entry; Agent workflow and its editor use subordinate headings. The workflow editor has no separate global sidebar entry.

The internal `studio.view = workflow-settings` locator remains a compatibility alias for existing guarded navigation. It selects this same local task; it does not create a second page or host tab. Both the compatibility locator and `workflowTool = settings` are covered by this one canonical view contract.

Journey tags: `workflow-configuration`.

## Workspace redesign

The selected project and saved or unsaved state precede a dedicated step catalogue and authoring area. Attach an event trigger sits in the Workflow settings header beside its explanatory context. Configuration, import preview and save actions retain separate visual levels and existing draft guards.

## Ask Council step

Choose **Add Ask Council**, select an enabled project Council and write its question.
The editor shows the participating CoWorkers and rounds; the owning team resolves
internally. Save workflow explicitly. Existing runs retain their captured steps.

At execution, the step admits one private child task and waits for its published
answers. Later AI steps can bind the attributed Markdown report. Paused execution,
human checkpoints and uncertain outcomes hold the workflow. Inspect Council activity
or check its answer from the request's Workflow runs tab. Admission is never reported as completion;
reload retains a confirmed child instead of submitting it again.

## Captured Council bridge and context

Ask Council is an explicit compatibility bridge from the request workflow to the
existing Council v2 execution kernel. Existing AI, manual and nudge steps retain
their meaning; no note is silently migrated. Starting a new parent workflow captures
a versioned private identity for each selected Council, its team/CoWorkers/providers
and the project's instructions/context. Before child admission, the host checks that
identity. Later definition or project-instruction edits hold the step instead of
retargeting it. A legacy parent without a binding must stop/restart before a new
Council admission; already confirmed children retain their journal evidence.

Earlier workflow results have explicit all, selected-role and none modes. The request
itself remains included; Council context is still captured by the existing child
preflight. Absence of the new mode retains an existing saved step's earlier behavior.
Selected mode requires an actual selection and cannot fall back to sharing everything.

Live request-workflow discussions require supported native CoWorkers and an observed
Claude runtime. Simulation Councils can be tried through Ask's explicit simulation
controls; saving a reference does not prove live execution readiness. Known preparation
failures identify the blocker without duplicate-risk acknowledgement. Uncertain
admission and cancellation retain inspection and explicit recovery.

Completed, failed, cancelled and historical child discussions keep an inspection action.
An oversized combined report remains complete in that child; stop the parent, reduce
its Council output/protocol, and start a new workflow rather than repeating an identical
check or silently truncating the answers.

The ordered process shows its step count and selected step. Ordinary editing starts
with the step name, instructions and expected answer; provider/access and automation
controls are grouped separately. Add a step explains the available AI, human and Ask Council
step kinds. Workflow tools hold explicit JSON import/export controls.

[Answer and output templates](workflow-output-templates.md) is this project's
Markdown library. Its explicit save is independent of Save workflow. Selecting a
template changes the workflow draft; future runs capture its saved contents.

The standard process is Screen → Score → Plan → Design → Build. Design produces
a retained Markdown specification with read-only project access; Build requires
both that specification and the plan. Design initially inherits Plan's agent/model
and automation choice and can be configured independently in the workflow draft.
To update an existing custom workflow, select the intended bucket and add the
Design preset. Place it after a Plan and before Build, and select its specification
in Build's required previous results, keeping other needed results selected. Presets
are added to the selected bucket; the validation summary identifies missing earlier
producers. Alternatively replace the draft with the standard workflow. Saving is explicit;
existing runs retain their captured definitions.

The private request drawer has a Plan & Design tab for reading and copying the
saved specification before building. It shows only intact, successful results for
the current request revision. Design output is private and never enters the public
board projection. Simulation specifications are labelled as illustrative.

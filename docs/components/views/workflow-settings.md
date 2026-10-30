---
id: workflow-settings
title: Workflow settings
goal: Save the process that new requests will follow.
audience: streamer
kind: subpage
route: "studio.workflowTool = settings (compatibility: studio.view = workflow-settings)"
parent: "[[docs/components/views/workflow]]"
component: src/plugin/presentation/components/coforge/WorkflowEditorView.vue
entry:
  - Open Project settings, Agent workflow, then Workflow settings.
actions:
  - Add or select step
  - Reorder or replace
  - Edit prompts and provider
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
order: 91000
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

# Workflow settings

## Purpose

Save the process that new requests will follow.

Each project owns a v1 definition with stable step IDs. Existing runs keep captured revisions. Import changes the draft after preview; saving is explicit.

## Entry and next action

Open [Project settings](settings.md), choose [Agent workflow](workflow.md), then Workflow settings in its local navigation. Available actions: Add or select step; Reorder or replace; Edit prompts and provider; Preview import or export; Save or discard; Attach an event trigger. Workflow runs and Herdr workspaces remain sibling tasks in the same workspace. The Council link and event-trigger action navigate to their owning tools through the existing draft guard; neither action dispatches work.

## States and recovery

No project; Standard defaults; Saved; Unsaved draft; Validation error; Active-work guard. Save or discard a dirty workflow before changing local tasks, global destinations or projects. A blocked transition retains the current subpage and draft. Import only replaces the reviewed draft; saving remains explicit and existing runs retain their captured definitions.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/WorkflowEditorView.vue](../../../src/plugin/presentation/components/coforge/WorkflowEditorView.vue), embedded inside [WorkflowView](../../../src/plugin/presentation/components/coforge/WorkflowView.vue). Project settings owns the H1 and main-navigation entry; Agent workflow and its editor use subordinate headings with their own local navigation and authoring controls. Workflow settings has no separate global sidebar entry.

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
or check its answer from Workflow runs. Admission is never reported as completion;
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
To update an existing custom workflow, add the Design preset. When a Plan precedes
a Build, the editor inserts Design before that Build and requires its specification,
preserving the other earlier results that Build already receives. Otherwise, adjust
the draft order/inputs or replace it with the standard workflow. Saving is explicit;
existing runs retain their captured definitions.

The private request drawer has a Plan & Design tab for reading and copying the
saved specification before building. It shows only intact, successful results for
the current request revision. Design output is private and never enters the public
board projection. Simulation specifications are labelled as illustrative.

---
id: workflow-output-templates
title: Answer and output templates
goal: Maintain reusable Markdown answer formats for one project's workflow steps.
audience: streamer
kind: panel
route: project output template library
parent: "[[docs/components/views/workflow-settings]]"
component: src/plugin/presentation/components/coforge/WorkflowOutputTemplates.vue
entry:
  - Open Workflow settings and expand Answer / output templates.
  - The same project library is available in Council workflows.
actions:
  - Create a Markdown template
  - Select and preview a template
  - Edit name and Markdown
  - Save or discard template changes
  - Open the canonical note
  - Confirm deletion through Obsidian
  - Refresh external changes
states:
  - No templates
  - Loading
  - Saved
  - Unsaved draft
  - External conflict
  - Invalid or missing note
  - Confirm deletion
journeys:
  - workflow-configuration
privacy: Project-scoped private Markdown files; excluded from public projections.
order: 91500
---

# Answer and output templates

## Purpose

Maintain reusable Markdown answer formats for one project's workflow steps.
Each template is a canonical `.md` note under
`CoForge/Output Templates/<project-id>/`. Its stable ID follows renames within
the project's private folder. The name and Markdown body can be edited in the
plugin or directly in Obsidian; unrelated frontmatter stays intact.

## Entry and next action

Open [Workflow settings](workflow-settings.md) and expand Answer / output templates.
Choose New template, enter its name and Markdown, then Save template. Select the
saved template in an AI step's Answer / output template field and explicitly save
the workflow. The same library serves agent and council steps in
[Council workflows](council-workflows.md). Templates are shared within their
owning project, independently of workflow definitions.

Manage templates beside the step picker opens the library and moves keyboard
focus to it. Explicit create, save, delete and cancellation actions hand focus
to an appropriate surviving control; background refreshes and another project's
late responses do not move focus.

Preview template renders the Markdown through the existing safe renderer. Open
Markdown note opens the canonical file in Obsidian. Browser examples keep templates
temporarily in memory and cannot open real vault notes. Template Markdown is literal
format guidance; it does not interpolate variables or replace the result contract.

## States and recovery

Saving a template and saving a workflow are separate actions. Template drafts remain
available across navigation and project switches. Refresh discovers external edits
and malformed or duplicate metadata while retaining an unsaved draft. Conflicting
updates and deletions fail without silently replacing the current note; discard
the local changes to load the refreshed source, or keep the draft for manual repair.

Copy template draft preserves the authored Markdown for manual reconciliation.
The latest saved version can be inspected beside a conflicting draft; refresh
does not silently rebase it or replace a newer note.

Delete template names the exact selected template and requires Delete template
file. Obsidian applies the user's native file deletion preference. Existing run
snapshots stay valid. A future workflow referencing the deleted
or invalid note must clear or replace its selection before starting. Workflow JSON
transfers retain project-scoped template references; template Markdown files are
managed separately, so another project needs its own templates and assignments.

Used by saved workflows lists known request and proposal workflow step names
that reference the selected template. Refresh template references checks them
without writing. Unsaved drafts and captured runs are separate, and an unreadable
definition is labelled incomplete rather than reported as having no references.

## Composition and boundaries

Source: [WorkflowOutputTemplates.vue](../../../src/plugin/presentation/components/coforge/WorkflowOutputTemplates.vue).
The library is separate from the workflow form. Its shared project store and
composable also serve the step picker and council editor. Canonical storage checks
whole-note revisions, project identity and private destination boundaries before
writing or asking Obsidian's file manager to delete a file. The adapter rechecks
the note bytes and target immediately before deletion; Obsidian does not offer
an atomic compare-and-delete operation.

## Repairing externally edited files

The plugin creates block frontmatter like this; the body is the answer guidance:

```markdown
---
coforge:
  schema: coforge-output-template/v1
  id: answer-outline
  projectId: CFP-001
  name: Answer outline
---
# Summary

## Evidence

## Next steps
```

Keep an existing template's ID and project identity when editing or renaming its
file. A copied template needs a fresh unique ID. Use the owning project's actual
ID and keep the note in that project's template folder. Indented block metadata,
flow values and comments are preserved. A complete root flow mapping must be
converted to block properties before plugin edits; an unsupported layout is
rejected before writing, leaving the original file intact.

Run admission captures template identity, revision and Markdown. Native, Herdr and
external MCP attempts use that captured guidance, including later steps and retries.
Council preflight captures the same data and requires a new review if its inputs
change. Template instructions cannot grant tools, override validated output schemas,
expand repository access, approve changes or publish anything. Successful template
writes publish project-scoped named facts; observer failures cannot undo note writes.

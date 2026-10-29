# Task: Open the studio with shipped pre-project public exports

- Status: in progress
- Journey: upgrade existing vaults while preserving authored notes and project privacy.

## Why

The repository-root vault contains a genuine older public board without `projectId`.
The new ownership parser requires that field and blocks studio startup with an
edited-export error, even though the files have not been edited.

## Acceptance

- Exact exports from the pre-project renderer are recognized on startup without
  modifying their JSON/HTML or unrelated notes when projects remain public.
- Private projects still retire only verified generated data files.
- Human edits, malformed projections, and unsupported fields still fail closed;
  no filename/footer-only ownership guesses or destructive recovery are added.
- Tests retain immutable fixtures from the shipped version.

## Plan

1. Reproduce startup against the historical public files in the in-memory host.
2. Add an exact historical renderer/schema compatibility path.
3. Run privacy regressions and full verification; install the tested local fix.

## Traceability

Bug fix under BRIEF.md's project-publication/privacy requirements. Generated
traceability contains no req-* / vi-* obligations to change.

## Evidence

- Read-only diagnosis: the local board lacks `projectId`; strict parsing fails at
  `projectId: expected text`. Both files are existing tracked public artifacts.
- The owner authorized agents to download the pinned Obsidian host for contained
  testing; AGENTS.md and the canonical debug/self-review skills were updated.
- Provisioning exposed a Windows shell-quoting failure in the installer. A real
  child-process regression reproduced it with npm paths containing spaces; the
  native Node invocation now uses argv without a shell (7 tooling tests pass).

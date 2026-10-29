---
id: council-vault-files
title: Council input file picker
goal: Add selected vault files as wikilinks without replacing the task input.
audience: streamer
kind: panel
route: Ask the Council / Add vault files
parent: "[[docs/components/views/council-ask]]"
component: src/plugin/presentation/components/coforge/VaultFilePicker.vue
entry:
  - Expand Add vault files below the Council question input.
actions:
  - Search file paths
  - Select files
  - Add wikilinks to input
states:
  - Unavailable outside desktop
  - Loading
  - No matches
  - Listing failed
  - Input limit exceeded
journeys:
  - Council
privacy: Lists private vault file names only; no contents are read or sent.
order: 56375
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

# Council input file picker

## Purpose

Append selected files as a Markdown wikilink list to the existing question. Full
vault-relative paths distinguish duplicate names; existing links are not repeated.

## Entry and next action

Expand Add vault files in [Ask the Council](council-ask.md), search names or folders,
select files and add the links. Files with wikilink delimiters cannot be represented
unambiguously and are omitted. Reopening refreshes the list. Saving and submitting
the Council task remain separate explicit actions.

## States and recovery

Listing failures and an exceeded input allowance leave the input intact. Search
narrows large vaults; only the first 100 matching paths are rendered. Selected files
stay selected across searches. Desktop Obsidian supplies the file names.

## Composition and boundaries

The panel belongs to the question composer and does not open a new host tab. The
picker authors links; it does not grant file access or bypass captured-context
and preflight rules.

---
id: "settings-request-object"
title: "Project Request Object"
goal: "Configure categories, class and optional properties captured by new requests."
audience: "streamer"
kind: "panel"
route: "Project settings / Request Object"
parent: "[[docs/components/views/settings]]"
component: "src/plugin/presentation/components/coforge/SettingsRequestObjectSection.vue"
entry: ["Open Project settings and review Request Object."]
actions: ["Maintain project categories","Set class label","Add or remove fields","Choose field types and defaults","Reorder fields","Save or discard project settings"]
states: ["Unconfigured legacy default","Schema draft","Reserved or duplicate key","Invalid default","Saved for new requests","Stale project configuration"]
journeys: ["multi-project","request-to-recognition"]
privacy: "Private project configuration and request metadata; custom fields are excluded from public projections."
---

# Project Request Object

## Purpose

Choose a plain frontmatter class label and optional text, number, date, checkbox or select properties for this project's new requests. This is CoForge configuration and needs no Obsidian class plugin. The existing `coforge-idea` type and stable request identity remain authoritative.

## Entry and next action

Open Project settings, edit Request Object, then save project settings explicitly. A class label is optional; fields can exist without one. Fields have stable native property keys, readable labels, supported types and optional defaults. Select defaults must belong to the configured options. All custom fields are optional and chat commands retain their existing syntax, using defaults when configured.

Maintain one category per line, with at least one unique category. The first category is the default for new chat requests. Existing requests keep their recorded categories, and board filters include historic categories alongside the current configuration.

## States and recovery

Invalid, duplicate, system-owned and prototype keys cannot save. Failed or stale project saves keep the configuration draft. Changing this definition affects only later CoForge-created requests; it never migrates existing notes or reinterprets their captured schemas. Blank class and no fields preserve the legacy request format.

## Composition and boundaries

The section is part of [SettingsView](../../../src/plugin/presentation/components/coforge/SettingsView.vue). The canonical project note stores the typed `request-object-definition`. New request notes capture class/schema and values through `request-class`, protected `coforge-request-schema` metadata and native custom properties. Existing request bodies, stable IDs and unrelated frontmatter remain canonical and preserved. Provider access, project routing, screening and final review gates remain unchanged.

Journey tags: `multi-project`, `request-to-recognition`.

---
id: "native-website"
title: "Viewer website settings"
goal: "Prepare the read-only viewer website for publication."
audience: "streamer"
kind: "panel"
route: "native settings / Viewer website"
parent: "[[docs/components/views/native-settings]]"
component: "src/plugin/presentation/components/coforge/PluginSettingsWebsite.vue"
entry: ["Within Obsidian Settings → Community plugins → CoForge, use the viewer website section."]
actions: ["Set Viewer board folder","Enable or disable Keep the viewer board updated","Save integration settings","Write board now","Set up GitHub Pages"]
states: ["Unconfigured","Invalid destination","Unsaved folder blocks export","Writing","Board written","Workflow installed","Export or setup failure"]
journeys: ["public-sharing"]
privacy: "Private vault workspace; excluded from public projections."
---

# Viewer website settings

## Purpose

Prepare the read-only viewer website for publication.

Only the public export folder is intended for publication. Set its vault-relative location and choose whether board changes update the local export automatically. Save integration settings before using a changed folder.

## Entry and next action

Within Obsidian Settings → Community plugins → CoForge, use the viewer website section. **Write board now** writes the screened public board to the saved folder. **Set up GitHub Pages** also writes the managed `.github/workflows/coforge-pages.yml` in the vault's Git repository; it does not replace an existing workflow that CoForge did not create.

The streamer then commits and pushes the vault repository to `main` and selects GitHub Actions as the repository's Pages source. CoForge never commits, pushes or publishes the repository itself. Return through the owning [CoForge integration settings](native-settings.md) surface.

## States and recovery

An unsaved folder change blocks both write/setup actions with **Save the new viewer board folder first**. A status message reports the completed local write or failure. A local export does not prove that the remote website has deployed; inspect the deployed website's generated timestamp after pushing. Private content remains excluded by the public projection and destination safeguards.

## Composition and boundaries

Source: [src/plugin/presentation/components/coforge/PluginSettingsWebsite.vue](../../../src/plugin/presentation/components/coforge/PluginSettingsWebsite.vue). Use Obsidian’s native settings container, CoForge settings rows and shared field/button styles. These controls share the native settings form rather than the studio content container.

Journey tags: `public-sharing`.

## Project privacy

Automatic publication is separate from revocation: switching it off does not permit stale owned local exports to retain revoked project data. Existing deployed pages still require an explicit streamer republish.

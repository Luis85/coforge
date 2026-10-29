---
id: public-website
title: Viewer website
goal: Follow screened progress and recognition outside Obsidian.
audience: viewer / OBS capture
kind: public
route: public export / index.html
parent: "[[docs/components/views/public]]"
component: src/plugin/features/coforge/domain/public-site.ts
entry:
  - Open the deployed viewer website or the generated public export index.html.
actions:
  - Read board
  - Expand plan or community context
  - Read leaderboards and badges
  - Navigate sections
  - Refresh board
states:
  - No screened cards
  - Awaiting screening count
  - No leaders
  - Generated timestamp
journeys:
  - public-sharing
privacy: Explicit public whitelist; read-only.
order: 19000
type: Feature
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

# Viewer website

## Purpose

Follow screened progress and recognition outside Obsidian.

The script-free export uses a restrictive CSP and public whitelist. Requests and votes happen in Twitch. The streamer deploys the public folder; the plugin never commits or pushes.

## Entry and next action

Open the deployed viewer website or the generated public export index.html. Available actions: Read board; Expand plan or community context; Read leaderboards and badges. This is an independent entry surface.

## States and recovery

No screened cards; Awaiting screening count; No leaders; Generated timestamp. Inspect the generated timestamp; a newer export appears only after the streamer deploys it. This surface cannot mutate private data.

## Composition and boundaries

The project identity and participation commands lead the page, followed by the generated timestamp and an explicit Refresh board link. Section links jump to the idea board, leaderboards and badges. Reading never triggers a timed reload, preserving keyboard focus and expanded plans. The standalone palette supports light/dark preferences with readable semantic text; request columns use stage headings while retained cards own their content surface.

Source: [src/plugin/features/coforge/domain/public-site.ts](../../../src/plugin/features/coforge/domain/public-site.ts). The exported document owns its standalone HTML and CSS. It uses the explicit public projection and exposes no private mutation controls.

Documentation parent: [Public](public.md). The website is part of the public-view family while retaining its independent exported document and deployment lifecycle. Private native website settings remain under CoForge integration settings.

Journey tags: `public-sharing`.

## Project privacy

Revoking publication scrubs owned local board JSON and HTML even when automatic board updates are off. Unrelated files are preserved. Previously deployed GitHub Pages content remains online until the streamer republishes or removes it; CoForge does not push the vault.

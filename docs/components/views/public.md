---
id: public
title: Public
goal: Identify the read-only viewer-facing projections and their shared privacy boundary.
audience: viewer / OBS capture
kind: shell
route: Documentation family / public views
parent: null
component: src/plugin/features/coforge/domain/stream-surfaces.ts
entry:
  - Open an individual public capture tab or the deployed viewer website through its documented entry.
actions:
  - Find a public-view component contract
  - Read the shared projection boundary
states:
  - Public projection available
  - No eligible public data
journeys:
  - public-sharing
  - community
privacy: Independent public projection family; read-only, with no private studio controls or mutation capabilities.
order: 14500
type: Epic
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

# Public

## Purpose

Group all viewer-facing component contracts under one independent public parent:
[Public stream Kanban](public-kanban.md), [Public Twitch chat](public-chat.md),
[Public leaderboards](public-leaderboards.md), [Public community](public-community.md)
and the [Viewer website](public-website.md).

## Entry and next action

This is a documentation family, without a runtime navigation destination or launch
control. Open each capture from its ribbon or Stream studio → Public displays, or
open the independently deployed viewer website. Those entries and lifecycles stay
defined by the child contracts.

## States and recovery

Each child describes its own empty, disconnected or projected-data state. Resolve
private setup and connection failures inside the private studio or native settings;
the public views expose only their explicit read-only projection.

## Composition and boundaries

The family is independent of [CoForge studio](studio.md). Its documentation parent
does not wrap the children in the private studio shell, add permissions or create
a new Obsidian tab. The four capture tabs use StreamSurfaceView and the shared
projection in [stream-surfaces.ts](../../../src/plugin/features/coforge/domain/stream-surfaces.ts).
The viewer website remains a standalone export with its own HTML and CSS.

Only eligible public-project requests, public recognition and permitted live Twitch
messages cross their respective projection boundaries. Private prompts, notes,
paths, account identifiers, moderation, finances and logs remain excluded.
The [native website settings](native-website.md) configure publication privately
and retain their native-settings parent.

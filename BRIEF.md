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
implementation and mandatory streamer review. Votes signal demand; RICE remains an
explained estimate. Community recognition credits idea authors and accepted increments.

It works when a streamer can run the complete loop (request → vote → screen → score →
plan → build → review → recognition) in the studio view, with every idea kept as a
Markdown note in the vault.

Source: the owner's local prototype (`PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`
in the CoForge prototype ZIP), ported to this plugin.

## Users

A streamer operating a second-screen studio while on air. The studio must be
understandable at a glance, work without credentials in a clearly labelled demo, and
connect to the local Claude Code CLI. Viewers interact only through chat.

## Surfaces (from the design)

- CoForge studio (view, entry): idea board, stream chat, agent workflow, community, studio settings.
- CoForge settings (native settings tab): ideas folder, Claude Code and Twitch integration.

## Data it works with

- Idea notes (canonical, one Markdown note per idea in the configured ideas folder,
  default `CoForge/Ideas`): ID, title, description (note body), category, status,
  author, screening, RICE and plan properties. CoForge never rewrites the note body
  after creation and preserves unrelated properties.
- Plugin data (`coforge-state.json` in the plugin folder): votes, increments,
  contributors, chat log, agent runs, activity, settings and integration settings.
- Obsidian secret storage: the Twitch user access token (referenced by name only).

## Must-have journeys

- The streamer loads the sample workspace, sends `!request Add a lantern` in the chat
  simulator, sees `CF-116` acknowledged and a new note `CoForge/Ideas/CF-116 Add a lantern.md`.
- A second simulated viewer sends `!vote CF-116`; a repeated vote is reported as already counted.
- The streamer screens, scores, plans and builds the idea from the idea drawer (demo
  agents), inspects plan and increment, and accepts it; the author's badges update.
- With automation resumed, enabled stages run one at a time; restarting Obsidian pauses automation.
- With Claude Code configured, screening/scoring run without tools, planning reads the
  game repository and building edits files only in a separate Git worktree.

## Out of scope

- Mobile (desktop-only: the Claude Code and Git adapters run native processes).
- Posting to Twitch, OAuth onboarding, a public viewer portal, the prototype's HTTP
  ingestion bridge, commits/merges/releases of the game.

## Open questions

- TODO(owner): should the HTTP ingestion bridge for other chat platforms come back as a plugin feature?

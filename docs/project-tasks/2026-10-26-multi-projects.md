# Task: Manage multiple vault-backed projects from one stream studio

- Status: in progress
- Journey in `BRIEF.md`: add and switch projects, route viewer requests by explicit parent-project ID, and process projects in the background.

## Why

A streamer needs one vault to coordinate multiple game repositories and their community.
Project metadata belongs in ordinary Obsidian Markdown notes; agent work belongs in each project's configured repository and separate build worktree.

## Traceability

The imported design currently declares no requirement or interaction entries. Product acceptance
will be covered by project, vault-storage, scheduler and browser regression tests.

## Acceptance

- Create and edit project notes, preserving stable IDs, unrelated frontmatter and existing body bytes.
- Each project has its own brief, repository/worktree paths, requests and workflow settings.
- Switching projects changes the board without losing data or stopping background processing.
- Viewer requests require a readable project ID (`!request CFP-001 <idea>`); missing and unknown IDs create no request.
- Each project includes a workspace path, optional repository and website URL, and a description. Requests keep their project parent.
- An agent run uses the originating project's configuration even if the streamer switches projects during the run.
- Chat, Twitch and community recognition remain shared; request IDs remain globally unambiguous.
- Existing single-project data becomes the initial project without changing request IDs, votes, note bodies or saved increments.
- Invalid or failed writes preserve the current project and the user's form draft; no success event precedes a successful write.
- Outside-vault project repositories remain supported; build work stays in separate Git worktrees.

## Plan

1. Inspect a maker dry-run and existing storage/scheduler contracts.
2. Write failing behavioral tests for project persistence, migration, request routing and background isolation.
3. Implement project records and note storage, then project selection and creation in the studio.
4. Verify existing flows, project browser journeys, rendered UI/gallery, and contained Obsidian behavior.

## Out of scope

Project deletion, automatic commits/merges of game repositories, and posting to Twitch.

## Evidence

Owner decisions recorded in BRIEF.md; implementation and verification pending.

Maker preview reviewed: entity `coforge-project`, Markdown backend, plan hash
`0c9291d87146a9987d3379faa3cd10a6f3d50f26fd33fb44fe1a20e1c1b8f332`.
The generic maker would register a separate framework entity collection. The implementation
extends the existing CoForge studio's canonical storage instead, keeping one project source of truth.

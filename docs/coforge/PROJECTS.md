# Projects and their request backlogs

Open the project button in the studio sidebar, then **Add project**. Give the project a name,
an absolute workspace path and a description. The workspace contains the game files and is
where agents work; it may be outside the Obsidian vault. Optional Git repository and website
URLs are metadata links. CoForge does not clone a repository or initialize Git when saving a link.

Each project gets a stable, readable ID such as `CFP-002`, shown beside its name in Projects and
in the sidebar. **Open board** switches to that project's backlog. **Settings** edits its
description, workspace, links, provider, model, workflow and run limits.

## Viewer requests name their parent project

Viewers first use `!register`, then `!request CFP-002 Add a lantern beside the moon gate`.
A project ID is mandatory. Feature requests have a five-minute cooldown across projects.
Missing, invalid and unknown project IDs create no request and do not consume request IDs.
The named project receives the request even while the streamer is viewing another board.
`!vote CF-116` and `!status CF-116` continue to use globally unique request IDs.

Requests have one project parent. The parent ID is stored in the request note's
`coforge-project` property. An unrelated user-written property named `project` is preserved.
Changing the parent of a screened request directly in a note returns it to the inbox for
screening again; it cannot carry a trusted plan into a different project.

## Project notes stay in the vault

Project records live in `CoForge/Projects` as ordinary Markdown files. For example:

```yaml
---
type: coforge-project
id: CFP-002
name: Moon orchard
description: A quiet orchard built with our community.
project-path: D:/Games/moon-orchard
repository-url: https://github.com/example/moon-orchard
website-url: https://moon-orchard.example
worktree-folder: ''
allow-implementation: false
provider: demo
paused: true
---
```

The actual file also records timestamps, stage switches, model and run limits. The Markdown
body is yours for notes and links. Editing project settings updates owned frontmatter only;
existing body bytes and unrelated properties are kept. Keep the project ID stable.

Notes are canonical. Valid changes to project properties in Obsidian are read back into the
studio; automation pauses for review. A missing or invalid project note prevents further
agent work for that project. Restoring it makes the project available again. Existing request
notes are retained and are never silently assigned to another project.

An existing single-project installation becomes `CFP-001`. Request IDs, votes, saved increments,
screening evidence, unrelated properties and note bodies are preserved.

## Shared stream, separate work

Chat, the Twitch connection, contributors and community recognition are shared. Backlogs and
workflow settings belong to individual projects. Legacy workflows start paused;
new startup behavior follows each saved workflow's explicit Play/Paused choice.
Switching boards does not stop resumed projects. Separate vault-wide short-task
and background Build limits rotate eligible work across projects, defaulting to
one run in each lane. Each request/workspace keeps exclusive write ownership and
captured originating-project settings. Already-admitted background Builds can
continue after Obsidian closes; see [project workflows](../WORKFLOWS.md).

The native Claude executable and Twitch configuration remain in the CoForge plugin settings.
Repository/worktree paths and implementation permission are configured per project in the
studio. Planning reads the configured workspace. Real builds require an existing Git repository
with a clean checkout and edit a separate worktree; accepting an increment does not merge it.

The existing public viewer board displays the selected project's screened backlog and project
ID, alongside shared community recognition. It never publishes local paths or agent configuration.

# CoForge

**A community game studio inside Obsidian.** Streamers build a game with their viewers and
AI agents across multiple projects: viewers pitch ideas with `!request <project-id> <idea>` and support them with `!vote`; every idea
gets a stable ID (`CF-101`), its own Markdown note, a screening verdict, an explained RICE
score, an implementation plan, a reviewable increment and mandatory streamer review.
Accepted work earns the author community recognition and badges.

This plugin is the Obsidian port of the CoForge local web prototype (React + Express),
rebuilt on the [obsidian-plugin-shell](https://github.com/Luis85/obsidian-plugin-shell)
`blank` starter (Vue 3, Pinia, Nuxt UI, Vite, Vitest). Desktop only.

## Use it

1. Build (`npm ci`, `npm run build`) and copy `dist/main.js`, `dist/styles.css` and
   `manifest.json` into `<vault>/.obsidian/plugins/coforge/`, then enable **CoForge**.
2. Click the gamepad ribbon icon or run **CoForge: Open CoForge**.
3. On the empty board choose **Load sample workspace** to explore the illustrative
   *Mosslight* project, or **New idea** to start your own. Ideas are written to
   `CoForge/Ideas` (configurable).
4. Open the project button in the sidebar to add projects, their workspace paths, repository and website links, and descriptions.
   Each has a stable project ID (`CFP-001`) and its own backlog, saved as Markdown notes in the vault.
5. Try the loop: send `!request CFP-001 Add a lantern` in the chat simulator, vote as another
   viewer, open the idea and run **Screen → Score → Plan → Build** with the demo agents,
   inspect the plan and increment, then accept it. Enable stages in **Agent workflow**
   and resume automation for automatic progression (automation always starts paused).

For local development, `npm run build:local` builds and installs the plugin into this
repository's `.obsidian/plugins/coforge/`. It does not use or create `.test-vault`.
The `.obsidian` output is ignored by Git. Contained automated Obsidian tests continue
to use their separate sandbox vaults.

Commands: **Open CoForge**, **Run the next workflow step**, **Pause or resume automation**,
**Publish the viewer board**, **Set up the viewer website**.

| Area | Behaviour |
| --- | --- |
| Chat intake | `!request`, `!vote`, `!status`, `!me`, `!help`; local acknowledgements; chat simulator; receive-only Twitch EventSub |
| Projects | Vault-backed project notes, separate backlogs and workspace paths (including outside the vault), metadata links and descriptions; requests require their parent project ID |
| Ideas | One note per idea with properties for status, screening, RICE and plan; edits and deletions in the vault flow back into the studio |
| Workflow | Screen → Score → Plan → Build, single worker, queue, pause/resume, run next, cancel, vote threshold, failure holds |
| Agents | Clearly labelled demo agents, or the native Claude Code CLI (no tools for screening/scoring, read-only planning, builds in a separate Git worktree) |
| Review | Plan, diff and files, accept, request changes, archive, moderation override |
| Recognition | Leaderboards, contributor profiles and seven badges computed from evidence |
| Viewer website | Read-only, script-free board, leaderboards and badges in a vault folder, deployed to GitHub Pages from `main` by a workflow CoForge writes once |

Integration setup, the viewer website and safety boundaries: [docs/coforge/INTEGRATIONS.md](docs/coforge/INTEGRATIONS.md).
Projects, request routing and project-note properties: [docs/coforge/PROJECTS.md](docs/coforge/PROJECTS.md).
Product brief: [BRIEF.md](BRIEF.md).

### Source map

| Path | Responsibility |
| --- | --- |
| `src/plugin/features/coforge/domain/` | Types, commands, workflow rules, recognition, idea-note mapping, validation, sample data |
| `src/plugin/features/coforge/application/` | Studio store and transactions, chat intake, workflow engine, review, demo agent, Claude protocol |
| `src/plugin/infrastructure/coforge/` | Vault storage, Claude Code/Git process adapter, Twitch EventSub, runtime wiring, commands |
| `src/plugin/presentation/{components,composables,stores,context}/coforge` | Vue studio UI |
| `src/plugin/styles/coforge/` | Studio styles on Obsidian theme tokens |
| `src/plugin/tests/project/coforge/` | Behavioural tests (chat, engine, recognition, vault storage, Claude/Twitch adapters) |

## Plugin Shell scaffold

The sections below come from the Plugin Shell generator and describe the inherited
tooling and gates.

An Obsidian plugin generated from the Plugin Shell starter kit (Vue 3, Pinia, Nuxt UI,
Vite, Vitest, Playwright). Run the checks below to qualify this generated scaffold;
product requirements in `design/traceability.json` stay TODO until implemented and accepted.

## Source preview and optional Airship

Run `npm run dev:preview` for the generated source-backed browser preview. See [AIRSHIP.md](AIRSHIP.md) for opt-in installation, safe local launch and the source-edit/regeneration contract. Airship is never a production dependency.

## Quick start

Read `design/compiler-readiness.json` first. When dependencies are `resolution-required`,
review the declared packages and run `npm install` explicitly to update the lockfile
before using `npm ci`. Generation never contacts the package registry. Build, typecheck,
tests and business acceptance start as **not run**, not as passing evidence.

```sh
nvm use                  # Node from .nvmrc (npm 11.19.1)
npm ci                   # only after dependency readiness is locked
npm run check            # typecheck + lint + project tests: your definition of done
npm run test:watch       # Vitest watch mode for the product tests
npm run dev:obsidian -- --allow-download   # real Obsidian sandbox: build, hot reload, logs
npm run test:obsidian    # real-Obsidian E2E suite (fresh contained vault per test)
```

The first `dev:obsidian`/`test:obsidian` run needs `--allow-download` (or
`OBSIDIAN_ALLOW_DOWNLOAD=1`) to fetch the pinned Obsidian host into `.native-cache/`.
Nothing is downloaded without that opt-in, and only contained vaults inside this
folder are ever opened.

## Commands

| Daily loop | What it does |
| --- | --- |
| `npm run test:watch` | Product tests in watch mode (`configs/testing/vitest.project.config.mjs`) |
| `npm run test:tdd` | Watch only the acceptance tests generated from your requirements |
| `npm run dev:obsidian` | Build with inline source maps, launch the sandbox vault, hot-reload on save, stream logs |
| `npm run -s dev:obsidian -- --json` | One build/launch/reload iteration with a JSON summary (errors, logs, screenshot) |
| `npm run dev:ui` | Browser harness for the Vue UI, without Obsidian |
| `npm run build:clickdummy` | Build `clickdummy.html` from the generated Vue pages with synthetic read data |
| `npm run make -- --list` | Code generators (features, entities, commands, events); preview with `--dry-run` |

| Gates | What it proves |
| --- | --- |
| `npm run check` | Definition of done: typecheck, ESLint (`src`, zero warnings) and product tests |
| `npm run check:fast` | Typecheck plus only the tests related to files changed since the last commit |
| `npm test` | All product tests once |
| `npm run test:obsidian` | The built plugin loads, registers and unloads in real Obsidian |
| `npm run verify:project` | `npm run check`, then the release build and UI-effect tests (the full local gate) |
| `npm run verify:artifacts` | What the full gate adds to `check`: release build, UI-effect tests, test data (CI runs `check`, then this) |
| `npm run build` | Release bundle in `dist/` (`main.js`, `styles.css`, `manifest.json`) |
| `npm run check:submission` | Local mirror of the Obsidian community-review rules (manifest, lint, bundle) |
| `npm run doctor` | Toolchain and configuration diagnostics |

`npm run test:suites -- --list` lists every test suite (product, framework, real Obsidian)
with its runner and prerequisites; `npm run test:project` runs the product suites.
`npm run verify` is the inherited full framework gate (coverage, analyzers, baselines).
It is much slower and is not required for day-to-day product work.

## Offline clickdummy

After generation and `npm ci`, run `npm run build:clickdummy`. Open the resulting
`clickdummy.html` directly. It embeds the shared generated Vue pages, styles and
full project JSON. Read operations use synthetic fixtures; business writes remain
explicitly unavailable. The preview state picker and reset never change the design.
Use `node bin/app clickdummy build --replace` for a reviewed rebuild of existing
output. A built clickdummy does not establish native or business acceptance.
See [JSON to clickdummy](docs/framework/development/COMPANION-CLICKDUMMY.md).

## Where code lives

| Path | Contents |
| --- | --- |
| `src/plugin/generated/` | Generated product code: domain, application use cases, sources, stores, Vue screens |
| `src/plugin/features/` | Hand-written features on the shell API (`src/plugin/features/api.ts`) |
| `src/plugin/main.ts` | Plugin entry; lifecycle composition only |
| `src/plugin/tests/project/` | Product tests; `acceptance/` holds one TODO test per requirement |
| `src/plugin/tests/unit/generated/` | Tests that `npm run make` writes for new features (part of `npm test`/`check`) |
| `tooling/tests/obsidian/` | Real-Obsidian specs (`*.obsidian.ts`) and their fixture vault |
| `design/` | The design export, requirement traceability and design system |
| `src/` (rest) | The reusable shell foundation: services, adapters, logging, UI kit |

Agent and editor setup: `AGENTS.md` (all coding agents), `CLAUDE.md` and `.claude/`
(Claude Code hooks, permissions and skills), `.vscode/` (debugging, tasks, extensions).

## Testing layers

1. **Unit and service tests** (node, milliseconds): domain and application code.
2. **In-memory Obsidian** (`@test/obsidian`): load the real plugin, run commands,
   open views and settings against a fake vault/workspace. Opt in per file with
   `vi.mock('obsidian', () => import('@test/obsidian'))`; a bare `obsidian` import
   otherwise throws on purpose. Example: `src/plugin/tests/project/plugin-host.test.ts`.
   Guide: [Obsidian test kit](docs/framework/testing/OBSIDIAN-TEST-KIT.md).
3. **Components** with `// @vitest-environment happy-dom` and `@vue/test-utils`.
4. **Real Obsidian** (`npm run test:obsidian`): Playwright over the DevTools protocol
   against a downloaded Obsidian, with screenshots, console logs and JUnit output in
   `reports/obsidian/`. Guide: [dev loop and E2E](docs/framework/testing/OBSIDIAN-DEV-LOOP.md).

The in-memory host is a fast approximation, not Obsidian. Behaviour that depends on
the real host belongs in a `tooling/tests/obsidian/*.obsidian.ts` spec.

## Logging and debugging

- `npm run dev:obsidian` streams plugin console output and uncaught errors to the
  terminal and appends everything to `.obsidian-sandbox/logs/dev.log`. Stack frames
  are mapped back to `src/...:line:column`.
- The plugin's structured logger records only at debug level when enabled. The dev
  loop runs the **Toggle debug logging** command (`debug-toggle`) after each load;
  **Inspect debug report** (`debug-report`) shows the redacted records. The `--json`
  run saves them to `.obsidian-sandbox/logs/debug-report.json`.
- Breakpoints: while `dev:obsidian` runs, use the VS Code launch configuration
  **Attach to Obsidian (dev:obsidian)** (port 9222) or `chrome://inspect`. Dev
  builds carry inline source maps; release builds in `dist/` do not.
- Tests: **Debug current Vitest file** in VS Code, or `npm run test:watch`.

See [logging and debugging](docs/framework/development/LOGGING-AND-DEBUGGING.md).

## Working with coding agents

`AGENTS.md` lists the commands that define "done", the architecture rules and the
safety rules. Claude Code additionally gets a PostToolUse hook that runs the tests
related to each edited file, a Stop hook that runs `npm run check -- --fast`, a
SessionStart hook that prints the project state, a permission allowlist for the safe
commands, and skills (`implement-requirement`, `debug-in-obsidian`, `add-feature`,
`write-obsidian-test`, `self-review`) in `.claude/skills/` (mirrored for Codex in
`.agents/skills/`). Start with [BRIEF.md](BRIEF.md), the product brief the owner fills in;
pull requests use `.github/pull_request_template.md`.

## Hosting and pull requests

This project is prepared for GitHub. `.github/workflows/ci.yml` runs the gates on every pull request and push to
`main`. End-to-end checks are opt-in and always run on `main`, this project's Release tier: the `ui` job (browser
journeys, UI review gallery) on a pull request labelled `e2e`, and `.github/workflows/obsidian.yml` (real Obsidian)
on a pull request labelled `e2e` or `run-obsidian`.
Pull requests use `.github/pull_request_template.md`. With the GitHub CLI (sign in once with `gh auth login`):

- `gh pr create --draft --fill`: open a draft pull request, then fill the template with real output.
- `gh pr ready`: mark it ready for review after the checks pass.
- `gh run list --branch <branch>` and `gh run view <run-id> --log-failed`: CI results.

## What is and is not done

- Generated: typed sources, stores, screens, navigation, browser composition and
  acceptance TODOs. Run the checks above against this exact generated project.
- Not done: the product behaviour behind each requirement, native qualification on
  other Obsidian versions or platforms, mobile support and store submission.
- Before publishing: set `author` (and optionally `authorUrl`/`fundingUrl`) in
  `manifest.json` and `package.json` if the project was created without `--author`,
  make the `description` your own (one sentence ending with a period, without the
  words "Obsidian" or "plugin"), then run `npm run check:submission`.

## Links

- [Implementation workspace notes](PROJECT-IMPLEMENTATION.md)
- [Build a feature](docs/framework/development/BUILD-A-FEATURE.md) and [makers](docs/framework/development/SETUP-AND-MAKERS.md)
- [Framework guide](docs/framework/development/FRAMEWORK-GUIDE.md) and [framework CLI](docs/framework/development/FRAMEWORK-CLI.md)
- [Framework README](docs/framework/README.md) and [maintainer rules](docs/framework/AGENTS.md) (reference)

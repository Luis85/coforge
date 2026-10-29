# Studio redesign: product and information review

- Date: 2026-10-28
- Scope: all 73 canonical view contracts, changed presentation code and its data sources.
- Method: independent source review after the implementation pass. This report covers product meaning,
  information ownership, data provenance, actionable summaries, privacy and recoverability. The root task's
  screenshot, keyboard, Axe, layout and contained-host runs provide separate execution evidence.

## Findings and improvement pass

1. **Decision counts could lead to an empty filtered board.** `BoardDecisionSummary.vue` counts the
   selected project's complete backlog, but initially changed only the status filter. A retained search,
   category or request kind could hide every counted item. The improvement introduces a dedicated
   decision shortcut that clears those unrelated filters before selecting Review or Flagged; ordinary
   toolbar filtering keeps its existing semantics. A regression begins with a search that matches
   nothing, then activates the summary shortcut.
2. **Council could display an ambiguous automation state.** `ProjectWorkContext.vue` uses the selected
   project's request-automation setting. Council execution has its own executor/pause policy. Its badge
   now says **Request automation paused/resumed**, keeping that setting distinct from Council execution.
   Council's shell scope is Vault workspace because reusable agents and cross-project monitoring are
   vault-wide; its project context still identifies the team/submission project.
3. **The backup heading understated export scope.** `SettingsDataSection.vue` originally called the
   surface Project data and its action Export JSON, although the private backup contains all projects.
   The improvement names **Backup and sample tools** and **Export private studio backup**. The canonical
   view goal now distinguishes the studio backup from the selected-project sample replacement. The
   replacement's exact-target confirmation, queued-work guard and preserved other projects remain intact.
4. **Unsupported broadcast copy promised an optional preview.** `BroadcastControls.vue` initially
   directed every unsupported host to a live-monitor example. That preview is an optional host capability.
   The improvement removes the unconditional promise and explains the actual Obsidian requirement.
5. **Navigation metadata and settings ownership were split across multiple lists.** Root labels, icons,
   groups, ordering, data scope and prerequisites now live in `studio-destinations.ts`. Settings sit with
   the tasks they configure. Shared channel tools no longer display a project/provider breadcrumb that
   implies their data is project-filtered. Projects has one current-page indication on its switcher.
6. **The bot setup hint named a control that did not exist.** The disabled Bot messages state now routes
   its instructions through the actual Twitch settings label. Command examples and composer placeholders
   no longer hard-code an unrelated community name; saved environment names remain authoritative.

## Data and action review

- **Request decisions:** counts derive from canonical project IDs and request statuses, not job attempts.
  Accepted requests use the shipped state; ready-for-review requests remain behind the existing review gate.
  Contextual actions navigate or filter and do not save definitions, dispatch agents or accept increments.
- **Recognition:** `buildCommunity` requires clear screening and excludes inbox, flagged and rejected
  ideas. Votes are deduplicated in the authoritative projection; accepted contributions derive from the
  shipped state. The new overview continues to say All projects and screened contributions.
- **Private viewers:** observed and registered totals use the same canonical player set. The unregistered
  shortcut clears search and selects the unregistered filter. Existing pagination watchers reset the page.
  Chat-presence time stays distinct from verified video watch time; moderation retains exact targets and
  explicit confirmation. Private notes, IDs and balances remain inside the private studio.
- **Operations:** the new count explicitly describes uncertain events in the retained historical log.
  It does not claim to count currently unresolved incidents. The shortcut filters that same retained log,
  while recovery remains in the owning tool.
- **Recordings:** mean/peak observed viewers and Twitch-message totals use `statisticsSummary`.
  Empty viewer observations remain null. Metric coverage counts available and null recorded observations;
  missing recorded minutes remain a separate measure. No missing interval is converted to zero and no
  official Twitch-analytics claim is introduced. Exact values, comparison scope and gap-preserving charts remain.
- **Finances:** actual income, expenses and balance keep month/stream filtering and EUR integer-cent
  arithmetic. Active recurring plans use the existing month cutoff and monthly equivalent; they remain
  channel-wide estimates and never generate payments. The redesign separates actuals from commitments.
- **AI usage:** known USD costs keep reported/manual provenance; unavailable and pending attempts remain
  visible and the total is labelled partial. Simulations and unknown token counters stay explicit.
  Failed/retried attempts are retained. No financial cash-payment inference is introduced.
- **External effects:** preparing a stream, saving a schedule or navigating tools does not imply going live,
  publishing or task completion. OBS/Twitch/Herdr unknown outcomes retain refresh/inspection and explicit
  recovery; provider delivery is not completion. Local music remains explicitly controlled.
- **Public boundaries:** capture surfaces still accept only `StreamSurfaceSource` projections; private
  studio context and capabilities are not added to them. The independent exported viewer site stays
  script-free and uses its public whitelist and restrictive CSP. Its standalone visual pass is separate
  from capture CSS. Integration secrets stay in the existing host secret-storage path.
- **Maintenance:** the 16 root route IDs remain stable. The exhaustive destination record is checked by
  TypeScript; canonical view coverage still rejects missing, stale and duplicate route mappings. Shared
  visual composition changes avoid creating another business-data or persistence source.

## Coverage of every documented view

This inventory was read from the current canonical catalogue. A shared child is reviewed in its owning
family, rather than incorrectly treated as a new host tab. Existing specialist recovery/editing controls
are preserved while their family's layout, hierarchy and state presentation are updated. Inventory
coverage is not a claim that live external integrations were exercised.

| View contract | Reviewed family | User outcome checked |
| --- | --- | --- |
| [activity](../components/views/activity.md) | Private studio activity | Open the request associated with a recent event. |
| [ai-costs](../components/views/ai-costs.md) | Insights / usage | Understand the known cost and usage of agent work. |
| [board](../components/views/board.md) | Build / request decisions | Choose the next request that needs attention. |
| [broadcast](../components/views/broadcast.md) | Stream / broadcast | Operate the current broadcast with explicit stream controls. |
| [broadcast-displays](../components/views/broadcast-displays.md) | Stream / broadcast | Open the read-only surface intended for OBS capture. |
| [broadcast-history](../components/views/broadcast-history.md) | Stream / broadcast | Inspect the archived record for a completed or active stream. |
| [broadcast-live](../components/views/broadcast-live.md) | Stream / broadcast | Keep the current broadcast running with visible health and explicit controls. |
| [broadcast-music](../components/views/broadcast-music.md) | Stream / broadcast | Choose and control the local audio for this stream. |
| [broadcast-scenes](../components/views/broadcast-scenes.md) | Stream / broadcast | Edit the exact OBS scene and its existing sources. |
| [broadcast-setup](../components/views/broadcast-setup.md) | Stream / broadcast | Complete connection and readiness checks before going live. |
| [community](../components/views/community.md) | Community / recognition | Understand who contributed to accepted progress. |
| [community-badges](../components/views/community-badges.md) | Community / recognition | Understand the milestones behind a contributor’s badges. |
| [community-profile](../components/views/community-profile.md) | Community / recognition | Understand one contributor’s credited progress. |
| [community-settings](../components/views/community-settings.md) | Community / rules | Save the community’s naming and earning rules. |
| [council](../components/views/council.md) | Build / Council | Choose a specialist collaboration task. |
| [council-definition-transfer](../components/views/council-definition-transfer.md) | Build / Council | Review a portable specialist definition before saving or sharing it. |
| [council-definitions](../components/views/council-definitions.md) | Build / Council | Save reusable specialists and project collaboration definitions. |
| [council-execution](../components/views/council-execution.md) | Build / Council | Choose whether this desktop may execute Council work. |
| [council-folders](../components/views/council-folders.md) | Build / Council | Save the vault folders used for Council definitions. |
| [council-inboxes](../components/views/council-inboxes.md) | Build / Council | Activate reviewed note intake for a project destination. |
| [council-messages](../components/views/council-messages.md) | Build / Council | Send bounded context or work to explicit team recipients. |
| [council-monitor](../components/views/council-monitor.md) | Build / Council | Resolve the next action or recovery decision for a Council run. |
| [council-plan-handoff](../components/views/council-plan-handoff.md) | Build / Council | Continue a validated Council plan in an existing request's project workflow. |
| [council-proposal-transfer](../components/views/council-proposal-transfer.md) | Build / Council | Review a portable v2 proposal workflow before applying it. |
| [council-recovery](../components/views/council-recovery.md) | Build / Council | Preserve or recover the selected run's retained execution evidence. |
| [council-submit](../components/views/council-submit.md) | Build / Council | Submit a reviewed note to the intended collaboration destination. |
| [council-workflows](../components/views/council-workflows.md) | Build / Council | Save an explicit proposal workflow for this project. |
| [finance](../components/views/finance.md) | Insights / payments | Maintain the private stream ledger. |
| [finance-entry](../components/views/finance-entry.md) | Insights / payments | Record or correct a single payment or recurring commitment. |
| [guided-setup](../components/views/guided-setup.md) | Stream / broadcast | Finish first-time OBS and Twitch readiness checks. |
| [help](../components/views/help.md) | Private studio guide | Learn the request-to-recognition loop. |
| [herdr](../components/views/herdr.md) | Build / execution | Dispatch an explicitly reviewed request to a verified ready agent. |
| [herdr-recovery](../components/views/herdr-recovery.md) | Build / execution | Resolve the uncertain outcome of a managed workflow attempt. |
| [idea-activity](../components/views/idea-activity.md) | Build / request decisions | Trace what happened to this request. |
| [idea-create](../components/views/idea-create.md) | Build / request decisions | Record a request in the selected project. |
| [idea-detail](../components/views/idea-detail.md) | Build / request decisions | Decide the next valid action for one request. |
| [idea-increment](../components/views/idea-increment.md) | Build / request decisions | Accept or reject the actual implementation changes. |
| [idea-overview](../components/views/idea-overview.md) | Build / request decisions | Understand and qualify the submitted request. |
| [idea-plan](../components/views/idea-plan.md) | Build / request decisions | Assess the proposed implementation before building. |
| [native-claude](../components/views/native-claude.md) | Native integration settings | Configure the local CLI used by agent execution. |
| [native-settings](../components/views/native-settings.md) | Native integration settings | Save the vault-wide integration configuration. |
| [native-twitch](../components/views/native-twitch.md) | Native integration settings | Connect streamer and bot accounts with required permissions. |
| [native-twitch-authorization](../components/views/native-twitch-authorization.md) | Native integration settings | Grant the selected account’s required Twitch permissions. |
| [native-vault](../components/views/native-vault.md) | Native integration settings | Choose where canonical idea notes live. |
| [native-website](../components/views/native-website.md) | Native integration settings | Prepare the read-only viewer website for publication. |
| [operations](../components/views/operations.md) | Insights / retained outcomes | Find the recorded outcome of a failed or uncertain action. |
| [population](../components/views/population.md) | Community / private directory | Inspect a viewer’s private participation record. |
| [project-create](../components/views/project-create.md) | Project selection | Create the canonical project identity and workspace configuration. |
| [projects](../components/views/projects.md) | Project selection | Choose or create the project whose backlog you will operate. |
| [public-chat](../components/views/public-chat.md) | Public projection / standalone export | Show the current Twitch conversation on stream. |
| [public-community](../components/views/public-community.md) | Public projection / standalone export | Explain visible participation and community rewards. |
| [public-kanban](../components/views/public-kanban.md) | Public projection / standalone export | Show the community the screened request backlog. |
| [public-leaderboards](../components/views/public-leaderboards.md) | Public projection / standalone export | Recognize visible community contributions. |
| [public-website](../components/views/public-website.md) | Public projection / standalone export | Follow screened progress and recognition outside Obsidian. |
| [schedule](../components/views/schedule.md) | Stream / schedule | Prepare a saved plan for a future stream. |
| [settings](../components/views/settings.md) | Build / project settings | Save this project’s brief and workspace boundaries. |
| [settings-data](../components/views/settings-data.md) | Build / project settings | Export a private studio backup or explicitly replace this project’s requests with sample data. |
| [settings-repository](../components/views/settings-repository.md) | Build / project settings | Set the repository boundary used by agent work. |
| [settings-runtime](../components/views/settings-runtime.md) | Build / project settings | Verify the native runtime is available for this project. |
| [statistics](../components/views/statistics.md) | Insights / recordings | Compare recorded audience and stream performance. |
| [stream](../components/views/stream.md) | Stream / conversation | Manage the conversation with viewers. |
| [stream-channel](../components/views/stream-channel.md) | Stream / conversation | Respond to viewers through the connected Twitch channel. |
| [stream-connection](../components/views/stream-connection.md) | Stream / conversation | Connect Twitch and inspect channel readiness. |
| [stream-messages](../components/views/stream-messages.md) | Stream / conversation | Maintain the recurring messages sent while live. |
| [studio](../components/views/studio.md) | Private studio frame | Reach the private workspace for the task at hand. |
| [twitch-channel](../components/views/twitch-channel.md) | Stream / conversation | Save the metadata viewers will see on Twitch. |
| [twitch-moderation](../components/views/twitch-moderation.md) | Stream / conversation | Review and confirm one specific Twitch moderation action. |
| [viewer-detail](../components/views/viewer-detail.md) | Community / private directory | Review a viewer’s private record and participation controls. |
| [workflow](../components/views/workflow.md) | Build / execution | Resolve the next execution decision for this project. |
| [workflow-runs](../components/views/workflow-runs.md) | Build / execution | Resolve the next checkpoint or attempt outcome. |
| [workflow-settings](../components/views/workflow-settings.md) | Build / definitions | Save the process that new requests will follow. |
| [workflow-step](../components/views/workflow-step.md) | Build / definitions | Configure one stable workflow step. |
| [workflow-transfer](../components/views/workflow-transfer.md) | Build / definitions | Review a portable definition before replacing or sharing it. |

## Evidence and limits

- IA test-first run: 2 assertions failed and 1 passed before the sidebar/scope implementation, for the
  duplicate settings entries and misleading shared-workspace breadcrumb.
- Targeted final IA/catalog/navigation run: **3 test files passed, 12 tests passed**.
- `npm run typecheck`: exit 0 for the IA implementation.
- Targeted ESLint on the new root contract, shell composables/templates and IA tests: exit 0.
- `node tooling/coforge/view-catalog.mjs` and `--check` after the backup-scope polish:
  **73 views documented; navigation coverage valid; sitemap generated/current.**
- The root task records full qualification and final visual/host results after all agents finish. Live
  Twitch, OBS, Claude and Herdr accounts were not used for this review. Screenshots alone cannot establish
  accessibility compliance; automated and keyboard evidence belongs to the separate browser checks.

## Cleanup appendix: provenance, data safety and recovery review

The owner additionally requested removal of persisted sample/local-simulator content while preserving
manual and Twitch requests, including real requests processed by simulated AI. This appendix records
an independent contract/threat review. Final implementation verification is recorded after the cleanup
code and storage tests land; the design statements below are not claims of passing runtime evidence.

### Accepted boundaries

- Request provenance belongs to a private application registry populated at trusted intake. A provider
  label, contributor prefix, request ID, title or note-authored property is insufficient proof by itself.
  Manual `StudioService.createIdea` previously used ChatSource simulator, so it needs an explicit manual
  origin separate from simulator chat intake. Twitch/API sources retain their actual transport origin.
- Tracked sample/local-test requests may be proposed automatically. Full-content legacy seed matches
  remain visibly unproven and unchecked; other unknown content is preserved unless the operator
  explicitly identifies an exact target. Preview selection must be revalidated inside the serialized
  transaction and cannot accept a forged manual/Twitch ID as an automatic candidate.
- Project containers are retained in this increment. Deleting an empty in-memory project without its
  canonical project note would make it reappear on reload; deleting the note could affect genuine
  project configuration, definitions or history beyond request cleanup.
- Next request/project numbers and external-message deduplication evidence remain monotonic/durable.
  Cleanup cannot enable identifier reuse or replay a previously observed Twitch/API command. Retained
  requests keep their votes, contexts, authored body, contributors and genuine history.
- Known pending jobs, nonterminal request workflows and unresolved native effects block mutation.
  Failed/cancelled Herdr jobs alone do not establish that an external agent stopped; retained managed
  recovery records need their own guard or explicit preservation boundary.

### Storage cases raised for the improvement pass

1. **Own-file events:** staging and rollback must suppress the storage adapter's rename/delete observers,
   otherwise a failed cleanup can enqueue a later request-removal transaction after rollback.
2. **Crash between stage and commit:** an in-memory rollback is insufficient. Persist an intent before
   moving any file, bind it to before/after state hashes, and recover before normal Markdown discovery.
3. **Private complete-note receipts:** preview and staging compare SHA-256 of full note bytes, including
   unrelated frontmatter and body text. Exact IDs resolve the target; a directory prefix never authorizes
   deleting all files in a folder.
4. **Commit point:** after the new studio JSON is committed, failure to trash an archived file cannot
   report the whole transaction as uncommitted. Retain the private archive and publish committed state;
   otherwise a subsequent save from the old in-memory state could recreate removed requests.
5. **Archive discovery and publication:** the agreed private archive uses a non-Markdown extension under
   `CoForge/Recovery/ExampleCleanup`, keeping it out of idea-note discovery even with unusual folder
   settings. Reserve `CoForge/Recovery` as a private folder in layout validation so a custom public export
   cannot overlap complete private archives. Plugin-journal filenames follow existing private ignore rules.
6. **Concurrent edits and partial failures:** reject a stale preview and preserve the newer note; roll
   staged notes back on precommit storage failure. Do not overwrite a conflicting replacement note during
   recovery. If state hashes match neither captured before nor after, retain evidence for explicit recovery.
7. **Secondary references:** only remove local profiles that have no retained authorship, voting, context,
   reward, moderation or history references. Preserve genuine balances and rewards. Historical counters
   and external sidecar cost/recovery evidence are not safely reconstructible by subtracting sample counts.

### Required focused evidence

- Manual and Twitch requests survive even when their screening/increment provider is Simulation.
- A manual author sharing a simulator identity with test chat remains intact.
- Unknown legacy requests stay selected off by default; stale or forged selections perform no writes.
- Partial staging, project-write failure and studio-JSON failure preserve notes and committed state.
- Crash recovery before and after the JSON commit behaves consistently; trash failure retains an archive
  without resurrecting removed requests or issuing duplicate committed events.
- A custom public folder overlapping Recovery is rejected; unrelated notes and body bytes survive.
- Cleanup does not resume automation or invoke external providers, and emits its named fact only after
  successful persistence. Temporary example exits remain explicit and are separate from stored-note cleanup.

### Cleanup implementation recheck

The new [Example content cleanup](../components/views/settings-example-cleanup.md) panel is a 74th
current contract in addition to the original 73-view redesign inventory. Its preview exposes exact
tracked request IDs, unchecked historical candidates, retained project containers and real-cost evidence.
Manual/Twitch provenance is preserved separately from simulated agent providers.

The concrete adapter now uses full-byte SHA-256 receipts, a linear duplicate-ID index with a mutation
recheck, a durable staged-note journal, suppressed own-file events, startup rollback/finish, an explicit
committed journal phase and a before-save settlement check. `CoForge/Recovery` is reserved as private.
Native preflight archives AI-cost evidence before deleting jobs and returns a scoped lease held through
the transaction. Cleanup has a declared `example-content-removed` post-commit operation.

The root reports 18 focused storage/recovery/host tests passed, including crash-before/after-commit,
post-commit receipt failure followed by an ordinary write, duplicate identity introduced after preview,
exact rollback bytes and retained archive warnings on trash failure. This reviewer inspected the source;
the root task retains the actual test output and final qualification evidence. Browser-preview receipts
and simulated-AI preservation assertions were requested from the Build owner for the final pass.

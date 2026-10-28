# View intent and UI/UX review

Review continued on 28 October 2026 (Europe/Berlin). The task began on 27 October.
This increment retains CoForge's Obsidian-native appearance and makes each view's
task, action and recovery clearer. It also adds per-project workflow-step provider
and model configuration; execution restrictions and streamer review stay enforced.

## Evidence and method

Fresh captures for this review are under `reports/ui-intent/before/` and `after/`.
The local `reports/ui-intent/review.html` presents numbered screenshots and notes;
contact sheets summarize all private/native destinations in both themes. Individual
workflow, menu, finance, cost and schedule captures were inspected at readable size.
Screenshots are ignored review artifacts, never approved baselines or committed data.

The repository-authorized headless browser harness was used because the desktop
controller was unavailable and the contained Obsidian host is not provisioned locally.
Captures use the product's real Vue components with explicit synthetic preview data.
The prototype's outer “Clickdummy / No authored route” controls are harness chrome,
not shipped CoForge views, and were not treated as product copy.

One batched audit preceded the polishing pass. One full confirmation batch covered
all destinations; a targeted functional rerun corrected menu test targeting and an
introduced navigation cascade regression. No timeouts, assertions or thresholds
were weakened. The final mechanical Impeccable detector returned `[]`.

## Every view has a task

Evidence numbers correspond to screenshot filename prefixes in the before/after folders.
Private/native destinations 01–15 were captured at 1280px and 360px in light and dark.
Workflow's initial reflow failure stopped its baseline after the light captures;
confirmation includes both themes. Setup has all five steps plus narrow review.

| Step / view | User goal | Main action / next step | Review outcome |
| --- | --- | --- | --- |
| 01 Stream studio | Prepare OBS/Twitch, go live and monitor health | Guided setup → Prepare → Go live; explicit pause/stop | Clear preparation and live controls retained; disconnected values remain unavailable |
| 02 Stream statistics | Inspect recorded metrics and compare shows | Select stream/metric/comparisons; no-history action opens studio | Clear goal, empty-state recovery and unavailable values retained |
| 03 Stream finances | Record EUR income, actual expenses and recurring plans | Add/edit/save an entry; recurring plans remain separate from payments | Consistent gutters and forms retained; operating editor inspected in 21 |
| 04 AI costs | Understand feature/task usage in USD and missing coverage | Filter a feature; inspect attempts; add a missing manual cost | All-missing feature summaries now say Unavailable; keyboard table scrolling added |
| 05 Stream schedule | Plan a show, keep its script and prepare tools explicitly | New/save plan → open note → review individual preparation steps | Date/project/tool controls remain explicit; operating plan inspected in 23 |
| 06 Idea board / Backlog | Prioritize requests and move a selected request through work | New request or card actions | Goal line added; board is the first navigation destination; proper menu in 24 |
| 07 Stream chat | Connect Twitch, speak with viewers and manage the bot | Connect/send; recurring-message tab | Heading now matches destination; concise goal replaces ambiguous Channel heading |
| 08 Agent workflow | Configure stages, dispatch work and inspect attempts | Configure step; Run next; pause/resume automation | Narrow heading overflow fixed; actual stage provider/model shown; disabling Auto remains available |
| 09 Community recognition | Inspect contributors, earned badges and accepted work | Choose ranking and contributor | Vague motto removed; concrete goal and all-project scope clarify its distinction from viewer management |
| 10 Viewers and players | Inspect profiles, private notes, game stats and participation | Select viewer; moderation controls; open note | Goal added; empty directory opens chat; filtered empty results can be cleared |
| 11 Operations | Troubleshoot recorded events and failed actions | Filter event/effect; export safe diagnostics | Task wording distinguishes this from audience statistics; clear-filter recovery added |
| 12 Projects | Create workspaces and choose a backlog | Add project; open board; project settings | Goal copy shortened; existing project IDs, paths and actions retained |
| 13 Community settings | Name actors/currency and define rewards/ranks | Save community settings | Existing shared scope, validation and save/discard behavior are clear and retained |
| 14 Project settings | Configure the selected project's workspace and agents | Save settings; configure a workflow step; preview dispatch | Step provider/model inheritance and effective selection are explicit; dirty external-change recovery added |
| 15 Native plugin settings | Set vault-level integrations and credential references | Save changes; connect Twitch; check executable | Existing boundary from per-project settings is explicit and retained |
| 16 Guided setup | Complete tools, OBS connection/scenes, Twitch and readiness review | Follow five steps; finish only when ready | All five steps inspected; unsafe completion remains disabled in disconnected preview |
| 17 Public Kanban | Let viewers follow screened requests for the pinned project | Read-only display | Public projection and stable-title/capture boundary retained |
| 18 Public chat | Show current live Twitch messages without private simulation | Read-only; explicit connection waiting state | Clear waiting copy; no local test messages or editing controls |
| 19 Public leaderboards | Show community support, ideas and accepted contributions | Read-only rankings | Singular count labels corrected; responsive stacked rankings retained |
| 20 Public community | Recognize contributors' earned badges | Read-only recognition | Named community actor and earned badges retained; no private profile data |
| 21 Finance operating state | Enter a payment and see actual totals/list | Save entry; edit/delete recorded entry | Manual actual payment flow verified with synthetic entry |
| 22 AI-cost operating state | Fill a missing task cost without disguising missing data as zero | Focused manual-cost form; keyboard-scroll table | Missing feature amount, source labels and scroll access verified |
| 23 Schedule operating state | Save a concrete show and retain its topics/script | Save plan; open note; explicit preparation review | Saved script visible; plan does not trigger live side effects |
| 24 Card action menu | Act on the exact request under the pointer or keyboard focus | Open/copy/vote/next step/review; disabled reasons visible | Replaced transparent inline presentation with a themed floating menu |

## Findings and the polishing pass

| Finding | Impact | Change and verification |
| --- | --- | --- |
| Flat navigation mixed live operation, development, community and records | Finding a task required scanning unrelated destinations | Grouped Build, Stream, Community and Insights; preserved labels/landmark and put Idea board first |
| Generated outer-workbench nav styles leaked a 12rem basis/column into nested controls | New sidebar scrolling could hide destinations despite free space; tabs/pagination could inherit the wrong layout | Explicit owned sidebar flex policy and a minimal inner-nav reset; geometry test keeps footer tools reachable and removes blank navigation space |
| Several entry headings described content vaguely | View purpose was unclear, especially Channel/Community/Operations | Short task-specific goal lines; concrete recognition/troubleshooting wording; no new mission banners |
| Workflow headings clipped automation controls at 360px | The control and title competed with Configure step | Narrow two-row grid preserves title, action and toggle; full reflow assertions pass |
| Context menu content escaped `.ps--coforge` into the body | Menu was transparent, unthemed and an inline list of buttons | Nuxt/Reka receives the card's owner-document portal root; explicit vertical surface/group/item styles, collision bounds and readable descriptions |
| Earlier menu test checked only roles after closing | Visual menu failure was missed | Open-menu tests assert scope, background, vertical geometry and viewport fit in both themes; 360px edge, keyboard, Escape and actual outside-pointer dismissal checked |
| Menu action gates assumed the project-wide provider | A real per-stage selection could appear runnable in Simulation-default projects | Menu resolves the request's parent project and stage configuration; unavailable Claude stage is disabled with its reason |
| Review menu actions could be mistaken for approval shortcuts | User intent must remain an inspect/review action | Review opens the saved increment; request remains in progress and no acceptance is invoked |
| All-missing AI feature summary showed `$0.00` with a partial note | Missing usage could be read as a free feature | Feature amount is Unavailable until at least one cost is known; genuine reported/manual zero remains zero |
| Narrow AI table lacked a discoverable keyboard scroll target | Provider/status/cost columns were difficult to reach | Named, focusable scroll region and narrow-screen cue; ArrowRight scrolling verified |
| Viewer/event empty-filter states offered no recovery | User could remain stuck on an empty result | Clear-filter buttons added; a new viewer directory has a working path to connect chat |
| Source project/config refresh could overwrite an unsaved settings draft | Data-loss and cross-project save risk | Parent added source identity/revision guards, preserved dirty drafts and guarded asynchronous save feedback; focused tests cover failure and switching |
| Provider labels could imply a single project-wide runner | Mixed steps were misleading | Effective stage labels and Mixed providers summary; simulation is not described as a real model call |
| Status indicator was verbose/clickable and chat/sticky save could overlap the host bar | Important controls competed with Obsidian chrome | Parent/status agent made status text compact/read-only and use actual owner-document bar overlap; headless inset remains zero |
| Expanded board chat inherited full-page minimum heights and its history forced setup controls below a short pane | Configure Twitch was clipped more than 100px below a 430px studio pane | A regression reproduced the clipping; board chat now fits its pane and scrolls context/history separately from its fixed composer; targeted panel/Markdown regressions pass |
| Public ranks used plural units for one contribution | Low-quality audience-facing copy | Singular vote/idea/accepted-build formatting corrected |
| Studio content nested a second main landmark inside the workbench main | Assistive navigation could expose duplicate primary landmarks | Inner work surface is a named section; standalone public displays retain their main landmark |

Strengths retained: native theme variables; stable IDs; meaningful offline states;
explicit simulation examples; no inferred missing metrics/costs; independent EUR/USD
records; note-backed persistence; private/public separation; explicit stream control;
mandatory human review and backend action gates.

## Verification and limits

- Initial broad audit: 14 cases passed, workflow reflow assertion failed for the actual
  clipping defect; the pre-existing all-display axe journey timed out under shared load.
- Supplemental baseline: 8 setup/public/operating cases passed (56.7s).
- Full confirmation: 25 view/goal/reflow/navigation/empty-recovery cases and all 3
  provider/model cases passed. Three new menu cases needed corrected test targeting:
  actual outside-pointer input instead of clicking a modal-inert underlay, and the
  existing pressed-button pattern instead of assuming ARIA tabs.
- Targeted functional confirmation: all 5 menu/navigation cases passed (26.8s).
- Final mechanical detector over changed UI targets: `[]`.
- Parent runs the mandatory full project, browser, UI-quality, gallery and contained
  native-Obsidian gates after integration; their final-head results belong in the PR.

Screenshots and DOM checks do not prove full screen-reader compliance. No personal
vault, live Twitch mutation, paid agent dispatch, OBS broadcast or actual audio
transmission was used for this review. Native status/portal behavior is checked in
contained host CI. The initial/confirmation matrices focus on each primary view,
setup steps and representative operating states; established scene, music, Herdr,
bot-message and moderation journeys remain part of the full regression suite.

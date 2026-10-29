# Merge integration: Council scheduler and native MCP settings

- Status: implemented; parent owns merged full-project/native/exact-head CI qualification.
- Upstream: main b9f2a5d, MCP and scheduled tasks (#30).

## Integration contract

Council keeps Ask and ingested-task history as its main landing page, one shared heading/project context and the collapsed Advanced Council tools hierarchy. Task scheduler is a local advanced task; it does not become another global sidebar destination. The incoming Economy entry in view-intent coverage remains intact. The two incoming canonical view records bring the catalog to 87; the parent regenerates sitemap artifacts.

The scheduler keeps recipient routing, saved timezone, recurrence, paused execution, explicit enablement and uncertain-admission recovery visible. Navigation preserves its per-leaf draft and never runs a task. Its example is the ninth temporary family, alongside finance, AI costs, schedule, statistics, live studio, music, Council and Herdr. Explicit scheduler exit, Council example exit and successful global example cleanup discard only example state and dispose the cached scheduler timer. Authored native schedules and unsaved native-port drafts stay intact.

The native MCP panel uses the existing settings rows and a semantic panel boundary. Copy explicitly distinguishes activated external-client access to requests/workflow tools across private projects from public viewer visibility. Registration paths, preservation of unrelated entries and manual recovery remain visible. Browser activation/deactivation stay unavailable; no personal client configuration was changed during browser qualification.

## Test-first and qualification evidence

- New scheduler example test was RED for the missing Exit action; its native-port preservation case already passed. After integration: **4 files / 6 tests passed (14.01s)**, covering the scheduler example lifecycle, authored schedules/drafts, existing assigned-member weekly UI, MCP activation/error/recovery behavior and default Ask/no-dispatch behavior.
- Fresh merged browser qualification: **4 cases passed (54.1s)** for scheduler light/dark and MCP panel light/dark. Scheduler checks draft retention, invalid IANA recovery, explicit assigned-member routing, exact weekly recurrence, paused save, archive and exit/cache reset. MCP checks explicit trust copy, unavailable browser actions, wide/narrow reflow, unobscured control hit testing and Axe.
- Additional explicit global-cleanup case passed in the preceding merged batch, proving an inactive scheduler example draft does not survive successful cleanup. That batch's other scheduler cases used an incorrect test heading label; the corrected semantic Ask-region selector passed in the fresh rerun without changing assertions or timeouts.
- Scoped ESLint exited **0** with no output. `git diff --check` was clean.
- Follow-up provenance review captured two RED assertions: a selected MCP run still claimed native automatic steps/provider, and MCP screening was labelled Claude Code. The summary now names external MCP/explicit client calls and excludes native automatic-step/cadence promises; its tooltip retains captured native definition details. Screening identifies the actual external MCP client. Focused regression: **4 files / 6 tests passed (11.13s)**, including unchanged genuine native counts/providers and no writes or dispatch on rendering. Follow-up scoped ESLint exited **0** with no output. ProjectWorkSummary already labels project request automation separately and needed no change.
- Reviewed screenshots: `reports/task-scheduler/{form,saved}-{light,dark}-{1280,360}.png` (8), `reports/merged-native-mcp/panel-{light,dark}-{1280,360}.png` (4). The MCP screenshots center the panel before capture so the persistent settings save bar does not obscure its controls.

## Scope limits

These MCP images are browser-rendered native-settings components, not evidence of a real Obsidian activation. Native activation/error/recovery is exercised through the in-memory host kit; this agent did not write the user's client configuration. Root reports the locally unprovisioned real host and owns the contained native/CI gate. Pre-merge full-project results are baseline evidence only; merged qualification is tracked separately.

## Final native drawer visual audit

The real-native Request Object case on f5bcaaa passed its behavioral checks but its
settled `final.png` showed four full-width section-tab rows consuming about 190px.
Bounded native HTML/CSS inspection found the generated-workbench generic `nav`
column direction and 12rem flex basis overriding the lower-specificity drawer
rule. The earlier named screenshot also captured the 0.22-second enter animation;
the settled image was opaque, so animation and background styles were preserved.

The scoped drawer navigation now declares row/wrap, natural flex basis, responsive
horizontal spacing and auto-width buttons. Browser tests reproduce the native
cascade specificity, then measure tab coordinates, natural widths, spacing and
overflow at 1280/480/360 in both themes. Both cases went RED on computed `column`
direction; the final run passed **2 cases (26.8s)**. Reviewed wide/light and
narrow/dark images under `reports/idea-drawer-layout/` (six captures). Scoped
ESLint returned **exit 0**; diff checking was clean.

The existing native Request Object case now waits for opacity 1, verifies an
opaque surface and checks four compact same-row, naturally sized and separated
tabs before its screenshot. The generic attention heading is now “Request needs
attention”, which also describes edits invalidating prior request evidence before
any run. Actual error details are retained. Root owns the fresh native/CI rerun;
the old green native result is not substituted for the added geometry assertion.

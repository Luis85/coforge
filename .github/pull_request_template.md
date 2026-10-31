## Summary

Native Builds were tied to Obsidian's foreground process and short-step timeout. CF-135 stopped after roughly three minutes despite retaining a real partial increment. This increment adds opt-in native background Builds that keep their original process, workspace and evidence after Obsidian closes, then reconcile the result once on reopening.

Build and short-task lanes have independent vault-wide limits of 1–16, defaulting to one each. Workflow steps capture their execution policy, optional elapsed deadline, advisory inactivity warning and explicit resource overrides. Existing attempts retain their policy and are never silently resumed. Vault integrations configure native Node 22+, worker readiness and both limits.

The worker uses a versioned bundled Node module, authenticated loopback IPC, private atomic journals and scoped file tools. Host persistence precedes paid start; canonical result persistence precedes ACK. Stop keeps the Inbox hold, recovery binds actual workspace/process evidence, and retained authorization/tombstones prevent replay across worker generations. Qualified native read-only follow-ups use the original worktree through a broker; foreground writers cannot adopt it. Managed notes remain protected even when tracked copies exist in the repository.

The activity panel now wraps long events inside its viewport, aligns markers/actions/timestamps, and preserves request links, keyboard closing and focus restoration. Missing workflow metadata no longer hides a retained job's cancellation control.

## Requirements and traceability

Owner requests in BRIEF.md. The scaffold has no req-* or vi-* obligations for this increment; no IDs were invented. The implementation and eight-increment improvement/polishing plan are recorded in docs/project-tasks/2026-10-31-durable-build-execution.md. Three implementation agents and independent cross-reviews drove the work; PR58's board-outline polish is integrated as the base.

## Validation

- `npm run verify:project`: passed on final project-profile wiring. Check summary: **5 passed, 0 failed, 0 skipped in 1035.3s**. Product report: **1,702 passed, zero failures, six existing Windows skips**. Release build passed (2,003 modules); prototype embedding **1 passed**. UI effects explicitly skip because no visual definitions are declared.
- `npm run test:ui-quality`: **8 passed** (1.0m). `npm run ui:gallery`: **40 captures, zero failures**. Wide/narrow and light/dark gallery views, captured policy and native activity images reviewed; no baselines updated.
- Project-only worker-hook registration: **6 existing unit tests and 11 focused product tests passed**, focused lint passed, and release `main.js` was byte-identical before/after relocation. Shared framework tooling has no final diff.
- Simulated **101-hour** quiet execution, explicit long deadline, bounded high-volume child output, independent lane concurrency/reduction, and **1,000 hot polls with zero extra canonical saves** are covered. Subscriber delivery retains the existing snapshot isolation contract.
- Real detached worker/Git/broker proofs cover protected managed folders, scoped edits, host absence, original-reference completion/ACK, lost replies, generation replay, Stop races, changed evidence, verified empty captures, missing metadata, readonly follow-ups and conservative process identity.
- `npm run -s dev:obsidian -- --json --port 9322`: **passed** on pinned Obsidian **1.14.4**, launcher **3.2.1**, after reload; `errors: []`, `hostErrorCount: 0`, `pluginConsole: []`.
- Full `npm run test:obsidian`: **55/55 passed across 48 files** (617.80s), zero failures/pending, all 55 teardowns completed and 56 owned sessions stopped with no live owned PIDs or capture errors. The new native cases prove actual Obsidian quit/reconnect with one original fake-provider admission, and policy/Node/lane save+reload plus activity bounds/focus with zero jobs.

Independent review found and repaired cross-generation authorization replay, delayed prepared inspection starting after Stop, capacity configuration blocking original cancellation/ACK, missing-metadata control loss, stale empty-worktree previews, and native follow-up workspace rejection. Behavioral regressions failed before the fixes. The final source is frozen during qualification.

## Evidence and limits

Ignored local evidence: reports/durable-final-project/, reports/durable-final-ui-quality/, reports/durable-final-ui-gallery/, reports/durable-config-hook-qualification/, reports/durable-ui-evidence/, reports/obsidian/ and .obsidian-sandbox/logs/.

No billable vendor call or paid 100-hour soak, live CF-135 retry, personal-vault launch, live OBS/Twitch mutation, mobile qualification or alternate Obsidian version. Closing Obsidian differs from OS/provider failure: unknown process trees and startup without trustworthy original identity/exit evidence remain quarantined. No automatic paid-session resume is claimed. Final human review is still required for actual changes.

No dependencies or audit exceptions were added. Local Node/npm are **24.20.0 / 11.21.1**; CI uses repository pins **24.21.0 / 11.19.1**. The `e2e` label must qualify full browser/native suites, and every final-head check must be green before merge.

## CI layout follow-up

The first complete browser qualification passed 234/235 cases and exposed a narrow Timing & limits action overflow. Scoped execution-overview wrapping and a narrow single-column row repair it. The original one-pixel overflow tolerance is unchanged. The original case now also checks a valid 96-character step name and keyboard return to the same draft.

Fresh targeted proof: original failing journey passed (54.1s); durable/long-name/UI-quality batch **11/11 passed**; timing product tests **3/3 passed**; contained native save/reload/long-name Timing/action test **1 passed** (15.61s). Typecheck, focused lint, diff and token checks passed. A scoped UI-source scan returned zero findings. The optional whole-repository style-literal diagnostic reports ten unchanged raw palette colors in generated/styles/design-system/colors.css; the generated file, allowlists and thresholds are unchanged. Fresh final-head GitHub qualification is required after this fix.

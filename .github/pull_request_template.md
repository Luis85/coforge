## Summary

New implementation-authorized workflow attempts can code and run project checks in their dedicated Git worktree using normal native tools and provider-owned subagents, without a Docker recipe. Existing admitted attempts retain their captured permissions and legacy verification.

MCP coding tasks gain dependency-file edits, optimistic patches/moves, managed commands, stable replay-safe keys, command discovery/polling/cancellation, generated image inspection, captured diffs and compact request status. Internet research is explicitly allowed: Codex live search/workspace networking, Claude native web research tools, and MCP commands through normal desktop connectivity.

Windows process jobs own SDK/command descendants before input is released. Completion, cancellation, owner loss and recovery require original lifetime proof before release. Unknown ownership retains quarantine and skips moving-workspace capture. Safe failure details and known cumulative usage survive interrupted native continuations. Private ownership references and credentials stay out of model-facing replies.

The UI distinguishes ordinary native/MCP coding from legacy Docker evidence. Instructions preserve branch/HEAD and leave edits uncommitted for host capture. Human acceptance remains in Obsidian.

## Traceability

Owner decisions: BRIEF.md. Task: docs/project-tasks/2026-11-01-native-worktree-coding-and-mcp.md. No requirement or vi-* entries exist for this increment; none are invented or marked implemented. CF-133 guard/failure/cost changes shipped separately in PR #65.

## Validation

- Initial local npm run verify:project: typecheck/source/maker gates passed; one fixture ESLint error and a 30-minute product-test timeout failed. The missing await and stale disclosure assertion are corrected with focused rechecks passing; a frozen full product rerun is in progress. Pinned CI on 17563e91 passes all 2,227 product tests and the complete canonical project gate. A frozen local full product rerun also passes 2,221 tests with six existing platform skips and zero JUnit errors (553 files, 1,842.76s); this exceeds the original local 30-minute gate deadline. Final immutable-head results are tracked on PR #66 before merge.
- Real Windows production-controller suite: 11 passed, zero skipped, 27.21s. Covers owner loss, startup capture failure, descendants, quoted paths/arguments, exit 7, MCP replay/settlement and a durable Claude continuation.
- Installed Claude 2.1.281 and Codex 0.145: actual native child/files/passing shell/root result/captured diff/known job quiescence passed. Claude: 8 local fake API requests, 18.205s. Final live-search Codex: 5 requests, 13.859s; global/project instructions, skills and network marker observed. Zero real model calls.
- Production MCP external HTTPS probe: official TypeScript documentation, HTTP 200, complete response, actual exit 0 and confirmed quiescence. Public internet is not a deterministic CI dependency.
- Focused MCP command/runner/workflow: 21 passed. Image/server/path boundary: 32 passed, including real VP8/VP8L/VP8X and malformed/oversized artifacts. Journal byte-budget regressions: 7 passed. Native integration: 11 suites, 40 passed; research flags/guidance: 5 passed.
- Final research-copy UI quality: 8 passed; refreshed gallery: 40 captures, zero failures, all reviewed. Final contained pinned Obsidian authoring/evidence: 2 passed, 35.79s; 12 captures reviewed. Fresh load/reload: status passed, errors [], pluginConsole [], hostErrorCount 0 on Obsidian 1.14.4 / launcher 3.2.1; hosts stopped. The prior full browser and real-Obsidian CI runs also passed.
- Whole TypeScript and scoped zero-warning ESLint/source checks passed. Independent release review identified unknown-lifetime moving capture; stronger regressions failed before its fix and now pass.

## Boundaries and untested scope

Windows lifetime is locally qualified under a normal nonadmin account. Hosted diagnostics identified compiler DLL initialization failure 0xC0000142 under the restricted CI process. A local causal probe reproduces this with an admin-only default object DACL on a NEW restricted token, then restores Node/CLR startup using same-user/SYSTEM access. The simplified test-only launcher normalizes only that NEW token's DefaultDACL, uses the normal desktop, and retains medium-integrity/admin-disabled readbacks. It changes no original token or global object permissions. Unnecessary owner changes and private desktop resources were removed after the hosted causal probe. Normal-user fresh-cache qualification passes 11/11 locally; the hosted administrator-parent launcher branch still requires actual CI proof. Unsupported platforms fail explicitly without an unowned fallback. A worktree is not an OS sandbox; desktop/provider permissions, proxy, certificates and site policies apply. Research allowance is not evidence that a site was reached. SDK observations/exit codes are not independent coverage, source-freshness proof or human acceptance.

Existing CLI authentication/global context stays in place; no OAuth copy, global provider install, administrative setup or permissive fallback. External MCP model cost remains unavailable. No live CF-133 attempt or personal vault was inspected, retried or changed; the historical empty-log failure cannot be reconstructed.

Local Node is 24.20.0; CI uses repository pins. The inherited broad compiler-test module lacks a baseline feature-showcase fixture; the standalone disclosure-emitter regression passes and generated/emitted keyboard specs are synchronized. No skipped test is claimed as acceptance.

Ignored evidence: reports/native-worktree-coding/, reports/native-process/, reports/ui-gallery/ and contained .nq/ fixtures. No reports, screenshots, dist, native caches, private data or compiled controller binaries are committed.

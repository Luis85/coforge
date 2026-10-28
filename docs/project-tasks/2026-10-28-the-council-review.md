# The Council: independent review and improvement pass

Status: complete. All listed material findings are resolved; final automated gates passed.

The owner requested a thorough review from all product perspectives after
implementation, followed by improvements and polishing. Three fresh, read-only
reviewers inspected product/PRD coverage; security, privacy and reliability; and
UX, accessibility and operations. They reviewed actual files, fault-injection
tests and all 20 Council light/dark/wide/narrow captures. No redesign was requested.

Native Obsidian and live-provider qualification remain unavailable; the owner
explicitly accepted continuing without native verification. Review findings below
are code/behavior findings, separate from those qualification limits.

## Findings and regression plan

| ID | Priority | Finding | Improvement and regression |
| --- | --- | --- | --- |
| P1 | P1 | Human checkpoint choices were saved but missing from subsequent agent input. | Carry only acknowledged preceding human decisions as attributed `checkpoint-only` input; test planning and explicit message transformation. |
| P2 | P2 | Ordinary Draft/Ready properties did not match the displayed operator promise. | Support explicit state controls and typed ordinary-note properties; preserve unknown YAML/body; frontmatter-only notes remain pending. |
| P3 | P2 | Switching projects replaced unsaved v2 workflow drafts. | Keep drafts by project with explicit discard and stale-response protection; test A → B → A. |
| P4 | P2 | An unavailable target could prevent disabling its inbox or editing unrelated bindings. | Validate target execution availability for changed/new enabled bindings; preserve schema/folder checks; allow recovery of stale bindings. |
| P5 | P2 | A final contribution could finish above its configured artifact cap. | Capture and enforce the contract before response acceptance and projection; test direct and composed final contributions. |
| P6 | P2 | Rejected agent messages retained no actionable reason. | Store safe typed rejection codes/reasons with the contribution and display them without exposing raw errors. |
| P7 | P2 | Definition resolution repeatedly enumerated the whole vault during execution. | Event-invalidated definition index with current-note validation; test complete invocation paths against unrelated-file reads/scans. |
| P8 | P2 | A run with a skipped member was labeled completed while work remained. | Show its actual queued/running state plus missing contributions; reserve Completed with gaps for terminal completion. |
| S1 | P1 | A source moved into public exports could receive private results. | Revalidate the live source/destination before dispatch and inside every atomic publication/repair; test queued and in-flight moves. |
| S2 | P1 | JSON escaping could produce an accepted journal that its decoder rejected. | Use a bounded compatible envelope; round-trip a heavily escaped near-capacity journal. |
| S3 | P1 | Cancelling work did not reliably stop pending/admitted descendants or late message intents. | Persist causal cancellation and fence commit, delivery and child dispatch; retain late provider evidence. |
| S4 | P1 | Retries before the first outgoing message were missing from root invocation accounting. | Reserve initial expansion plus prior retries atomically when the root ledger is created; test child allowance after retries. |
| S5 | P2 | Execution time incorrectly included queue, pause, checkpoints and unloaded intervals. | Persist consumed automatic/provider-wait allowance, separate message expiry and enforce root/child limits; test excluded and charged intervals. |
| S6 | P2 | Editing an earlier block during the final invocation could evade conflict detection. | Validate all existing journal-backed sections inside `Vault.process` before appending; preserve both human edit and final artifact. |
| S7 | P1 | A later public-folder setting could overlap a previously registered custom Council private folder. | Carry the private-folder registry into studio/storage/publisher validation; reject configuration and publication before writes; four regressions reproduced then passed. |
| S8 | P1 | Model-written cost/token fields could enter a trusted response when provider telemetry was absent. | Strictly validate model payload separately; accept cost/usage only from the CLI envelope. Reject fabricated counters and preserve unknown telemetry as unknown. |
| S9 | P1 | A real council whose ID began with `direct-` could be mistaken for a direct agent and evade council revocation. | Persist an explicit host-assigned target kind and check it instead of a naming convention; the regression reproduced Completed after revocation before the fix. |
| U1 | P1 | Definition switching/create/duplicate/archive could discard unsaved instructions; project context could drift. | Identity/project draft buffers, visible saved/unsaved state and deliberate discard; test every transition. |
| U2 | P1 | Submission could differ from the displayed preflight after source, context or provider changes. | Bind admission to the reviewed source/definition/context fingerprint; stale previews require another review. |
| U3 | P2 | Herdr looked available although live Council isolation was unsupported. | Make readiness visible beside selection and preserve inspectability of imported settings. |
| U4 | P2 | Successful action-boundary progress was silent to screen readers. | Add a concise polite status region for counts/current member/completion, excluding artifact content. |
| U5 | P2 | Source/team/agent filters appeared global but behaved differently for legacy runs. | Apply shared dimensions consistently, explain unsupported legacy dimensions and expose Awaiting review. |

## Evidence from the initial implementation

- Council browser journeys: 3 passed, including creating three specialists, a team
  and a council entirely through the UI, followed by six simulated contributions.
- `npm run test:ui-quality`: 8 passed; `npm run ui:gallery`: 40 screenshots reviewed.
- Impeccable mechanical detector: `[]`, exit 0.
- Fresh product reviewer: 7 focused files / 21 tests passed; separately reproduced
  the Draft/Ready mismatch and final-artifact limit defect.
- Fresh security reviewer: reproduced the journal envelope defect with a
  14,484,777-byte valid payload and a 28,901,941-character encoded envelope.
- The first full verification ran during concurrent test-first fixes: typecheck
  and maker types passed; source lint reported an unnecessary spread, full ESLint
  timed out, and product tests captured two temporarily failing assertions.
  This is not a passing final verification result.

## Final verification and review verdicts

The product reviewer marked P1–P8 resolved, the security/reliability reviewer marked
S1–S9 resolved, and the UX reviewer marked U1–U5 resolved with a scope-specific
ship verdict after reopening the repaired draft/recovery captures. Those verdicts
cover the inspected repairs and evidence; they do not claim native-host or live
provider qualification.

- Final `npm run verify:project`: exit 0. Nested check: **5 passed, 0 failed,
  0 skipped** gates in 498.1s. Production candidate built; prototype embedding
  **1 passed, 0 failed**.
- Final UI-quality: **8 passed (48.3s)**. Final gallery: **40 screenshots captured
  and reviewed**; feature-specific recovery/draft evidence remains in
  `reports/council/`.
- Source-size/locale check: **passed**, 2856 inputs and 226 translated keys.
- Diff-based self-review: **clean**, no findings or approval exceptions.
- A post-review integration regression in early private-folder lookup was caught
  by the existing runtime-host tests and fixed with loading-safe registry access.
  The repaired runtime is explicitly checked ready, paused and non-executor.
- Exact UTF-8 sizing now has seven regression cases, including emoji, CJK,
  isolated surrogates, controls and large escaped input. The ASCII fast path keeps
  large-journal validation bounded without changing byte limits.

No screenshot baseline, lint rule, acceptance assertion or quality threshold was
weakened. Two new support files were classified explicitly as helpers in
`tests/suites.json`. An existing OBS composable exceeded its line budget by one;
its removal-action type was moved to the domain contract, with seven related tests
passing and no behavior change.

Additional completion work preserves explicit dissent uncertainty/source references
in typed council results and adds a scoped inbox-activation reset. Reset pauses the
binding and clears its activation state while retaining notes, runs and replay
tombstones; its consequences are explained before confirmation.
Explicit connection-profile IDs are resolved against supported provider bindings;
unknown or mismatched enabled references cannot silently select the global CLI.

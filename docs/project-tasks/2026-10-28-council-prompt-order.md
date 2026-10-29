# Per-round Council prompt order

- Status: schema/compiler/editor implemented; parent and execution agent own final batch-runtime qualification and merge.
- Owner request: choose Round robin (sequential agents) or Fan out (concurrent members) for each Council round.
- Traceability: Council PRD owner amendment and COU-03–05; existing Council definition and preflight surfaces.

## Contract and compatibility

`CouncilRound.promptOrder` accepts only `round-robin` or `fan-out`. The field is optional: absence retains round-robin behavior and is omitted from parsed/default definitions, preserving existing revisions. The editor displays the effective default without mutating an unchanged legacy draft. Explicit choices persist through canonical Markdown and definition duplication.

Compilation copies an explicit mode into every member invocation and the frozen native admission. Explicit v2 Council steps preserve it during expansion; ordinary v1 and v2 agent steps receive no inferred parallel mode. Captured plans retain their definitions and modes after live configuration changes. Decode rejects invocation modes that disagree with their pinned definitions, so a retained sequential capture cannot silently become concurrent.

Preflight displays each captured round's mode and member count. Same-round opinions remain independent, earlier collections retain participant order and the next round remains blocked until its required persisted outcomes exist. The execution agent implements intent/budget reservation, native batch isolation, concurrent dispatch, deterministic publication, recovery and cancellation.

## Test-first evidence

- Initial schema/compiler regression: **5 failed**, including unsupported `promptOrder`.
- Initial editor regression: **1 failed**, because the labelled prompt-order selector was absent.
- Schema/compiler/editor plus existing protocol/v2 regression: **4 files / 17 tests passed**, 3.64 seconds. This covers legacy absence, canonical-note preservation, captured revision/mode isolation, sealed input collections, v2 expansion, journal mismatch rejection and retained failed-save drafts.
- Final compiler/editor and existing protocol/v2 execution regression: **5 files / 19 tests passed**, 3.98 seconds. Full project typecheck exited **0**.
- Focused browser selector/preflight cases: **2 passed (42.3s)** across light/dark themes, including Axe and 1280/360 reflow. Eight editor/preflight captures in `reports/council-prompt-order/` were reviewed. The polishing pass made each selector's help describe its selected mode.
- Scoped schema/compiler/editor ESLint and `git diff --check`: exit **0**. Source limits and locale parity passed, **2953 inputs / 226 translated keys**. View coverage remains valid with **77 canonical views** at this revision.
- The selected-help polishing check: **1 file / 2 UI tests passed**, 19.98 seconds.

Runtime concurrency and final project/native/browser checks belong to the parent qualification. Schema/editor tests alone are not evidence of concurrent provider execution.

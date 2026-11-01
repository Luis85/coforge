# Task: Let workflow agents delegate natively and qualify their work

- Status: in progress
- Journey in `BRIEF.md`: captured workflow → native planning/building/review → verified increment → human acceptance.

## Why

File-only native runs cannot carry out the requested subagent-led implementation and verification. The provider should coordinate its own assistants and call scoped test tools, returning actual command evidence with its increment. CoForge remains the parent attempt's execution/evidence boundary rather than introducing a second child-dispatch workflow.

## Traceability

Owner request: 2026-11-01 decision in `BRIEF.md`. `design/traceability.json` has no declared requirement/interaction obligations; no synthetic req-* or vi-* IDs are introduced.

## Acceptance

- Explicitly enabled Claude/Codex workflow steps use the provider's native subagent feature. No CoWorker recipient picker, operator-side child dispatch or child-run administration is added.
- Parent and children retain one captured model/provider, task-scoped MCP broker, protected files, cumulative tool-call allowance, finite concurrency and cancellation boundary. Native shell/browser/unrelated configuration does not gain authority.
- Missing policy preserves existing behavior; unsupported providers/features fail explicitly. Existing attempts never adopt later capability/settings changes. Delegated Codex background work needs a finite elapsed deadline; USD/turn controls are not misrepresented as Codex spending caps.
- A separately saved host verification grant specifies a local immutable container image and approved command IDs. Imported workflow text cannot grant test execution. No implicit image pull or unsandboxed fallback occurs.
- Actual tests execute against a private filtered snapshot, with no host credentials, Git metadata, managed vault notes or network. Test code cannot modify the canonical worktree; root/child file tools remain the only source-edit path.
- Persist command admission before execution and observed command identity, source fingerprint, timestamps, bounded/redacted output and outcome before returning. Later source edits make previous results historical. Missing/interrupted/unknown outcomes never become passes.
- Cancellation and recovery stop only verified-owned provider/container processes, preserve evidence and avoid replay. Native tests cover reload and original worker reconciliation.
- Full qualification includes behavioral red/green tests, adversarial isolation/ownership tests, provider-native delegation proof, complete required project/UI/Obsidian gates and a polishing/cross-review pass. PR and merge require final-head GitHub checks to be green.

## Implementation plan

1. Research installed provider capabilities and official primary documentation, then fix the shared policy/evidence contracts.
2. Dedicated Claude/process/recovery agent; Codex/profile/stream agent; policy/config/UI/evidence agent. Root owns isolated verification snapshots/container broker and integration closeout.
3. Use explicit step native-tool preferences and a separate host verification grant. Preserve custom authored instructions; update shipped guidance to describe the selected effective capabilities.
4. Test-first implementation with early typecheck, then qualify actual providers and sandbox canaries. Review both themes/pane sizes and keyboard flow.
5. Self-review, fill the PR template, commit/push/open with full E2E qualification and merge only when green.

## Initial research and evidence

- Initial checkout clean on `main`, base `db6d87f` (PR #61). Branch `codex/native-workflow-agents`.
- `node bin/app status`: ok; dependencies installed, generation matches design, zero pending scaffold obligations.
- Installed Claude Code 2.1.281 supports explicit native agent definitions. Native children need their own trust instructions; the parent system prompt is not inherited. `safe-mode` disables custom agents, so only the explicitly enabled private coordinator/worker profile may replace that switch.
- Installed Codex 0.145.0 parses native v2 delegation with finite concurrency. Its selected-model profile currently strips native delegation metadata; supplied tools remain scoped. CLI capability checks are necessary because newer documentation includes features absent locally.
- A private Codex sandbox canary refused admission with `Restricted read-only access requires the elevated Windows sandbox backend`. The current unelevated backend does not qualify test isolation. No fixture process/network contact occurred; no administrator provisioning was attempted.
- Docker Desktop is installed but failed during startup with an existing inference-manager socket error; its stop command also timed out. No factory reset, administrator provisioning or global configuration change was performed. Positive isolated execution is a mandatory CI proof on a local Linux Docker engine rather than an unqualified Windows fallback.

## Qualification evidence

- Actual Claude 2.1.281 proof passed: one native child read the allowed fixture, was denied private access, returned through StructuredOutput, and completed under the original parent. Three bounded calls reported $0.3252812 estimated whole-query cost; this is CLI telemetry, not a billing invoice. Qualification found and fixed missing root StructuredOutput authorization and private-CWD/relative-path ambiguity. Source remained unchanged; no host shell or real project dispatch occurred.
- Actual Codex 0.145.0 proof passed with a freshly advertised native model: one native child, two private threads/one spawn edge, allowed source read and denied credential/managed-note reads, root result attribution and known completion/cleanup. Four bounded calls exposed account-model availability, root-inclusive concurrency and native forking's need for private session persistence. No USD or inclusive token total was invented.
- Provider-native agents remain internal. CoForge does not create or poll child CoWorker jobs. Explicit code-level permission profiles, not prompt text, enforce scoped file/test tools. Actual hostile local-image tool requests were denied by the closed text-only Codex handler despite its advertised tool name.
- Behavioral red/green evidence includes capability/capture/admission, partial-result retention, private runtime before stdin, orphan lane accounting, private credential cleanup, whole-tree token coverage, readonly Review command evidence, historical polishing results, canonical nested/non-Git protection, test persistence fencing and final output byte limits. Root focused batches: 18 tests passed and a separate 11-test source/session/control batch passed; independent subagent batches are recorded in their closeout evidence.
- Native settings save/reload/keyboard proof: 1 passed, wide/narrow light/dark reviewed; no jobs, Docker or model calls. UI quality: 8 passed. Gallery: 40 captures reviewed. Detector: no findings. Final rendered command/recovery evidence and full qualification remain pending.
- Six mandatory real-Docker acceptance cases and a pinned-image CI workflow are implemented. No local positive Docker execution is claimed; first branch-push qualification is pending. The runtime never pulls an image or uses the desktop's dependency tree. Immutable prepared-image dependencies are bound with source bytes/executable permissions in the test fingerprint.

## Untested scope

Final full-project, native evidence and GitHub qualification are pending. Local Docker Desktop cannot supply positive Windows container execution evidence in this session. Existing CF-133/CF-135 notes and retained worktrees are not qualification targets. No publication, code acceptance or provider/model fallback is authorized by an agent's summary; final human review remains mandatory.

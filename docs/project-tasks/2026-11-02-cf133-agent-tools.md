# Task: Give workflow agents the tools needed to complete their assigned work

- Status: implemented; final project and release qualification in progress
- Journey in `BRIEF.md`: inspect a dispatched request, refine it with dedicated
  native assistants and research, then deliver an independently reviewable increment.

## Why

CF-133's latest Refinement completed and produced a useful draft, but its captured
tool policy disabled the dedicated assistants requested by the owner and denied
web research. The agent worked alone and disclosed the missing capabilities. It
also reported failed file-scoped searches and an infrastructure connection reset.
The retained feed shows tool starts without their terminal outcomes, so it cannot
establish the reset's cause. A file-target search defect is independently reproduced.

The draft also proposes extra product scope and treats Simulation as prompt-quality
validation. Those are review findings, not accepted CF-133 product decisions.

## Traceability

Owner decision: `BRIEF.md`, 2026-11-02. The scaffold has no matching requirement or
`vi-*` entries; none are invented or marked implemented.

## Acceptance

- New ordinary native analytical attempts capture scoped native assistants and
  research defaults, explicit opt-outs and existing concurrency choices. Historical
  admissions and definitions stay unchanged. Classifiers, Council/v2 and external
  clients retain their separate contracts. Read-only access does not gain shell,
  native filesystem access or repository writes.
- Tool descriptions and execution guidance match the actual captured capabilities.
  New shipped Build instructions permit checks supported by the captured tools;
  saved custom or legacy instructions remain intact and their restrictions visible.
- File search accepts an exact file or a directory. Invalid, missing, linked,
  protected, binary or oversized explicit files have safe actionable failures.
  Existing traversal, scan/result bounds and read-only lease checks remain enforced.
- Scoped tool completions and failures produce bounded host observations with safe
  failure codes, without request arguments, paths, file contents or raw causes.
  Observation failure cannot change an execution outcome. Later requests remain usable.
- Compact request status agrees with retained native recovery authority without
  exposing private process/runtime handles or calling ordinary active work a failure.
- Actual provider/HTTP/process qualifications use contained fixtures and local
  synthetic endpoints; no paid model call or live CF-133 retry is needed.

## Plan

1. Preserve a private, redacted CF-133 snapshot for dedicated runtime, product/UX
   and MCP reviews; identify reproduced defects separately from reported symptoms.
2. Write failing admission, opt-out, tool-search and outcome/status regressions.
3. Implement through existing policy, broker, host and UI contracts; keep capabilities
   independent of untrusted task prose and preserve human review.
4. Qualify actual native assistants/research and read-only boundaries, then run
   project, browser/gallery and contained Obsidian checks, self-review and CI.
5. Commit, push, open a PR and merge only after all required checks pass.

## Out of scope

Implementing CF-133's Hiring Pool, accepting the generated scope expansion, editing
or rerunning the live request, reconstructing unretained SDK payloads, global CLI
configuration/authentication changes, paid provider calls or automatically approving code.

## Evidence

Private run evidence is retained under ignored `.nq/cf133-run-review/`. No private
records, credentials, paths or screenshots are committed. File-search RED reproduces
four `ENOTDIR` failures; the focused fix passed 38 tests. Tool-observation RED
reproduces missing terminal events and unstructured native failures; its first
fixed HTTP batch passed eight tests. Actual installed Claude/Codex assistant and research canaries passed with four
verified scoped child reads, no source changes and known original Windows job
quiescence. Root and child image probes were denied without image payloads.
Coding child edits and real PowerShell checks passed; zero real model calls.

Native control/recovery, admission round-trip and forged-provider tests are green.
Parallel HTTP pressure reproduced a separate connection-reset defect; bounded
not-started replies and reserved scoped status/cancellation now replace it.
Final project/CI and UI preference confirmation remain in progress; the PR records
real commands, outcomes and any local gate limitation.

## Untested scope

The original reported connection reset has no retained raw transport cause and is
not claimed fixed from source inspection. Final platform/provider coverage and any
local gate limitations will be recorded in the PR with actual results.

# Task: Isolate worker observations and qualify the complete change

- Status: done
- Journey in BRIEF.md: observe native sessions without changing execution ownership.

## Why

The full product gate failed the cosmetic journal fault-isolation test. Its
isolated rerun passed, but diagnostics later reproduced EPERM on an authoritative
record write. Observations also rewrote that record and advanced the sequence
used for result acknowledgement and capacity.

## Traceability and acceptance

Owner follow-up, 2026-11-01; no generated req-* or vi-* obligations are declared.
Session storage failure, corrupt observations and foreign observation identity
must not alter provider completion, costs, acknowledgement or admission capacity.
Control storage failure must still quarantine execution. Live observations must
remain visible without advancing the control sequence; legacy evidence remains
readable after reload.

## Plan

1. Make the acknowledgement/control-file regressions fail; target the cosmetic
   fault injection and assert that it actually fired.
2. Persist bounded, identity-bound observation data separately, retaining legacy
   trace loading and live projection behavior.
3. Run focused tests and self-review before one stable-source full verification.
4. Rerun complete product, UI and contained-host checks; record actual output in
   .github/pull_request_template.md.

## Evidence

The original isolated fault case passed 100 repetitions; that result alone was
not treated as resolving the full-run failure. New regressions were observed
failing before implementation.

Diagnostics reproduced EPERM during a record.json write. Atomic replacement now
retries permission/busy errors at most five times (160ms total backoff), rechecking
directory, destination and staged-file identity before each attempt. Target
replacement, target disappearance and linked/substituted staging still fail closed.

The previously failing case passed 1,000 repetitions after the replacement fix.
The final focused worker/files/client/recovery/projection batch passed 35 tests
across 8 files. Project typecheck, changed-source ESLint and source limits passed.

The current-source npm run verify:project passed: all 5 check steps passed, with
2,137 product tests passed, 0 failed and 6 existing skips across 536 files.
The complete production build and prototype-embedding check passed. The complete
native suite passed 66 tests across 57 files, UI quality passed 8 tests and all 40
fresh gallery screenshots were reviewed. Final contained smoke reported passed,
errors [], hostErrorCount 0 and pluginConsole []. Self-review and git diff --check
passed; detailed evidence is in .github/pull_request_template.md and ignored
reports/worker-session-final/.

One preceding host run had a pre-launch LevelDB error; its teardown confirmed
cleanup. The complete fresh-process rerun passed, including that case. No test
retry, timeout relaxation or weakened storage/identity guard was introduced.

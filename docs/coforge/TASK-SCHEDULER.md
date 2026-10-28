# Agent task scheduling

Open **The Council → Task scheduler**. This is separate from the stream broadcast calendar.

Choose a project, its team, and an agent, a council or a team with one explicitly selected member. Add a task prompt and up to ten explicit private Markdown context paths. Context is read and captured at each occurrence; original notes are preserved. Existing runs retain pinned inputs and recipient definitions after edits.

Use a one-time date/time or delay, an anchored repeating interval, or a daily/weekly wall-clock time. Daily/weekly schedules save an IANA timezone. Missing spring-transition times are skipped; repeated fall-transition times run once at their first occurrence. One-time and interval start times are entered in the device timezone and persisted as absolute instants.

Save paused or explicitly enable scheduling. Only the designated desktop runs timers while the vault and CoForge remain open. Council and project execution must also be resumed. Missed runs are skipped after reopening or suspension. If the previous occurrence is still active, the new occurrence is skipped and the reason is recorded. The scheduler does not create a background daemon or replay a backlog.

Definitions and up to 500 retained occurrence records are stored in the ignored `coforge-task-scheduler.json` plugin journal, with backup and external-edit checks. Each dispatch reserves its intent before creating a private note under `CoForge/Scheduled Tasks`. That note captures prompt/context and receives normal managed Council results. Queue/run limits and capability checks remain authoritative; scheduling does not approve code or enlarge agent permissions. Definitions are limited to 200, and the shared admission queue to 50 active runs. Active/uncertain evidence is never silently evicted to make space.

Each occurrence shows skipped, reserved, submitted or attention status. Submitted means admitted, not completed; inspect its current run in Run monitor and open its source/results. Unknown or interrupted admissions disable the schedule. Inspect and stop/recover the original work before explicitly acknowledging and enabling future occurrences. The original occurrence is never replayed. Archive pauses future scheduling and preserves existing evidence; restore leaves the schedule paused.

**Run now** creates an explicit new occurrence using the same destination, overlap, readiness and recovery gates. Editing a definition changes future occurrences only. Save errors and stale revisions keep the draft; refresh after repairing the private journal. Other desktops can inspect the scheduler but cannot mutate or dispatch it.

The browser example uses memory-only schedules and simulated admission receipts. It makes no native model requests and writes no vault notes; it is not evidence of a live provider session.

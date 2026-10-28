import type { Timers } from "../../features/coforge/application/ports";
import type { ExecutionScheduler } from "../../features/coforge/application/execution-scheduler";
import type { JournalTeamMessages } from "../../features/coforge/application/journal-team-messages";
import type { CouncilInboxWatcher } from "./council-inbox-watcher";

/** Waiting publication/delivery never holds a provider slot; the scheduler owns invocation exclusion. */
export function startCouncilRuntimeLoop(
  timers: Timers,
  scheduler: ExecutionScheduler,
  messages: JournalTeamMessages,
  watcher: CouncilInboxWatcher,
  enabled: () => boolean,
  failed: () => void,
): () => void {
  let stopped = false;
  const id = timers.setInterval(() => {
    if (stopped || !enabled()) return;
    void scheduler
      .tick()
      .then(async (action) => {
        if (!action?.succeeded || stopped) return;
        await messages.flush();
        if (!stopped) await watcher.reconcileAll();
      })
      .catch(() => {
        if (!stopped) failed();
      });
  }, 750);
  return () => {
    stopped = true;
    timers.clearInterval(id);
  };
}

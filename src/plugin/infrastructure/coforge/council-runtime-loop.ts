import type { Timers } from "../../features/coforge/application/ports";
import type { ExecutionScheduler } from "../../features/coforge/application/execution-scheduler";
import type { JournalTeamMessages } from "../../features/coforge/application/journal-team-messages";
import type { CouncilInboxWatcher } from "./council-inbox-watcher";
import type { Plugin } from "obsidian";
import type { IntakeBinding } from "../../features/coforge/domain/intake-bindings";
import type { ExecutionRun } from "../../features/coforge/domain/execution-run";
import {
  indexCouncilRunSources,
  type CouncilSourceNotes,
} from "./council-source-notes";

/** Async source setup must not register observation after its owning plugin was unloaded. */
export async function startCouncilObservation(input: {
  plugin: Plugin;
  sources: CouncilSourceNotes;
  runs: readonly ExecutionRun[];
  bindings: readonly IntakeBinding[];
  watcher: CouncilInboxWatcher;
  timers: Timers;
  scheduler: ExecutionScheduler;
  messages: JournalTeamMessages;
  disposed(): boolean;
  enabled(): boolean;
  failed(): void;
}): Promise<() => void> {
  await indexCouncilRunSources(input.plugin, input.sources, input.runs);
  if (input.disposed()) return () => {};
  await input.watcher.configure(input.bindings);
  if (input.disposed()) {
    input.watcher.dispose();
    return () => {};
  }
  return startCouncilRuntimeLoop(
    input.timers,
    input.scheduler,
    input.messages,
    input.watcher,
    input.enabled,
    input.failed,
  );
}

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

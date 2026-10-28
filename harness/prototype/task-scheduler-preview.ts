import { TaskScheduler } from '../../src/plugin/features/coforge/application/task-scheduler';
import { emptyTaskScheduler } from '../../src/plugin/features/coforge/domain/scheduled-task';
import type { CouncilActions } from '../../src/plugin/features/coforge/application/council-ports';
import { resolveCouncilPlan } from '../../src/plugin/features/coforge/application/council-execution';

/** Explicit browser example: memory-only schedules and admission receipts; no native provider or vault. */
export function createTaskSchedulerPreview(council: CouncilActions): TaskScheduler {
  let state = emptyTaskScheduler();
  const scheduler = new TaskScheduler({ load: async () => structuredClone(state), save: async value => { state = structuredClone(value); } }, {
    owned: () => council.snapshot().executor,
    configure: async () => { if (!council.snapshot().executor) throw new Error('Designate the example desktop first.'); },
    validate: async task => { resolveCouncilPlan(await council.catalogue.list(), { kind: task.destination.kind === 'council' ? 'council' : 'agent', id: task.destination.kind === 'team' ? task.destination.assigneeId ?? '' : task.destination.id, teamId: task.destination.teamId }); },
    readiness: () => ({ ready: !council.snapshot().paused, reason: 'Example execution is paused; skipped.' }),
    active: () => false,
    openSource: async () => { throw new Error('Example receipts stay in memory. Open desktop Obsidian for vault source notes and real run evidence.'); },
    dispatch: async (_task, occurrence) => ({ runId: `example-${occurrence.id}`, sourcePath: occurrence.sourcePath ?? '' }),
  }, { setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: handle => window.clearTimeout(handle),
    setInterval: (callback, ms) => window.setInterval(callback, ms), clearInterval: handle => window.clearInterval(handle) });
  void scheduler.start().catch(() => undefined);
  return scheduler;
}

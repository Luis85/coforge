import type {
  AICostActions,
  AICostState,
  AICostStorage,
} from "./ai-cost-ports";
import { normalizedUsd, type AICostTask } from "../domain/ai-costs";
import type { StudioStore } from "./studio-store";
import type { Timers } from "./ports";
import { recordOperation } from "./population";
export class AICostService implements AICostActions {
  private state: AICostState = { tasks: [], error: "", loading: true };
  private readonly listeners = new Set<(state: AICostState) => void>();
  private stop = () => {};
  private timer: number | undefined;
  private closed = false;
  private ready = false;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly store: StudioStore,
    private readonly storage: AICostStorage,
    private readonly collect: () => AICostTask[],
    private readonly timers: Timers,
  ) {}
  snapshot() {
    return structuredClone(this.state);
  }
  subscribe(listener: (state: AICostState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(): void {
    if (!this.closed)
      for (const listener of this.listeners) {
        try {
          listener(this.snapshot());
        } catch {
          /* Isolate analytics views. */
        }
      }
  }
  private command<T>(work: () => Promise<T>): Promise<T> {
    const next = this.pending.then(work);
    this.pending = next.catch(() => undefined);
    return next;
  }
  async start(): Promise<void> {
    if (this.closed) return;
    this.stop();
    this.stop = this.store.subscribeEvents((event) => {
      if (
        event.type === 'example-content-removed' ||
        /^(job-|ai-cost-reported|ai-usage-reported|herdr-action-)/.test(
          event.type,
        )
      )
        this.schedule();
    });
    await this.refresh();
  }
  private schedule(): void {
    if (this.closed || this.timer !== undefined) return;
    this.timer = this.timers.setTimeout(() => {
      this.timer = undefined;
      void this.sync().catch(() => undefined);
    }, 50);
  }
  private merge(): AICostTask[] {
    const tasks = new Map(this.state.tasks.map((task) => [task.id, task]));
    for (const incoming of this.collect()) {
      const before = tasks.get(incoming.id);
      const attribution = before?.attribution ? { ...incoming.attribution, ...before.attribution } : incoming.attribution;
      tasks.set(
        incoming.id,
        before
          ? {
              ...before,
              ...incoming,
              featureTitle: before.featureTitle || incoming.featureTitle,
              projectName: before.projectName || incoming.projectName,
              ...(before.workflow ? { workflow: before.workflow } : {}),
              ...(attribution ? { attribution } : {}),
              ...(incoming.usage
                ? { usage: { ...before.usage, ...incoming.usage } }
                : {}),
            }
          : incoming,
      );
    }
    const cutoffs = this.store.exampleCostRemovalCutoffs();
    return [...tasks.values()].filter(task => {
      const removedAt = cutoffs[task.featureId];
      const manual = task.manualUsd !== undefined || task.manualNote !== undefined || task.manualAt !== undefined;
      return task.provider !== 'demo' || manual || !removedAt || !(Date.parse(task.startedAt) <= Date.parse(removedAt));
    });
  }
  private async sync(): Promise<void> {
    return this.command(async () => {
      if (this.closed || !this.ready) return;
      try {
        const tasks = this.merge();
        if (JSON.stringify(tasks) !== JSON.stringify(this.state.tasks))
          await this.storage.save(tasks);
        this.state.tasks = tasks;
        this.state.error = "";
        this.publish();
      } catch (error) {
        this.state.error =
          error instanceof Error
            ? error.message
            : "AI cost history is unavailable.";
        this.publish();
        throw error;
      }
    });
  }
  refresh(): Promise<void> {
    return this.command(async () => {
      if (this.closed) return;
      this.state.loading = true;
      this.publish();
      try {
        const tasks = await this.storage.load();
        this.state.tasks = tasks;
        this.ready = true;
        const next = this.merge();
        if (JSON.stringify(next) !== JSON.stringify(tasks))
          await this.storage.save(next);
        this.state.tasks = next;
        this.state.error = "";
      } catch (error) {
        this.state.error =
          error instanceof Error
            ? error.message
            : "AI cost history could not be loaded.";
        throw error;
      } finally {
        this.state.loading = false;
        this.publish();
      }
    });
  }
  setManual(
    id: string,
    amount: string | null,
    note: string,
    expected: string,
  ): Promise<void> {
    return this.command(async () => {
      const task = this.state.tasks.find((task) => task.id === id);
      if (!this.ready || !task || JSON.stringify(task) !== expected)
        throw new Error(
          "This task changed. Refresh and review the manual cost again.",
        );
      if (task.provider === "demo")
        throw new Error("Simulation tasks cannot receive real usage costs.");
      if (task.status === 'not-started') throw new Error('No provider was contacted for this attempt. There is no usage cost to enter.');
      if (amount !== null && task.reportedUsd !== undefined)
        throw new Error(
          "A provider cost is already reported. Manual fallback is only used when no provider cost is available.",
        );
      if (note.length > 2000)
        throw new Error("Keep the cost note under 2,000 characters.");
      const next = { ...task };
      if (amount === null) {
        delete next.manualUsd;
        delete next.manualNote;
        delete next.manualAt;
      } else {
        next.manualUsd = normalizedUsd(amount);
        next.manualNote = note.trim();
        next.manualAt = new Date().toISOString();
      }
      const tasks = this.state.tasks.map((task) =>
        task.id === id ? next : task,
      );
      await this.storage.save(tasks);
      this.state.tasks = tasks;
      this.publish();
      await this.store.transaction((state) =>
        recordOperation(
          state,
          "ai-cost-manual-updated",
          "committed",
          undefined,
          1,
          id,
        ),
      );
    });
  }
  async dispose(): Promise<void> {
    this.stop();
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    if (this.ready) await this.sync().catch(() => undefined);
    this.closed = true;
    await this.pending;
    this.listeners.clear();
  }
}

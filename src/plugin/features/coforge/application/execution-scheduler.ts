import type { ExecutionKernel } from "./execution-kernel";

export interface ExecutionSchedulerHost {
  projectEnabled(projectId: string): boolean;
  /** The existing workflow lane and this scheduler share the host's invocation gate. */
  providerAvailable(): boolean;
  blocked?(runId: string): void;
}
export interface ExecutionAction {
  runId: string;
  kind: "invocation" | "publication";
  succeeded: boolean;
}

/** Fairness is applied between actions, never by weakening a council's sequential dependencies. */
export class ExecutionScheduler {
  private lastRunId?: string;
  private active = false;
  private disposed = false;
  constructor(
    private readonly kernel: ExecutionKernel,
    private readonly host: ExecutionSchedulerHost,
  ) {}
  async tick(): Promise<ExecutionAction | null> {
    if (
      this.disposed ||
      this.active ||
      this.kernel.isPaused ||
      this.kernel.isInvoking
    )
      return null;
    const runs = this.kernel.snapshot().runs;
    const previous = runs.findIndex((run) => run.id === this.lastRunId);
    const ordered = [
      ...runs.slice(previous + 1),
      ...runs.slice(0, previous + 1),
    ];
    const run = ordered.find(
      (item) =>
        !item.pauseRequested &&
        this.host.projectEnabled(item.projectId) &&
        ((item.state === "publishing" && !item.reason) ||
          (item.state === "queued" && this.host.providerAvailable())),
    );
    if (!run) return null;
    this.lastRunId = run.id;
    this.active = true;
    const kind = run.state === "publishing" ? "publication" : "invocation";
    try {
      if (kind === "publication") await this.kernel.repair(run.id);
      else await this.kernel.step(run.id);
      return { runId: run.id, kind, succeeded: true };
    } catch {
      try {
        this.host.blocked?.(run.id);
      } catch {
        /* Diagnostics cannot reserve the scheduler lane. */
      }
      return { runId: run.id, kind, succeeded: false };
    } finally {
      this.active = false;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.kernel.dispose();
  }
}

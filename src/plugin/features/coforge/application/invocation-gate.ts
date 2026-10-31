export interface InvocationLane {
  run<T>(invoke: () => Promise<T>, signal?: AbortSignal): Promise<T>;
}
interface QueuedInvocation { begin(): void; cancel(error: Error): void }
/** Bounded FIFO root calls/groups. A trusted batch retains its existing member concurrency. */
export class InvocationGate {
  private readonly queued: QueuedInvocation[] = [];
  private active = 0;
  private concurrency = 1;
  private disposed = false;

  setConcurrency(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 16) throw new Error('Choose between 1 and 16 concurrent short tasks.');
    this.concurrency = value;
    this.pump();
  }
  private pump(): void {
    while (!this.disposed && this.active < this.concurrency && this.queued.length) this.queued.shift()!.begin();
  }
  async run<T>(invoke: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.disposed) throw new Error("The provider runtime was unloaded.");
    signal?.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const entry: QueuedInvocation = {
        cancel: error => { cleanup(); reject(error); },
        begin: () => {
          cleanup(); this.active++;
          void Promise.resolve().then(() => {
            if (this.disposed) throw new Error('The provider runtime was unloaded.');
            signal?.throwIfAborted();
            return invoke();
          }).then(resolve, reject).finally(() => { this.active--; this.pump(); });
        },
      };
      const abort = () => {
        const index = this.queued.indexOf(entry);
        if (index < 0) return;
        this.queued.splice(index, 1);
        entry.cancel(new Error('The queued provider request was cancelled.'));
      };
      this.queued.push(entry);
      signal?.addEventListener('abort', abort, { once: true });
      this.pump();
    });
  }

  runBatch<T>(
    work: (lane: InvocationLane) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.run(async () => {
      let open = true;
      const pending = new Set<Promise<unknown>>();
      const lane: InvocationLane = {
        run: <R>(
          invoke: () => Promise<R>,
          memberSignal?: AbortSignal,
        ): Promise<R> => {
          if (!open)
            return Promise.reject(
              new Error("The provider batch lane is closed."),
            );
          const task = Promise.resolve().then(() => {
            if (this.disposed)
              throw new Error("The provider runtime was unloaded.");
            signal?.throwIfAborted();
            memberSignal?.throwIfAborted();
            return invoke();
          });
          pending.add(task);
          void task.then(
            () => pending.delete(task),
            () => pending.delete(task),
          );
          return task;
        },
      };
      try {
        return await work(lane);
      } finally {
        open = false;
        await Promise.allSettled(pending);
      }
    }, signal);
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.queued.splice(0)) entry.cancel(new Error('The provider runtime was unloaded.'));
  }
}

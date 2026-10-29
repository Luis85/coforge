export interface InvocationLane {
  run<T>(invoke: () => Promise<T>, signal?: AbortSignal): Promise<T>;
}
/** One exclusive legacy call or trusted concurrent group; queued groups retain FIFO fairness. */
export class InvocationGate {
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;

  async run<T>(invoke: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.disposed) throw new Error("The provider runtime was unloaded.");
    signal?.throwIfAborted();
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (this.disposed) throw new Error("The provider runtime was unloaded.");
      signal?.throwIfAborted();
      return await invoke();
    } finally {
      release();
    }
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
  }
}

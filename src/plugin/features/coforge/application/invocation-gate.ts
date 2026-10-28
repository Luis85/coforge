/** One provider slot shared by legacy workflows and typed invocations for this runtime. */
export class InvocationGate {
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;

  async run<T>(invoke: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.disposed) throw new Error('The provider runtime was unloaded.');
    signal?.throwIfAborted();
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      if (this.disposed) throw new Error('The provider runtime was unloaded.');
      signal?.throwIfAborted();
      return await invoke();
    } finally { release(); }
  }

  dispose(): void { this.disposed = true; }
}

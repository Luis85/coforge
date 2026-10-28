import type { ExecutionTimingHooks } from "../../features/coforge/application/execution-timing";
import { ExecutionBlockError } from "../../features/coforge/domain/execution-block";
import type { Timers } from "../../features/coforge/application/ports";

/** Starts after acquiring the shared slot. Waiting for that slot is excluded from charged execution. */
export async function withCouncilProviderTiming<T>(
  timing: ExecutionTimingHooks | undefined,
  signal: AbortSignal | undefined,
  invoke: (
    signal: AbortSignal | undefined,
    remainingMs: number | undefined,
  ) => Promise<T>,
  timers?: Pick<Timers, "setInterval" | "clearInterval">,
): Promise<T> {
  if (!timing) return invoke(signal, undefined);
  await timing.start();
  const controller = new AbortController();
  const aborted = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", aborted, { once: true });
  if (signal?.aborted) aborted();
  let failure: unknown;
  let busy = false;
  let pending: Promise<void> = Promise.resolve();
  const timerWindow = timers ?? {
    setInterval: (callback: () => void, ms: number) =>
      window.setInterval(callback, ms),
    clearInterval: (id: number) => window.clearInterval(id),
  };
  const timer = timerWindow.setInterval(() => {
    if (busy) return;
    busy = true;
    pending = timing
      .checkpoint()
      .then((remaining) => {
        if (remaining <= 0) {
          failure = new ExecutionBlockError("execution-time");
          controller.abort(failure);
        }
      })
      .catch((error) => {
        failure = error;
        controller.abort(error);
      })
      .finally(() => {
        busy = false;
      });
  }, 1000);
  try {
    if (timing.remainingMs <= 0)
      throw new ExecutionBlockError("execution-time");
    const result = await invoke(controller.signal, timing.remainingMs);
    if (failure) throw failure;
    return result;
  } catch (error) {
    throw failure ?? error;
  } finally {
    timerWindow.clearInterval(timer);
    signal?.removeEventListener("abort", aborted);
    await pending;
    await timing.stop();
  }
}

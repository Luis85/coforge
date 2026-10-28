import type { ExecutionInvocation } from "../domain/execution-run";
import { ExecutionBlockError } from "../domain/execution-block";
import { cancelledExecutionLineage } from "../domain/execution-lineage";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionKernelHost } from "./execution-ports";
import {
  chargeExecutionMs,
  remainingExecutionMs,
} from "./execution-time-budget";
import {
  timingReservation,
  removeTimingReservation,
  putTimingReservation,
} from "./execution-timing-reservations";
export interface ExecutionTimingHooks {
  readonly remainingMs: number;
  start(): Promise<void>;
  checkpoint(): Promise<number>;
  stop(): Promise<void>;
  action?<T>(work: () => Promise<T>, recovery?: boolean): Promise<T>;
}
/** One-second active reservations survive crashes; no wall clock survives into a reloaded timing session. */
export class ExecutionTiming {
  private sequence = 0;
  private readonly active = new Map<string, ExecutionTimingHooks>();
  private readonly clocks = new Map<
    string,
    { runId: string; elapsed(): number }
  >();
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
  ) {}
  hooks(
    runId: string,
    invocation?: ExecutionInvocation,
    recovery = false,
  ): ExecutionTimingHooks {
    const token = `time-${++this.sequence}`;
    let started = false;
    let closed = false;
    let phaseStarted = 0;
    let tail = Promise.resolve();
    const parallel = invocation?.promptOrder === "fan-out";
    const serial = <T>(work: () => Promise<T>): Promise<T> => {
      const result = tail.then(work);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };
    const remaining = () => {
      const run = this.store.find(runId);
      const committed = remainingExecutionMs(
        this.store.snapshot(),
        run,
        invocation,
        token,
      );
      const activeElapsed =
        started &&
        !closed &&
        this.host.monotonicMs &&
        timingReservation(run, token)
          ? Math.max(
              0,
              Math.floor(this.host.monotonicMs() - phaseStarted) -
                (timingReservation(run, token)?.accountedMs ?? 0),
            )
          : 0;
      const peers = [...this.clocks]
        .filter(([key, clock]) => key !== token && clock.runId === runId)
        .reduce((sum, [key, clock]) => {
          const reservation = timingReservation(run, key);
          return (
            sum +
            (reservation
              ? Math.max(
                  0,
                  clock.elapsed() -
                    (reservation.accountedMs ?? 0) -
                    reservation.reservedMs,
                )
              : 0)
          );
        }, 0);
      return Math.max(0, committed - activeElapsed - peers);
    };
    const hooks: ExecutionTimingHooks = {
      action: <T>(work: () => Promise<T>, allowRecovery = false) =>
        started && !closed
          ? work()
          : this.measure(runId, invocation, work, allowRecovery),
      get remainingMs() {
        return remaining();
      },
      start: () =>
        serial(async () => {
          if (started || closed) return;
          if (!recovery && remaining() <= 0)
            throw new ExecutionBlockError("execution-time");
          if (!this.host.monotonicMs) {
            started = true;
            return;
          }
          await this.store.mutate((next) => {
            const run = next.runs.find((item) => item.id === runId)!;
            if (!recovery && cancelledExecutionLineage(next, run))
              throw new ExecutionBlockError("root-stopped");
            if (
              run.timing?.active ||
              (!parallel && run.timing?.parallel?.length)
            )
              throw new Error(
                "Another automatic timing phase is active for this run.",
              );
            const reservedMs = Math.min(
              1000,
              remainingExecutionMs(next, run, invocation),
            );
            chargeExecutionMs(
              next,
              run,
              invocation?.executionScope?.id,
              reservedMs,
            );
            putTimingReservation(
              run,
              {
                token,
                ...(invocation?.executionScope
                  ? { scopeId: invocation.executionScope.id }
                  : {}),
                reservedMs,
              },
              parallel,
            );
          });
          started = true;
          phaseStarted = this.host.monotonicMs();
          this.active.set(token, hooks);
          this.clocks.set(token, {
            runId,
            elapsed: () =>
              Math.max(0, Math.floor(this.host.monotonicMs!() - phaseStarted)),
          });
        }),
      checkpoint: () =>
        serial(async () => {
          if (!started || closed || !this.host.monotonicMs) return remaining();
          await settle(false);
          return remaining();
        }),
      stop: () =>
        serial(async () => {
          if (!started || closed) return;
          if (this.host.monotonicMs) await settle(true);
          closed = true;
          this.active.delete(token);
          this.clocks.delete(token);
        }),
    };
    const settle = async (finish: boolean): Promise<void> => {
      const now = this.host.monotonicMs!();
      const elapsed = Math.max(0, Math.floor(now - phaseStarted));
      await this.store.mutate((next) => {
        const run = next.runs.find((item) => item.id === runId)!;
        const current = timingReservation(run, token);
        if (!current || current.token !== token) return;
        chargeExecutionMs(
          next,
          run,
          current.scopeId,
          elapsed - (current.accountedMs ?? 0) - current.reservedMs,
        );
        removeTimingReservation(run, token);
        if (!finish) {
          const reservedMs = Math.min(
            1000,
            remainingExecutionMs(next, run, invocation),
          );
          chargeExecutionMs(next, run, current.scopeId, reservedMs);
          putTimingReservation(
            run,
            {
              token,
              ...(current.scopeId ? { scopeId: current.scopeId } : {}),
              reservedMs,
              accountedMs: elapsed,
            },
            parallel,
          );
        }
      });
    };
    return hooks;
  }
  async measure<T>(
    runId: string,
    invocation: ExecutionInvocation | undefined,
    work: () => Promise<T>,
    recovery = false,
  ): Promise<T> {
    const hooks = this.hooks(runId, invocation, recovery);
    await hooks.start();
    try {
      return await work();
    } finally {
      await hooks.stop();
    }
  }
  async flush(): Promise<void> {
    await Promise.all([...this.active.values()].map((hooks) => hooks.stop()));
  }
}

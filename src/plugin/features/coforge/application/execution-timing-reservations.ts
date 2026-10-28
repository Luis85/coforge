import type { ExecutionRun } from "../domain/execution-run";
export type TimingReservation = {
  token: string;
  scopeId?: string;
  reservedMs: number;
  accountedMs?: number;
};
export const timingReservations = (run: ExecutionRun): TimingReservation[] => [
  ...(run.timing?.active ? [run.timing.active] : []),
  ...(run.timing?.parallel ?? []),
];
export const timingReservation = (run: ExecutionRun, token: string) =>
  timingReservations(run).find((item) => item.token === token);
export function removeTimingReservation(run: ExecutionRun, token: string) {
  if (run.timing?.active?.token === token) delete run.timing.active;
  if (run.timing?.parallel) {
    run.timing.parallel = run.timing.parallel.filter(
      (item) => item.token !== token,
    );
    if (!run.timing.parallel.length) delete run.timing.parallel;
  }
}
export function putTimingReservation(
  run: ExecutionRun,
  value: TimingReservation,
  parallel: boolean,
) {
  run.timing ??= { usedMs: 0, scopes: [] };
  if (parallel) (run.timing.parallel ??= []).push(value);
  else run.timing.active = value;
}

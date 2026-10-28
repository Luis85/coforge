import type {
  ExecutionAdmission,
  ExecutionJournal,
  ExecutionRun,
} from "../domain/execution-run";
import type { ExecutionMessagingState } from "../domain/execution-outbox";
import type { StageUsage } from "../domain/ai-usage";
import type { ExecutionKernelHost } from "./execution-ports";
import { ExecutionJournalStore } from "./execution-journal-store";
import { ExecutionPublication } from "./execution-publication";
import { ExecutionControls } from "./execution-controls";
import { ExecutionEvidence } from "./execution-evidence";
import { ExecutionRecovery } from "./execution-recovery";
import { ExecutionLocalActions } from "./execution-local-actions";
import { ExecutionInvocations } from "./execution-invocations";
import { ExecutionTiming } from "./execution-timing";
import { ExecutionAllowanceControls } from "./execution-allowance-controls";
import type { ExecutionAllowancePatch } from "../domain/execution-allowance";
export type {
  ExecutionKernelHost,
  ExecutionJournalPort,
} from "./execution-ports";

/** Shared execution facade: all destinations use one journal authority and one invocation lane. */
export class ExecutionKernel {
  private readonly store: ExecutionJournalStore;
  private readonly publication: ExecutionPublication;
  private readonly controls: ExecutionControls;
  private readonly evidence: ExecutionEvidence;
  private readonly recovery: ExecutionRecovery;
  private readonly invocations: ExecutionInvocations;
  private readonly timing: ExecutionTiming;
  private readonly allowances: ExecutionAllowanceControls;
  private paused = true;
  private disposed = false;
  constructor(host: ExecutionKernelHost) {
    this.store = new ExecutionJournalStore(host, () => this.pause());
    this.timing = new ExecutionTiming(this.store, host);
    this.allowances = new ExecutionAllowanceControls(this.store, host);
    this.publication = new ExecutionPublication(this.store, host, this.timing);
    const local = new ExecutionLocalActions(
      this.store,
      host,
      () => this.paused,
      this.timing,
    );
    this.invocations = new ExecutionInvocations(
      this.store,
      host,
      this.publication,
      local,
      () => this.paused,
      this.timing,
    );
    this.controls = new ExecutionControls(
      this.store,
      host,
      () => this.invocations.activeId,
    );
    this.evidence = new ExecutionEvidence(this.store, host);
    this.recovery = new ExecutionRecovery(this.store, host, this.publication);
  }
  snapshot(): ExecutionJournal {
    return this.store.snapshot();
  }
  subscribe(listener: (journal: ExecutionJournal) => void): () => void {
    return this.store.subscribe(listener);
  }
  get isPaused(): boolean {
    return this.paused;
  }
  get isInvoking(): boolean {
    return this.invocations.isInvoking;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.store.assertLoaded();
    if (this.disposed) throw new Error("Execution was disposed.");
    this.paused = false;
  }
  dispose(): void {
    this.paused = true;
    this.disposed = true;
    this.invocations.cancelActive();
    this.store.clearListeners();
  }
  flushTiming(): Promise<void> {
    return this.timing.flush();
  }
  extendAllowance(
    runId: string,
    patch: ExecutionAllowancePatch,
  ): Promise<void> {
    return this.allowances.extend(runId, patch);
  }
  async load(): Promise<void> {
    this.paused = true;
    await this.store.load();
  }
  admit(input: ExecutionAdmission): Promise<ExecutionRun> {
    return this.store.admit(input);
  }
  step(id: string): Promise<void> {
    return this.invocations.step(id);
  }
  repair(id: string): Promise<void> {
    return this.publication.repair(id);
  }
  retry(id: string, acknowledgeUnknown = false): Promise<void> {
    return this.controls.retry(id, acknowledgeUnknown);
  }
  cancel(id: string): Promise<void> {
    return this.controls.cancel(id);
  }
  pauseRun(id: string, paused: boolean): Promise<void> {
    return this.controls.pauseRun(id, paused);
  }
  acknowledgeCheckpoint(
    id: string,
    checkpointId: string,
    checkedIds: string[],
    note = "",
  ): Promise<void> {
    return this.controls.acknowledgeCheckpoint(
      id,
      checkpointId,
      checkedIds,
      note,
    );
  }
  updateMessaging(
    work: (state: ExecutionMessagingState) => ExecutionMessagingState,
  ): Promise<void> {
    return this.evidence.updateMessaging(work);
  }
  recordTelemetry(
    runId: string,
    attemptId: string,
    usage?: StageUsage,
    costUsd?: number,
  ): Promise<void> {
    return this.evidence.recordTelemetry(runId, attemptId, usage, costUsd);
  }
  continueSnapshot(id: string, currentRevision: string): Promise<void> {
    return this.recovery.continueSnapshot(id, currentRevision);
  }
  skipInvocation(
    id: string,
    reason: string,
    acknowledgeUnknown = false,
  ): Promise<void> {
    return this.recovery.skipInvocation(id, reason, acknowledgeUnknown);
  }
  exportRun(id: string): string {
    return this.evidence.exportRun(id);
  }
  pruneRun(id: string): Promise<void> {
    return this.evidence.pruneRun(id);
  }
  reassignProjection(id: string, sourceId: string): Promise<void> {
    return this.publication.reassignProjection(id, sourceId);
  }
}

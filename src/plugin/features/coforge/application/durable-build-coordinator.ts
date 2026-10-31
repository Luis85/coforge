import type { AgentJob } from '../domain/types';
import { DEFAULT_DURABLE_IDLE_WARNING_SECONDS, durableBuildPolicyCheck, durableBuildRefCheck, durableBuildSnapshotCheck, durableBuildTerminal, sameDurableBuildRef } from '../domain/durable-build';
import type { DurableBuildSnapshot } from '../domain/durable-build';
import type { DurableBuildPolicy, DurableBuildRef } from '../domain/durable-build';
import { omit } from '../domain/objects';
import type { StudioStore } from './studio-store';
import type { DurableBuildPort, DurableBuildRequest } from './durable-build-ports';
import { DurableBuildCapacityError } from './durable-build-ports';
import type { InternalState, StageResult } from './ports';
import { configuredJobInput } from './configured-workflow-job';
import { projectDurableBuild } from './durable-build-projection';
import { executionConcurrency } from '../domain/execution-concurrency';
import { recordOperation } from './population';

const unavailable = 'The original background Build could not be contacted. Check its worker and retained execution; do not start another writer.';
export class DurableBuildCoordinator {
  private detached = false;
  private polling: Promise<void> | undefined;
  private readonly pending = new Map<string, Promise<void>>();
  private configuredCapacity: number | undefined;
  constructor(private readonly store: StudioStore, private readonly port: DurableBuildPort | undefined, private readonly complete: (state: InternalState, job: AgentJob, result: StageResult) => void, private readonly after?: (ideaId: string) => Promise<void>) {}
  attach(): void { this.detached = false; }
  async configure(): Promise<void> {
    const capacity = executionConcurrency(this.store.integrationSnapshot()).builds;
    if (this.port && capacity !== this.configuredCapacity) {
      try { await this.port.configureConcurrency(capacity); this.configuredCapacity = capacity; }
      catch { throw new DurableBuildCapacityError('The original worker capacity could not be confirmed. Background admission is waiting.'); }
    }
  }
  async applyRecovered(jobId: string, snapshot: DurableBuildSnapshot): Promise<void> { await this.apply(jobId, snapshot); }
  async launch(job: AgentJob): Promise<void> {
    if (!this.port) throw new Error('The background Build worker is unavailable. No foreground fallback was started.');
    await this.configure();
    const captured = configuredJobInput(this.store.internalSnapshot(), job, undefined, false);
    if (!captured?.workflow || captured.stage !== 'implement' || !captured.workflow.step.execution || !['claude', 'codex'].includes(captured.workflow.step.provider)) throw new Error('Only captured native Builds can enter the background lane.');
    const policy = durableBuildPolicyCheck({ ...captured.workflow.step.execution, idleWarningSeconds: captured.workflow.step.execution.idleWarningSeconds ?? DEFAULT_DURABLE_IDLE_WARNING_SECONDS });
    const request: DurableBuildRequest = { version: 1, jobId: job.id, projectId: job.projectId!, ideaId: job.ideaId, runId: captured.workflow.runId, attemptId: captured.workflow.attemptId, policy,
      input: { jobId: job.id, stage: 'implement', idea: omit(captured.idea, 'workflowRun', 'workflowHistory', 'increment'), settings: captured.settings,
        integration: { projectPath: captured.integration.projectPath, worktreeFolder: captured.integration.worktreeFolder, allowImplementation: captured.integration.allowImplementation, ideasFolder: captured.integration.ideasFolder, publicFolder: captured.integration.publicFolder, claudeBin: captured.integration.claudeBin, ...(captured.integration.codexBin ? { codexBin: captured.integration.codexBin } : {}) }, workflow: captured.workflow } };
    const ref = durableBuildRefCheck(await this.port.prepare(request));
    try {
      if (this.detached) throw new Error('The host detached before background admission was committed.');
      await this.store.transaction(state => {
        const current = state.jobs.find(item => item.id === job.id);
        if (!current || JSON.stringify(current.workflow) !== JSON.stringify(captured.workflow)) throw new Error('The queued Build changed before durable admission.');
        const foregroundId = state.runtime.activeJobId;
        if (!configuredJobInput(state, current)) throw new Error('The queued Build was stopped before durable admission.');
        current.durable = { intent: 'start', ref, policy };
        if (foregroundId) state.runtime.activeJobId = foregroundId; else delete state.runtime.activeJobId;
      });
    } catch (error) {
      const existing = this.store.durableBuildJob(job.id)?.durable;
      if (existing && sameDurableBuildRef(existing.ref, ref)) { await this.check(job.id); return; }
      await this.cancelPreparation(job, ref, policy); throw error;
    }
    if (this.detached) return;
    try { await this.check(job.id); }
    catch { await this.noteError(job.id); }
  }
  async cancel(jobId: string): Promise<void> {
    await this.store.transaction(state => {
      const job = state.jobs.find(item => item.id === jobId);
      if (!job?.durable) throw new Error('This job has no original worker reference.');
      job.durable.intent = 'cancel';
      state.workflowStopHolds = [...new Set([...(state.workflowStopHolds ?? []), job.ideaId])];
      recordOperation(state, 'workflow-run-stopped', 'committed', undefined, 1, job.workflow?.runId ?? job.id);
    });
    await this.check(jobId);
  }
  private async cancelPreparation(job: AgentJob, ref: DurableBuildRef, policy: DurableBuildPolicy): Promise<void> {
    let snapshot: DurableBuildSnapshot | undefined;
    try { const cancelled = durableBuildSnapshotCheck(await this.port!.cancel(ref)); if (sameDurableBuildRef(cancelled.ref, ref)) snapshot = cancelled; } catch { /* Preserve the cancellation intent when the original worker cannot confirm it. */ }
    if (this.detached) return;
    await this.store.transaction(state => {
      const current = state.jobs.find(item => item.id === job.id);
      if (!current || current.durable) return;
      current.durable = { intent: 'cancel', ref, policy, ...(snapshot ? { snapshot } : {}), reconcileError: 'Background admission was not committed. Its unpaid reservation is being cancelled.' };
      if (snapshot) {
        projectDurableBuild(state, current, snapshot, this.complete);
        if (durableBuildTerminal(snapshot.phase)) current.durable.appliedSequence = snapshot.sequence;
      } else current.status = 'running';
    });
    try { await this.acknowledge(job.id); } catch { await this.noteError(job.id); }
  }
  async reconcile(ideaId?: string): Promise<void> {
    if (this.detached) return;
    if (this.polling) return this.polling;
    const work = async () => {
      const jobs = this.store.durableBuildJobIds(ideaId);
      for (const jobId of jobs) { if (this.detached) return; await this.check(jobId); }
    };
    this.polling = work().finally(() => { this.polling = undefined; });
    return this.polling;
  }
  private check(jobId: string): Promise<void> {
    const existing = this.pending.get(jobId); if (existing) return existing;
    const work = this.inspect(jobId).finally(() => { this.pending.delete(jobId); });
    this.pending.set(jobId, work); return work;
  }
  private async inspect(jobId: string): Promise<void> {
    const job = this.store.durableBuildJob(jobId); const execution = job?.durable;
    if (!execution || execution.acknowledged || this.detached) return;
    if (!this.port) { await this.noteError(jobId); return; }
    try {
      if (execution.appliedSequence !== undefined) { await this.acknowledge(jobId); return; }
      const initial = this.currentIntent(jobId, execution.ref); if (!initial) return;
      let cancelled = initial.cancel;
      const observed = cancelled ? await this.port.cancel(execution.ref) : await this.port.inspect(execution.ref);
      let current = this.currentIntent(jobId, execution.ref); if (!current) return;
      if (current.execution.appliedSequence !== undefined) { await this.acknowledge(jobId); return; }
      let snapshot = durableBuildSnapshotCheck(current.cancel && !cancelled ? await this.port.cancel(execution.ref) : observed);
      cancelled ||= current.cancel;
      const latest = this.store.durableBuildSnapshot(jobId);
      if (!sameDurableBuildRef(snapshot.ref, execution.ref) || latest && snapshot.sequence < latest.sequence) throw new Error('The original worker identity or journal sequence changed.');
      if (snapshot.phase === 'prepared' && !cancelled) {
        if (latest && latest.phase !== 'prepared') throw new Error('The original execution rolled back to preparation. Inspect before any further dispatch.');
        await this.configure();
        current = this.currentIntent(jobId, execution.ref); if (!current) return;
        if (current.execution.appliedSequence !== undefined) { await this.acknowledge(jobId); return; }
        cancelled = current.cancel;
        snapshot = cancelled ? await this.port.cancel(execution.ref) : await this.port.start(execution.ref);
        current = this.currentIntent(jobId, execution.ref); if (!current) return;
        if (current.cancel && !cancelled && current.execution.appliedSequence === undefined) { snapshot = await this.port.cancel(execution.ref); cancelled = true; }
      }
      await this.apply(jobId, snapshot);
      current = this.currentIntent(jobId, execution.ref);
      if (current?.cancel && !cancelled && current.execution.appliedSequence === undefined) await this.apply(jobId, await this.port.cancel(execution.ref));
    } catch { await this.noteError(jobId); }
  }
  private currentIntent(jobId: string, ref: DurableBuildRef) {
    const job = this.store.durableBuildJob(jobId); const execution = job?.durable;
    if (!job || !execution || execution.acknowledged || this.detached) return undefined;
    if (!sameDurableBuildRef(execution.ref, ref)) throw new Error('The original background execution reference changed.');
    return { execution, cancel: execution.intent === 'cancel' || this.store.workflowStopHeld(job.ideaId) || !['queued', 'running'].includes(job.status) && execution.appliedSequence === undefined };
  }
  private async apply(jobId: string, value: DurableBuildSnapshot): Promise<void> {
    if (this.detached) return;
    const snapshot = durableBuildSnapshotCheck(value);
    const current = this.store.durableBuildJob(jobId)?.durable; const latest = this.store.durableBuildSnapshot(jobId);
    if (!current || !sameDurableBuildRef(current.ref, snapshot.ref) || latest && snapshot.sequence < latest.sequence) throw new Error('The background execution identity or sequence changed.');
    if (current.appliedSequence !== undefined && current.snapshot?.phase !== snapshot.phase) throw new Error('The original terminal outcome changed. Inspect its immutable completion receipt.');
    if (latest && snapshot.sequence === latest.sequence && snapshot.phase !== latest.phase) throw new Error('The worker changed phase without a new sequence.');
    await this.store.observeDurableBuild(jobId, snapshot);
    if (current.appliedSequence !== undefined) { await this.acknowledge(jobId); return; }
    if (current.snapshot?.phase === snapshot.phase && !durableBuildTerminal(snapshot.phase)) return;
    await this.store.transaction(state => {
      const job = state.jobs.find(item => item.id === jobId); const execution = job?.durable;
      if (!job || !execution || !sameDurableBuildRef(execution.ref, snapshot.ref)) throw new Error('The background execution identity changed.');
      if (execution.snapshot && snapshot.sequence < execution.snapshot.sequence) throw new Error('The original worker journal sequence moved backwards.');
      if (execution.appliedSequence !== undefined) return;
      if (execution.snapshot && snapshot.sequence === execution.snapshot.sequence) {
        if (execution.snapshot.phase !== snapshot.phase) throw new Error('The worker changed phase without a new sequence.');
        execution.snapshot.lastContactAt = snapshot.lastContactAt; execution.snapshot.elapsedSeconds = Math.max(execution.snapshot.elapsedSeconds, snapshot.elapsedSeconds);
        delete execution.reconcileError; return;
      }
      execution.snapshot = snapshot; delete execution.reconcileError;
      projectDurableBuild(state, job, snapshot, this.complete);
      if (durableBuildTerminal(snapshot.phase)) execution.appliedSequence = snapshot.sequence;
    });
    await this.acknowledge(jobId);
  }
  private async acknowledge(jobId: string): Promise<void> {
    const job = this.store.durableBuildJob(jobId); const execution = job?.durable;
    if (!execution || execution.appliedSequence === undefined || execution.acknowledged || !this.port || this.detached) return;
    await this.port.acknowledge(execution.ref, execution.appliedSequence);
    if (this.detached) return;
    await this.store.transaction(state => { const current = state.jobs.find(item => item.id === jobId)?.durable; if (current && sameDurableBuildRef(current.ref, execution.ref)) { current.acknowledged = true; delete current.reconcileError; } });
    await this.store.observeDurableBuild(jobId, undefined, undefined, true);
    if (!this.detached && job.status === 'succeeded') await this.after?.(job.ideaId);
  }
  private async noteError(jobId: string): Promise<void> {
    if (this.detached) return;
    await this.store.observeDurableBuild(jobId, undefined, unavailable);
  }
  async detach(): Promise<void> { this.detached = true; await this.port?.detach?.(); }
}

import { DurableBuildCapacityError, type DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import { conversationText, type AgentConversationEvent } from '../../../features/coforge/domain/agent-conversation';
import { durableBuildResultCheck, durableBuildTerminal, type DurableBuildRef, type DurableBuildResult, type DurableBuildSnapshot } from '../../../features/coforge/domain/durable-build';
import type { Increment } from '../../../features/coforge/domain/types';
import type { StageUsage } from '../../../features/coforge/domain/ai-usage';
import { WorkerStore, workerSnapshot } from './store';
import { list, number, shape, text } from '../../../features/coforge/domain/check';
import { inputHash, workerRequestCheck } from './protocol';
import type { NativeProcessIdentity } from './process-identity';

export class WorkerOwnershipUnknown extends Error {}
export interface WorkerHooks {
  signal: AbortSignal;
  activity(): Promise<void>;
  phase(): Promise<void>;
  workspace(id: string): Promise<void>;
  changes(increment: Increment | null): Promise<void>;
  conversation(event: AgentConversationEvent): Promise<void>;
  usage(value: StageUsage): Promise<void>;
  cost(value: number): Promise<void>;
  launched(pid: number, launchId: string, identity?: NativeProcessIdentity): Promise<void>;
  log(message: string): Promise<void>;
}
export type BuildExecutor = (request: DurableBuildRequest, hooks: WorkerHooks) => Promise<DurableBuildResult>;
interface HotState { lastActivityAt?: string; lastContactAt: string; elapsedSeconds: number; logs: string[]; checkpointAt: number }
export class WorkerService {
  private pending: Promise<unknown> = Promise.resolve();
  private readonly active = new Map<string, { ref: DurableBuildRef; controller: AbortController; task: Promise<void> }>();
  private readonly hot = new Map<string, HotState>();
  private checkpointing = false;
  private closed = false;
  private maxBuilds = 1;
  private readonly releasedJobs = new Set<string>();
  constructor(readonly store: WorkerStore, private readonly execute: BuildExecutor) {}
  private command<T>(work: () => Promise<T>): Promise<T> { const next = this.pending.then(work); this.pending = next.catch(() => undefined); return next; }
  exclusive<T>(work: () => Promise<T>): Promise<T> { return this.command(work); }
  async initializeCapacity(): Promise<void> {
    const value = await this.store.files.read('capacity.json'); if (value !== undefined) this.maxBuilds = shape({ builds: number({ integer: true, min: 1, max: 16 }) }, { strict: true })(value).builds;
    for (const id of list(text({ min: 1, max: 160 }), { max: 10000 })(await this.store.files.read('released-jobs.json') ?? [])) this.releasedJobs.add(id);
  }
  configureConcurrency(maxBuilds: number): Promise<void> {
    return this.command(async () => { const builds = number({ integer: true, min: 1, max: 16 })(maxBuilds); if (builds === this.maxBuilds) return; await this.store.files.write('capacity.json', { builds }); this.maxBuilds = builds; });
  }
  prepare(request: DurableBuildRequest): Promise<DurableBuildRef> {
    return this.command(() => {
      if (this.closed) throw new Error('The Build worker is closed.');
      const checked = workerRequestCheck(request); const executionId = 'build-' + inputHash([checked.projectId, checked.jobId, checked.runId, checked.attemptId]).slice(0, 40);
      if (this.releasedJobs.has(checked.jobId)) throw new Error('This unused job was cancelled before admission. Its original execution can never start.');
      if (this.store.all().some(row => row.snapshot.ref.executionId === executionId)) return this.store.prepare(checked);
      const occupied = this.store.all().filter(row => !row.reservationReleased && (!durableBuildTerminal(row.snapshot.phase) || row.acknowledgedSequence !== row.snapshot.sequence));
      if (occupied.length >= this.maxBuilds) throw new DurableBuildCapacityError();
      if (occupied.some(row => {
        const other = this.store.get(row.snapshot.ref).request;
        return other.runId === checked.runId || other.projectId === checked.projectId && other.ideaId === checked.ideaId || checked.input.workflow.workspaceId !== undefined &&
          checked.input.workflow.workspaceId === (row.snapshot.workspaceId ?? other.input.workflow.workspaceId);
      })) throw new Error('This run or workspace already has exclusive background Build ownership.');
      return this.store.prepare(checked);
    });
  }
  cancelUnstarted(jobId: string): Promise<void> {
    return this.command(async () => {
      text({ min: 1, max: 160 })(jobId);
      const matches = this.store.all().filter(row => this.store.get(row.snapshot.ref).request.jobId === jobId);
      if (matches.length > 1) throw new Error('This job identity is ambiguous; no ownership was released.');
      const job = matches[0];
      if (job && !job.reservationReleased && (job.snapshot.phase !== 'prepared' || job.startIntent || job.provider)) throw new Error('This job has a start intent or original provider ownership. Use verified recovery.');
      if (!this.releasedJobs.has(jobId)) {
        if (this.releasedJobs.size >= 10000) throw new Error('Review retained unstarted cancellation history before releasing more jobs.');
        await this.store.files.write('released-jobs.json', [...this.releasedJobs, jobId]); this.releasedJobs.add(jobId);
      }
      if (job && !job.reservationReleased) await this.store.update(job.snapshot.ref, next => { next.snapshot.phase = 'cancelled'; next.snapshot.cancellationRequested = true; next.reservationReleased = true; });
    });
  }
  inspect(ref: DurableBuildRef): DurableBuildSnapshot {
    const snapshot = workerSnapshot(this.store.get(ref).record);
    this.mergeHot(ref, snapshot);
    snapshot.lastContactAt = new Date(this.store.now()).toISOString();
    if (snapshot.startedAt && !durableBuildTerminal(snapshot.phase)) snapshot.elapsedSeconds = Math.max(snapshot.elapsedSeconds, (this.store.now() - Date.parse(snapshot.startedAt)) / 1000);
    return snapshot;
  }
  private mergeHot(ref: DurableBuildRef, snapshot: DurableBuildSnapshot) {
    const hot = this.hot.get(ref.executionId); if (!hot) return;
    snapshot.lastActivityAt = hot.lastActivityAt; snapshot.lastContactAt = hot.lastContactAt; snapshot.elapsedSeconds = Math.max(snapshot.elapsedSeconds, hot.elapsedSeconds); snapshot.logs = [...hot.logs];
  }
  private busy(executionId: string): boolean {
    return this.store.all().filter(record => !record.reservationReleased && record.snapshot.ref.executionId !== executionId && record.snapshot.phase !== 'prepared' &&
      (!durableBuildTerminal(record.snapshot.phase) || record.acknowledgedSequence !== record.snapshot.sequence)).length >= this.maxBuilds;
  }
  start(ref: DurableBuildRef): Promise<DurableBuildSnapshot> {
    return this.command(async () => {
      const record = this.store.get(ref).record; const current = record.snapshot;
      if (record.reservationReleased) throw new Error('This unused Build reservation was released. Its original execution can never start.');
      if (current.phase !== 'prepared') return this.inspect(ref);
      if (this.closed || this.busy(ref.executionId)) throw new DurableBuildCapacityError();
      const started = await this.store.update(ref, next => { next.startIntent = true; next.snapshot.phase = 'starting'; next.snapshot.startedAt = new Date(this.store.now()).toISOString(); });
      const controller = new AbortController();
      this.hot.set(ref.executionId, { lastContactAt: started.lastContactAt, lastActivityAt: started.lastActivityAt, elapsedSeconds: started.elapsedSeconds, logs: [...started.logs], checkpointAt: this.store.now() });
      const task = Promise.resolve().then(() => this.run(ref, controller)).catch(() => { /* A failed durable journal remains unavailable/quarantined. */ });
      this.active.set(ref.executionId, { ref, controller, task }); return started;
    });
  }
  cancel(ref: DurableBuildRef): Promise<DurableBuildSnapshot> {
    return this.command(async () => {
      const original = this.store.get(ref).record; const current = original.snapshot;
      if (durableBuildTerminal(current.phase)) return this.inspect(ref);
      const snapshot = await this.store.update(ref, next => {
        next.snapshot.cancellationRequested = true;
        if (current.phase === 'prepared' && !original.startIntent && !original.provider) {
          next.snapshot.phase = 'cancelled'; next.reservationReleased = true;
        }
      });
      this.active.get(ref.executionId)?.controller.abort('operator');
      return snapshot;
    });
  }
  acknowledge(ref: DurableBuildRef, sequence: number): Promise<void> { return this.command(() => this.store.acknowledge(ref, sequence)); }
  private async run(ref: DurableBuildRef, controller: AbortController): Promise<void> {
    const request = this.store.get(ref).request;
    const update = (mutate: (snapshot: DurableBuildSnapshot) => void) => this.store.update(ref, next => { mutate(next.snapshot); this.mergeHot(ref, next.snapshot); });
    const hooks: WorkerHooks = {
      signal: controller.signal,
      phase: async () => { await update(snapshot => { snapshot.phase = 'finalizing'; }); },
      activity: async () => { const hot = this.hot.get(ref.executionId); if (hot) hot.lastActivityAt = new Date(this.store.now()).toISOString(); },
      workspace: async id => { if (!id.startsWith('bg-')) throw new Error('A background Build requires worker-owned workspace authority.'); await update(snapshot => { snapshot.workspaceId = id; }); },
      changes: async increment => { await update(snapshot => { snapshot.workspaceCaptured = true; snapshot.increment = increment ?? undefined; }); },
      usage: async usage => { await update(snapshot => { snapshot.usage = usage; }); },
      cost: async cost => { await update(snapshot => { snapshot.costUsd = cost; }); },
      launched: async (pid, launchId, identity) => { await this.store.update(ref, next => { next.provider = { pid, launchId, startedAt: new Date(this.store.now()).toISOString(), ...(identity ? { identity } : {}) }; this.mergeHot(ref, next.snapshot); }); },
      log: async message => { const hot = this.hot.get(ref.executionId); if (hot) hot.logs = [...hot.logs, message.slice(0, 1000)].slice(-50); },
      conversation: async event => {
        await update(snapshot => {
          const at = new Date(this.store.now()).toISOString();
          if (event.kind === 'request') {
            if (snapshot.conversation) throw new Error('This worker request was already captured.');
            snapshot.conversation = { capturedAt: at, instructions: conversationText(event.instructions), prompt: conversationText(event.prompt), simulated: false };
          } else {
            if (!snapshot.conversation || snapshot.conversation.response && !event.append) throw new Error('The worker response identity changed.');
            const previous = snapshot.conversation.response;
            const response = conversationText(previous ? previous.text + '\n\n--- Additional submitted response ---\n\n' + event.text : event.text);
            snapshot.conversation.response = { ...response, truncated: response.truncated || previous?.truncated === true };
            snapshot.conversation.responseCapturedAt = at;
          }
        });
      },
    };
    try {
      await update(snapshot => { snapshot.phase = 'running'; });
      const result = durableBuildResultCheck(await this.execute(request, hooks));
      if (controller.signal.aborted) throw new Error('Build stopped.');
      await this.store.get(ref).files.write('result.json', { version: 1, ref, result, providerTerminated: true });
      await update(snapshot => { snapshot.result = result; if (result.increment) snapshot.increment = result.increment; snapshot.phase = 'completed'; });
    } catch (error) {
      if (!(error instanceof WorkerOwnershipUnknown)) {
        const current = this.store.get(ref).record.snapshot;
        await this.store.get(ref).files.write('failure.json', { version: 1, ref, providerTerminated: true,
          phase: controller.signal.aborted && controller.signal.reason === 'operator' ? 'cancelled' : 'failed',
          ...(current.increment ? { increment: current.increment } : {}) }).catch(() => undefined);
      }
      await this.store.update(ref, next => {
        this.mergeHot(ref, next.snapshot);
        if (error instanceof WorkerOwnershipUnknown) { next.snapshot.phase = 'attention'; next.terminationUnknown = true; next.snapshot.error = 'Provider termination is unverified. The original Build and workspace remain quarantined.'; }
        else {
          next.snapshot.phase = controller.signal.aborted && controller.signal.reason === 'operator' ? 'cancelled' : 'failed';
          next.snapshot.error = controller.signal.reason === 'deadline' ? 'The captured Build execution deadline elapsed. Retained changes require review.'
            : controller.signal.aborted ? 'The background Build stopped. Retained changes require review.'
            : 'The background Build did not complete. Inspect its retained conversation and workspace before explicitly retrying.';
        }
      }).catch(() => undefined);
    } finally { this.active.delete(ref.executionId); this.hot.delete(ref.executionId); }
  }
  async tick(): Promise<void> {
    for (const [id, active] of this.active) {
      const { snapshot } = this.store.get(active.ref).record; const request = this.store.get(active.ref).request;
      const elapsed = Math.max(0, (this.store.now() - Date.parse(snapshot.startedAt ?? snapshot.createdAt)) / 1000);
      if (request.policy.maxRuntimeSeconds !== undefined && elapsed >= request.policy.maxRuntimeSeconds) active.controller.abort('deadline');
      const hot = this.hot.get(id); if (!hot) continue;
      hot.lastContactAt = new Date(this.store.now()).toISOString(); hot.elapsedSeconds = Math.max(hot.elapsedSeconds, elapsed);
      const idle = request.policy.idleWarningSeconds ?? 1800;
      const warning = 'Worker alive; no recent provider output observed. This is advisory, not a cancellation.';
      if (idle > 0 && this.store.now() - Date.parse(hot.lastActivityAt ?? snapshot.startedAt ?? snapshot.createdAt) >= idle * 1000 && !hot.logs.includes(warning))
        hot.logs = [...hot.logs, warning].slice(-50);
    }
    if (this.checkpointing) return;
    this.checkpointing = true;
    try {
      for (const [id, active] of this.active) {
        const hot = this.hot.get(id); if (!hot || this.store.now() - hot.checkpointAt < 60000) continue;
        hot.checkpointAt = this.store.now();
        await this.store.get(active.ref).files.write('hot.json', { ref: active.ref, ...hot });
      }
    } finally { this.checkpointing = false; }
  }
  activeCount(): number { return this.active.size; }
  ownsActive(ref: DurableBuildRef): boolean { return this.active.has(ref.executionId); }
  status(): { ready: boolean; reviewedSnapshots: true; operatorMaterializations: true; message: string } {
    try { this.store.all(); return { ready: !this.closed, reviewedSnapshots: true, operatorMaterializations: true, message: this.closed ? 'The background supervisor is closing.' : 'The original worker journal is available; capacity and per-run ownership remain enforced.' }; }
    catch { return { ready: false, reviewedSnapshots: true, operatorMaterializations: true, message: 'The original worker journal is unavailable. Preserve its retained evidence before retrying.' }; }
  }
  async settle(): Promise<void> { await Promise.all([...this.active.values()].map(active => active.task)); }
  async close(): Promise<void> { this.closed = true; for (const active of this.active.values()) active.controller.abort('worker-stopped'); await this.settle(); }
}

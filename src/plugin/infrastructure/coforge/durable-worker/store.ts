import { readdir } from 'node:fs/promises';
import { boolean, list, number, optional, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { durableBuildResultCheck, durableBuildSnapshotCheck, sameDurableBuildRef, type DurableBuildRef, type DurableBuildSnapshot } from '../../../features/coforge/domain/durable-build';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import { inputHash, workerRequestCheck } from './protocol';
import { WorkerFiles } from './files';
import { workflowVerificationRuntimeRecordsCheck } from '../../../features/coforge/domain/workflow-verification';
import { recoverWorkerVerification } from './verification-recovery';
import { nativeWorkflowPrivateRuntimeCheck } from '../../../features/coforge/domain/native-workflow-process';
import { appendAgentSessionEvent, type AgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { nativeWorkflowLifetimeRefCheck } from '../../../features/coforge/domain/native-workflow-lifetime';

const idsCheck = list(text({ pattern: /^build-[a-f0-9]{40}$/u }), { max: 1000 });
export const nativeIdentityCheck = shape({ pid: number({ integer: true, min: 1 }), platform: text({ min: 1, max: 40 }), birth: text({ min: 1, max: 320 }),
  image: text({ pattern: /^[a-f0-9]{64}$/u }), groupId: optional(number({ integer: true, min: 1 })) }, { strict: true });
const workerRecordShape = shape({ snapshot: durableBuildSnapshotCheck, acknowledgedSequence: optional(number({ integer: true, min: 0 })),
  provider: optional(shape({ pid: number({ integer: true, min: 1 }), launchId: text({ min: 1, max: 160 }), startedAt: text({ min: 1, max: 100 }), identity: optional(nativeIdentityCheck),
    contractCompletedAt: optional(timestamp), treeTerminatedAt: optional(timestamp), lifetime: optional(nativeWorkflowLifetimeRefCheck) }, { strict: true })),
  terminationUnknown: optional(boolean),
  verificationRuntime: optional(workflowVerificationRuntimeRecordsCheck),
  nativeRuntime: optional(nativeWorkflowPrivateRuntimeCheck),
  startIntent: optional(boolean), reservationReleased: optional(boolean),
  recovery: optional(shape({ version: number({ min: 1, max: 1 }), evidenceHash: text({ pattern: /^[a-f0-9]{64}$/u }), observedAt: text({ min: 1, max: 100 }), quiescent: boolean,
    workspaceCaptured: optional(boolean), increment: (value: unknown) => value === undefined ? undefined : durableBuildResultCheck({ increment: value }).increment }, { strict: true })),
}, { strict: true });
export const workerRecordCheck = (value: unknown) => {
  const record = workerRecordShape(value);
  if ((record.provider?.contractCompletedAt || record.provider?.treeTerminatedAt) && !record.provider.identity) throw new Error('Original provider identity is required for a quiescence receipt.');
  if (record.provider?.lifetime && !record.provider.identity) throw new Error('Original controller identity is required for native lifetime authority.');
  return record;
};
const recordCheck = workerRecordCheck;
export type WorkerRecord = ReturnType<typeof workerRecordCheck>;
export function workerSnapshot(record: WorkerRecord): DurableBuildSnapshot {
  const snapshot = structuredClone(record.snapshot);
  if (record.recovery?.quiescent && record.recovery.workspaceCaptured) { snapshot.workspaceCaptured = true; snapshot.increment = record.recovery.increment; }
  return snapshot;
}
interface Loaded { request: DurableBuildRequest; record: WorkerRecord; files: WorkerFiles }
export class WorkerStore {
  private readonly jobs = new Map<string, Loaded>();
  private pending: Promise<unknown> = Promise.resolve();
  private available = false;
  constructor(readonly files: WorkerFiles, readonly workerId: string, readonly epoch = 1, readonly now = () => Date.now()) {}
  async initialize(): Promise<void> {
    await this.files.initialize();
    const ids = idsCheck(await this.files.read('index.json') ?? []);
    const directories = (await readdir(this.files.directory)).filter(name => name.startsWith('build-'));
    if (directories.some(id => !ids.includes(id))) throw new Error('An unindexed Build reservation needs inspection before worker recovery.');
    for (const id of ids) {
      const files = await this.files.child(id); const request = workerRequestCheck(await files.read('input.json'));
      const record = recordCheck(await files.read('record.json'));
      if (record.snapshot.ref.executionId !== id || record.snapshot.ref.inputHash !== inputHash(request)) throw new Error('Build authorization identity changed.');
      if (record.nativeRuntime && (record.nativeRuntime.runId !== request.runId || record.nativeRuntime.attemptId !== request.attemptId || record.nativeRuntime.projectId !== request.projectId)) throw new Error('Private native authorization identity changed.');
      if (record.provider?.lifetime && (record.provider.lifetime.runId !== request.runId || record.provider.lifetime.attemptId !== request.attemptId || record.provider.lifetime.projectId !== request.projectId)) throw new Error('Private native lifetime authorization changed.');
      this.jobs.set(id, { request, record, files });
    }
    this.available = true;
    for (const job of this.jobs.values()) if (['starting', 'running', 'finalizing'].includes(job.record.snapshot.phase)) {
      await this.update(job.record.snapshot.ref, next => { next.snapshot.phase = 'attention'; next.terminationUnknown = true; next.snapshot.error = 'The original Build worker stopped without verified provider termination. Its work is quarantined; no provider was restarted.'; });
    }
    for (const job of this.jobs.values()) if (job.record.verificationRuntime?.some(record => record.phase !== 'terminal' || job.record.snapshot.verification?.some(evidence => evidence.id === record.verificationId && evidence.status === 'running'))) {
      const recovered = structuredClone(job.record);
      const proven = await recoverWorkerVerification(recovered);
      await this.update(job.record.snapshot.ref, next => {
        next.verificationRuntime = recovered.verificationRuntime; next.snapshot.verification = recovered.snapshot.verification;
        if (!proven) { next.snapshot.phase = 'attention'; next.terminationUnknown = true; next.snapshot.error = 'Original verification-container termination remains unverified. No command was replayed.'; }
      });
    }
  }
  private command<T>(work: () => Promise<T>): Promise<T> {
    const next = this.pending.then(work); this.pending = next.catch(() => undefined); return next;
  }
  private assertReady() { if (!this.available) throw new Error('The private Build journal is unavailable. Preserve it before retrying.'); }
  all(): WorkerRecord[] { this.assertReady(); return [...this.jobs.values()].map(job => structuredClone(job.record)); }
  get(ref: DurableBuildRef): Loaded {
    this.assertReady(); const found = this.jobs.get(ref.executionId);
    if (!found || !sameDurableBuildRef(found.record.snapshot.ref, ref)) throw new Error('The captured Build authorization does not match this worker job.');
    return found;
  }
  prepare(request: DurableBuildRequest): Promise<DurableBuildRef> {
    return this.command(async () => {
      this.assertReady(); const checked = workerRequestCheck(request); const hash = inputHash(checked);
      const executionId = 'build-' + inputHash([checked.projectId, checked.jobId, checked.runId, checked.attemptId]).slice(0, 40);
      const existing = this.jobs.get(executionId);
      if (existing) { if (existing.record.snapshot.ref.inputHash !== hash) throw new Error('This Build identity was already prepared with different captured input.'); return structuredClone(existing.record.snapshot.ref); }
      if ([...this.jobs.values()].some(job => job.request.jobId === checked.jobId)) throw new Error('This original job identity is already bound to another captured project, run or attempt.');
      if (this.jobs.size >= 1000) throw new Error('Review retained background Build history before preparing more jobs.');
      const files = await this.files.child(executionId);
      const previous = await files.read('input.json');
      if (previous !== undefined) throw new Error('An incomplete Build reservation requires inspection; it was not replayed.');
      const ref: DurableBuildRef = { version: 1, executionId, workerId: this.workerId, epoch: this.epoch, inputHash: hash };
      const at = new Date(this.now()).toISOString();
      const record: WorkerRecord = { snapshot: { version: 1, ref, sequence: 0, phase: 'prepared', createdAt: at, lastContactAt: at, elapsedSeconds: 0, logs: [] } };
      await files.create('input.json', checked); await files.write('record.json', record);
      await this.files.write('index.json', [...this.jobs.keys(), executionId]);
      this.jobs.set(executionId, { request: checked, record, files });
      return structuredClone(ref);
    });
  }
  update(ref: DurableBuildRef, mutate: (record: WorkerRecord) => void): Promise<DurableBuildSnapshot> {
    return this.command(async () => {
      const current = this.get(ref); const next = structuredClone(current.record); const oldPhase = next.snapshot.phase;
      mutate(next); next.snapshot.sequence++; next.snapshot.lastContactAt = new Date(this.now()).toISOString();
      if (next.snapshot.startedAt) next.snapshot.elapsedSeconds = Math.max(next.snapshot.elapsedSeconds, (this.now() - Date.parse(next.snapshot.startedAt)) / 1000, 0);
      const checked = recordCheck(next);
      try {
        if (checked.snapshot.phase !== oldPhase) {
          const events = list(shape({ sequence: number({ integer: true, min: 0 }), phase: text({ max: 40 }), at: text({ max: 100 }) }, { strict: true }), { max: 100 })(await current.files.read('events.json') ?? []);
          await current.files.write('events.json', [...events, { sequence: checked.snapshot.sequence, phase: checked.snapshot.phase, at: checked.snapshot.lastContactAt }]);
        }
        await current.files.write('record.json', checked); current.record = checked;
      } catch { this.available = false; throw new Error('The background Build journal could not commit. Work remains quarantined.'); }
      return structuredClone(checked.snapshot);
    });
  }
  /** Cosmetic observation writes never change control fields or quarantine a healthy provider. */
  observeSession(ref: DurableBuildRef, event: AgentSessionEvent): Promise<void> {
    return this.command(async () => {
      try {
        const current = this.get(ref); const next = structuredClone(current.record);
        next.snapshot.sessionTrace = appendAgentSessionEvent(next.snapshot.sessionTrace, event, new Date(this.now()).toISOString());
        next.snapshot.sequence++;
        const checked = recordCheck(next);
        await current.files.write('record.json', checked); current.record = checked;
      } catch { /* Lost display evidence cannot stop or replay the original provider. */ }
    });
  }
  acknowledge(ref: DurableBuildRef, sequence: number): Promise<void> {
    return this.command(async () => {
      const current = this.get(ref); const snapshot = current.record.snapshot;
      if (!['completed', 'failed', 'cancelled'].includes(snapshot.phase) || snapshot.sequence !== sequence || current.record.terminationUnknown || current.record.nativeRuntime || current.record.verificationRuntime?.some(item => item.phase !== 'terminal'))
        throw new Error('Only this verified terminal Build result can be acknowledged.');
      const record = { ...current.record, acknowledgedSequence: sequence };
      await current.files.write('record.json', record); current.record = record;
    });
  }
  replaceRecovered(ref: DurableBuildRef, record: WorkerRecord): Promise<void> {
    return this.command(async () => {
      const current = this.get(ref); const checked = workerRecordCheck(record);
      if (!sameDurableBuildRef(checked.snapshot.ref, ref) || checked.snapshot.sequence < current.record.snapshot.sequence) throw new Error('A newer original Build state must be inspected before recovery.');
      await current.files.write('record.json', checked); current.record = checked;
    });
  }
}

import { list, oneOf, optional, shape, text } from '../../../features/coforge/domain/check';
import { providerFailureFor, providerFailureInfoCheck, providerFailureMessage } from '../../../features/coforge/domain/provider-failure';
import { durableBuildRefCheck, durableBuildResultCheck, durableBuildTerminal, sameDurableBuildRef, type DurableBuildInspection, type DurableBuildRef, type DurableBuildSnapshot } from '../../../features/coforge/domain/durable-build';
import { WorkerFiles } from './files';
import { workerRecordCheck, workerSnapshot, nativeIdentityCheck, type WorkerRecord, type WorkerStore } from './store';
import { inputHash, workerRequestCheck } from './protocol';
import { inspectWorkerWorkspace } from './workspace-proof';
import { readNativeProcessIdentity, stopOwnedProcessTree, type NativeProcessIdentity, type ProcessTerminationProof } from './process-identity';
import { workerWorkspaces } from './workspaces';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { recoverWorkerVerification } from './verification-recovery';
import { recoverWorkerNativeRuntime } from './native-runtime';

export interface RecoveryProofDriver {
  read(pid: number): Promise<NativeProcessIdentity | undefined>;
  stop(identity: NativeProcessIdentity): Promise<ProcessTerminationProof>;
}
const nativeProof: RecoveryProofDriver = { read: readNativeProcessIdentity, stop: stopOwnedProcessTree };
const confirmed = (value: unknown): true => { if (value !== true) throw new Error('The original provider termination receipt is not confirmed.'); return true; };
const ids = list(text({ pattern: /^build-[a-f0-9]{40}$/u }), { max: 1000 });
export async function retainedJob(files: WorkerFiles, ref: DurableBuildRef) {
  const checked = durableBuildRefCheck(ref);
  if (!ids(await files.read('index.json') ?? []).includes(checked.executionId)) throw new Error('The original worker reservation is unavailable.');
  const jobFiles = new WorkerFiles(files.path(checked.executionId)); await jobFiles.attach();
  const request = workerRequestCheck(await jobFiles.read('input.json')); const record = workerRecordCheck(await jobFiles.read('record.json'));
  if (!sameDurableBuildRef(record.snapshot.ref, checked) || checked.inputHash !== inputHash(request)) throw new Error('The retained original Build identity changed.');
  if (record.nativeRuntime && (record.nativeRuntime.runId !== request.runId || record.nativeRuntime.attemptId !== request.attemptId || record.nativeRuntime.projectId !== request.projectId)) throw new Error('Retained private native authorization identity changed.');
  return { request, record, files: jobFiles };
}
export async function supervisorGone(files: WorkerFiles, ref: DurableBuildRef, driver = nativeProof): Promise<boolean> {
  return supervisorWorkerGone(files, ref.workerId, driver);
}
export async function supervisorWorkerGone(files: WorkerFiles, workerId: string, driver = nativeProof): Promise<boolean> {
  const raw = shape({ workerId: text(), identity: nativeIdentityCheck })(await files.read('daemon.json'));
  if (raw.workerId !== workerId || raw.identity.platform !== process.platform) return false;
  const observed = await driver.read(raw.identity.pid);
  return observed === undefined || observed.platform === raw.identity.platform && observed.birth !== raw.identity.birth;
}
export class WorkerRecovery {
  constructor(private readonly files: WorkerFiles, private readonly context?: { store: WorkerStore; workspaces: WorkflowWorkspaces; active(ref: DurableBuildRef): boolean }, private readonly proof = nativeProof) {}
  private async authority(ref: DurableBuildRef) {
    const job = await retainedJob(this.files, ref);
    if (this.context) {
      if (this.context.active(ref) || ['starting', 'running', 'finalizing'].includes(job.record.snapshot.phase))
        throw new Error('The original Build still owns execution. Stop it and wait for quiescent inspection.');
    } else if (!await supervisorGone(this.files, ref, this.proof)) throw new Error('The original supervisor still exists or its birth identity is unverified. Restore its connection before recovery.');
    return job;
  }
  async inspect(ref: DurableBuildRef): Promise<DurableBuildInspection> {
    const job = await this.authority(ref); const actual = await inspectWorkerWorkspace(this.files, job.request, job.record.snapshot);
    const snapshot = structuredClone(job.record.snapshot);
    if (!durableBuildTerminal(snapshot.phase)) { snapshot.phase = 'attention'; snapshot.error = 'Retained workspace inspected; original execution still requires verified recovery.'; }
    if (actual.record) snapshot.workspaceId = actual.record.id;
    snapshot.workspaceCaptured = Boolean(actual.record); snapshot.increment = actual.increment?.files.length ? actual.increment : undefined;
    return { version: 1, ref: structuredClone(ref), snapshot, observedAt: new Date().toISOString(), evidenceHash: actual.evidenceHash };
  }
  private async commit(ref: DurableBuildRef, next: WorkerRecord): Promise<DurableBuildSnapshot> {
    const current = await retainedJob(this.files, ref);
    const checked = workerRecordCheck(durableBuildTerminal(current.record.snapshot.phase) && !current.record.terminationUnknown && !next.terminationUnknown
      ? { ...current.record, verificationRuntime: next.verificationRuntime, nativeRuntime: next.nativeRuntime, ...(next.recovery ? { recovery: next.recovery } : {}) } : next);
    if (this.context) await this.context.store.replaceRecovered(ref, checked);
    else await current.files.write('record.json', checked);
    return workerSnapshot(checked);
  }
  async recover(ref: DurableBuildRef, inspected: true, minimumSequence: number, evidenceHash: string): Promise<DurableBuildSnapshot> {
    if (inspected !== true || !Number.isSafeInteger(minimumSequence) || minimumSequence < 0 || minimumSequence >= Number.MAX_SAFE_INTEGER) throw new Error('Fresh operator inspection and a valid original sequence are required.');
    text({ pattern: /^[a-f0-9]{64}$/u })(evidenceHash);
    const original = await this.authority(ref); const receipt = await this.inspect(ref);
    if (receipt.evidenceHash !== evidenceHash) throw new Error('The retained workspace changed after inspection. Inspect it again before recovery.');
    const next = structuredClone(original.record);
    const observedAt = new Date().toISOString();
    if (durableBuildTerminal(next.snapshot.phase) && !next.terminationUnknown) {
      if (!await recoverWorkerVerification(next) || !await recoverWorkerNativeRuntime(next)) {
        next.snapshot.phase = 'attention'; next.terminationUnknown = true; next.snapshot.error = 'Original verification-container termination remains unverified. No command was replayed.';
        return this.commit(ref, next);
      }
      const actual = await inspectWorkerWorkspace(this.files, original.request, next.snapshot);
      if (actual.evidenceHash !== evidenceHash) throw new Error('The retained workspace changed during inspection. Inspect it again before recovery.');
      if (actual.record) {
        const workspaces = this.context?.workspaces ?? workerWorkspaces(this.files);
        if (!this.context) await workspaces.start();
        await workspaces.acknowledge(actual.record.id, original.request.attemptId, true);
      }
      next.recovery = { version: 1, evidenceHash, observedAt, quiescent: true, workspaceCaptured: Boolean(actual.record), increment: actual.increment?.files.length ? actual.increment : undefined };
      // An already-applied result awaiting ACK retains its exact original phase, sequence and payload.
      return this.commit(ref, next);
    }
    let proven = false;
    const result = await original.files.read('result.json');
    if (result !== undefined) {
      const prepared = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, result: durableBuildResultCheck, providerTerminated: confirmed }, { strict: true })(result);
      if (!sameDurableBuildRef(prepared.ref, ref)) throw new Error('The prepared terminal result identity changed.');
      next.snapshot.result = prepared.result; next.snapshot.phase = 'completed'; proven = true;
    } else {
      const failed = await original.files.read('failure.json');
      if (failed !== undefined) {
        const prepared = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, providerTerminated: confirmed, phase: oneOf(['failed', 'cancelled'] as const), failure: optional(providerFailureInfoCheck), increment: (value: unknown) => value === undefined ? undefined : durableBuildResultCheck({ increment: value }).increment }, { strict: true })(failed);
        if (!sameDurableBuildRef(prepared.ref, ref)) throw new Error('The prepared interruption identity changed.');
        next.snapshot.phase = prepared.phase; if (prepared.failure) next.snapshot.failure = prepared.failure; proven = true;
      } else if (!next.startIntent && !next.provider && next.snapshot.phase === 'prepared') {
        next.snapshot.phase = 'cancelled'; next.reservationReleased = true; proven = true;
      } else if (!next.provider && next.nativeRuntime) {
        proven = await recoverWorkerNativeRuntime(next); next.snapshot.phase = proven ? 'cancelled' : 'attention';
      } else if (next.provider?.contractCompletedAt || next.provider?.treeTerminatedAt) {
        proven = true; next.snapshot.phase = 'cancelled';
      } else if (next.provider?.identity) {
        const receipt = await original.files.read('termination.json');
        if (receipt !== undefined) {
          const saved = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, provider: nativeIdentityCheck, treeConfirmed: confirmed, observedAt: text({ min: 1, max: 100 }) }, { strict: true })(receipt);
          if (!sameDurableBuildRef(saved.ref, ref) || inputHash(saved.provider) !== inputHash(next.provider.identity)) throw new Error('The retained process-tree proof identity changed.');
          proven = true;
        } else {
          const stopped = await this.proof.stop(next.provider.identity);
          proven = stopped.treeConfirmed && stopped.state === 'terminated';
          if (proven) await original.files.write('termination.json', { version: 1, ref, provider: next.provider.identity, treeConfirmed: true, observedAt: stopped.observedAt });
        }
        next.snapshot.phase = proven ? 'cancelled' : 'attention';
        if (proven) next.provider.treeTerminatedAt = new Date().toISOString();
      }
    }
    if (proven) proven = await recoverWorkerVerification(next) && await recoverWorkerNativeRuntime(next);
    const after = await this.inspect(ref);
    if (after.evidenceHash !== evidenceHash) throw new Error('The retained workspace changed during process verification. Inspect it again; no ownership was released.');
    next.snapshot.sequence = Math.max(next.snapshot.sequence, minimumSequence) + 1;
    next.snapshot.cancellationRequested = true;
    if (proven) {
      const actual = await inspectWorkerWorkspace(this.files, original.request, next.snapshot);
      if (actual.evidenceHash !== evidenceHash) throw new Error('The retained workspace changed during capture. Inspect it again; no ownership was released.');
      next.snapshot.workspaceCaptured = Boolean(actual.record); next.snapshot.increment = actual.increment?.files.length ? actual.increment : undefined;
      if (actual.record) {
        const workspaces = this.context?.workspaces ?? workerWorkspaces(this.files);
        if (!this.context) await workspaces.start();
        await workspaces.acknowledge(actual.record.id, original.request.attemptId, true);
      }
      next.terminationUnknown = false; next.recovery = { version: 1, evidenceHash, observedAt, quiescent: true, workspaceCaptured: Boolean(actual.record), increment: next.snapshot.increment };
      if (next.snapshot.failure) next.snapshot.failure = providerFailureFor(next.snapshot.failure.code);
      next.snapshot.error = next.snapshot.phase === 'completed' ? undefined : `${next.snapshot.failure ? providerFailureMessage(next.snapshot.failure) + ' ' : ''}Original execution termination and retained workspace were verified. No provider was resumed; explicit Restart is required.`;
    } else {
      next.snapshot.phase = 'attention'; next.terminationUnknown = true;
      if (next.snapshot.failure) next.snapshot.failure = providerFailureFor(next.snapshot.failure.code, true);
      next.snapshot.error = `${next.snapshot.failure ? providerFailureMessage(next.snapshot.failure, true) + ' ' : ''}Original process-tree termination remains unverified. Retained work stays quarantined; no unrelated process was signalled.`;
    }
    return this.commit(ref, next);
  }
  async acknowledge(ref: DurableBuildRef, sequence: number): Promise<void> {
    const job = await this.authority(ref);
    if (!durableBuildTerminal(job.record.snapshot.phase) || job.record.snapshot.sequence !== sequence || job.record.terminationUnknown || job.record.nativeRuntime || !job.record.recovery?.quiescent)
      throw new Error('Only the verified recovered terminal result can be acknowledged offline.');
    await job.files.write('record.json', { ...job.record, acknowledgedSequence: sequence });
    await this.markRetiredIfSettled(ref);
  }
  async releaseUnstarted(jobId: string): Promise<void> {
    text({ min: 1, max: 160 })(jobId);
    for (const id of ids(await this.files.read('index.json') ?? [])) {
      const directory = new WorkerFiles(this.files.path(id)); await directory.attach(); const record = workerRecordCheck(await directory.read('record.json'));
      const job = await retainedJob(this.files, record.snapshot.ref); if (job.request.jobId !== jobId) continue;
      if (!await supervisorGone(this.files, record.snapshot.ref, this.proof) || record.startIntent || record.provider || record.snapshot.phase !== 'prepared' && !record.reservationReleased)
        throw new Error('The original job has execution authority; unpaid cleanup cannot release it.');
      record.snapshot.phase = 'cancelled'; record.snapshot.cancellationRequested = true; record.snapshot.sequence++; record.reservationReleased = true;
      await directory.write('record.json', record); await this.markRetiredIfSettled(record.snapshot.ref);
    }
  }
  private async markRetiredIfSettled(ref: DurableBuildRef) {
    if (!await supervisorGone(this.files, ref, this.proof)) return;
    for (const id of ids(await this.files.read('index.json') ?? [])) {
      const directory = new WorkerFiles(this.files.path(id)); await directory.attach(); const row = workerRecordCheck(await directory.read('record.json'));
      if (!row.reservationReleased && (!durableBuildTerminal(row.snapshot.phase) || row.acknowledgedSequence !== row.snapshot.sequence || row.terminationUnknown)) return;
    }
    await this.files.write('retired.json', { workerId: ref.workerId, observedAt: new Date().toISOString(), quiescent: true });
  }
}

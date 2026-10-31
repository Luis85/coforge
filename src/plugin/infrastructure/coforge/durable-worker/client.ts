import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { setTimeout as pause } from 'node:timers/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { record, text } from '../../../features/coforge/domain/check';
import { durableBuildInspectionCheck, durableBuildRefCheck, durableBuildSnapshotCheck, sameDurableBuildRef, type DurableBuildRef, type DurableBuildSnapshot } from '../../../features/coforge/domain/durable-build';
import { DurableBuildCapacityError, type DurableBuildPort, type DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import type { Increment } from '../../../features/coforge/domain/types';
import type { WorkflowWorkspaces, WorkflowWorkspaceRequest } from '../../../features/coforge/application/workflow-workspace-ports';
import { WorkerFiles } from './files';
import { inputHash, workerDescriptorCheck, workerRequestCheck, type WorkerDescriptor } from './protocol';
import { nativeWorkerNode, workerEnvironment } from './node-runtime';
import { WorkerRecovery, retainedJob, supervisorGone } from './recovery';
import { archivedFiles, archiveGeneration, generationRetirable, generationLaunchCheck, sameGeneration } from './generation';
import { bootstrapReadiness, recordBootstrapExit, recordBootstrapSpawnFailure, repairBootstrap as repairUnusedBootstrap } from './bootstrap-repair';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { workerWorkspaces } from './workspaces';
import { captureIncrement } from '../agent-worktree';
import { verifyRetainedWorkspace } from './workspace-proof';
import { workerRecordCheck, workerSnapshot } from './store';
import { captureProjectProtection } from './protection';
import { retainedAuthorization } from './authorization';
import { durableReadWorkspace } from './read-workspace';

export interface DurableBuildClientOptions { workerSource: string; privateDirectory: string; nodeExecutable?: string | (() => string | undefined);
  vaultDirectory?: string; protectedVaultFolders?: () => readonly string[]; validatePrivateDirectory?: () => string }
const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const unreachable = () => new Error('The original background Build worker is unreachable. No provider was restarted; inspect its retained local evidence.');
async function rpc(descriptor: WorkerDescriptor, input: unknown, timeoutMs = 10000): Promise<unknown> {
  const serialized = JSON.stringify(input); if (Buffer.byteLength(serialized) > 16 * 1024 * 1024) throw new Error('The captured worker request exceeds its private limit.');
  return new Promise((resolve, reject) => {
    const request = httpRequest(descriptor.endpoint, { method: 'POST', headers: { authorization: 'Bearer ' + descriptor.token, 'content-type': 'application/json', 'content-length': Buffer.byteLength(serialized) } }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('error', () => reject(unreachable())); response.on('aborted', () => reject(unreachable()));
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 16 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
      response.on('end', () => {
        try { const value = record(JSON.parse(Buffer.concat(chunks).toString('utf8'))); if (value.ok !== true) { const message = text({ max: 3900 })(value.error ?? 'The worker operation failed.'); throw value.code === 'CAPACITY' ? new DurableBuildCapacityError(message) : new Error(message); } resolve(value.value); }
        catch (error) { reject(error instanceof Error ? error : unreachable()); }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy()); request.on('error', () => reject(unreachable())); request.end(serialized);
  });
}
export class DurableBuildClient implements DurableBuildPort {
  private readonly files: WorkerFiles;
  private preparing: Promise<WorkerDescriptor> | undefined;
  private maxBuilds = 1;
  private readonly snapshots = new Map<string, DurableBuildSnapshot>();
  private readonly unstarted = new Set<string>();
  constructor(private readonly options: DurableBuildClientOptions) { this.files = new WorkerFiles(options.privateDirectory); }
  private validateDirectory() {
    if (!this.options.validatePrivateDirectory) return;
    const approved = resolve(this.options.validatePrivateDirectory()); const original = resolve(this.options.privateDirectory);
    if ((process.platform === 'win32' ? approved.toLowerCase() !== original.toLowerCase() : approved !== original))
      throw new Error('The original local worker directory is no longer approved. No retained reference was retargeted.');
  }
  private node() { const configured = typeof this.options.nodeExecutable === 'function' ? this.options.nodeExecutable() : this.options.nodeExecutable; return nativeWorkerNode(configured ?? 'node'); }
  private async existing(): Promise<WorkerDescriptor | undefined> {
    this.validateDirectory();
    try { await this.files.attach(); const value = await this.files.read('descriptor.json'); return value === undefined ? undefined : workerDescriptorCheck(value); }
    catch (error) { if (missing(error)) return undefined; throw error; }
  }
  private async connected(descriptor: WorkerDescriptor): Promise<WorkerDescriptor> {
    const observed = workerDescriptorCheck(await rpc(descriptor, { op: 'health' }));
    if (inputHash(observed) !== inputHash(descriptor)) throw unreachable(); return observed;
  }
  private async settledGeneration(): Promise<string | undefined> {
    try {
      if (await this.files.read('daemon.json') === undefined) return undefined;
      const launch = generationLaunchCheck(await this.files.read('launch.json'));
      return await generationRetirable(this.files, launch.workerId) ? launch.workerId : undefined;
    } catch { return undefined; }
  }
  async readiness() {
    try {
      this.validateDirectory();
      const node = await this.node(); let existing;
      try { existing = await this.existing(); }
      catch (error) { if (await this.settledGeneration()) return { ready: true, message: 'Verified previous work is settled. A fresh preparation may archive its evidence and create a new supervisor.' }; throw error; }
      if (existing) {
        try { await this.connected(existing); const status = record(await rpc(existing, { op: 'workerStatus' })); return { ready: status.ready === true, message: text({ max: 3900 })(status.message) + ' Native Node.js ' + node.version + ' validated.' }; }
        catch { if (await this.settledGeneration()) return { ready: true, message: 'Verified previous work is settled. Preparing a fresh Build may create a new supervisor; no old execution will resume.' }; return { ready: false, ...await bootstrapReadiness(this.files) }; }
      }
      try {
        if (await this.files.read('launch.json')) {
          if (await this.settledGeneration()) return { ready: true, message: 'Verified previous work is settled. A fresh preparation may archive its evidence and create a new supervisor.' };
          return { ready: false, ...await bootstrapReadiness(this.files) };
        }
      } catch (error) { if (!missing(error)) throw error; }
      return { ready: true, message: 'Native Node.js ' + node.version + ' is ready. Preparing a Build will start its private supervisor; no model request was made.' };
    } catch (error) { return { ready: false, message: error instanceof Error && !/[/\\]/u.test(error.message) ? error.message : 'The native Node runtime or original worker needs inspection before starting Builds.' }; }
  }
  private async launch(): Promise<WorkerDescriptor> {
    const node = await this.node(); let existing;
    try { existing = await this.existing(); }
    catch (error) { const settled = await this.settledGeneration(); if (!settled) throw error; await archiveGeneration(this.files, settled); return this.launch(); }
    if (existing) {
      try { return await this.connected(existing); }
      catch { if (!await this.settledGeneration()) throw unreachable(); await archiveGeneration(this.files, existing.workerId); return this.launch(); }
    }
    await this.files.initialize();
    if (await this.files.read('launch.json')) {
      const settled = await this.settledGeneration(); if (!settled) throw unreachable();
      await archiveGeneration(this.files, settled); return this.launch();
    }
    const sourceHash = inputHash(this.options.workerSource); const filename = 'worker-' + sourceHash + '.cjs';
    try { await this.files.createSource(filename, this.options.workerSource); }
    catch { if (inputHash(await this.files.source(filename)) !== sourceHash) throw new Error('The background worker bundle could not be verified.'); }
    const identity = { version: 1, workerId: randomUUID(), epoch: 1, nonce: randomUUID(), token: randomBytes(32).toString('hex'), sourceHash };
    try { await this.files.create('launch.json', identity); } catch { throw unreachable(); }
    const child = spawn(node.executable, [this.files.path(filename), '--coforge-worker', this.files.directory], { cwd: this.files.directory, env: workerEnvironment(),
      shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
    let failed = false; let spawned = false; child.once('spawn', () => { spawned = true; });
    child.once('error', error => {
      failed = true;
      if (!spawned && child.pid === undefined && 'code' in error && typeof error.code === 'string' && ['ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'EINVAL'].includes(error.code)) {
        try { this.validateDirectory(); void recordBootstrapSpawnFailure(this.files, identity, error.code).catch(() => undefined); } catch { /* An invalid directory never receives a proof. */ }
      }
    });
    child.once('exit', (code, signal) => { try { this.validateDirectory(); void recordBootstrapExit(this.files, identity, code, signal).catch(() => undefined); } catch { /* Retained references are not retargeted. */ } });
    child.unref();
    for (let attempt = 0; attempt < 300; attempt++) {
      if (failed) throw new Error('Native Node could not launch the prepared worker. Its launch reservation was preserved.');
      const descriptor = await this.files.read('descriptor.json');
      if (descriptor) {
        const checked = workerDescriptorCheck(descriptor);
        if (checked.workerId !== identity.workerId || checked.nonce !== identity.nonce || checked.sourceHash !== sourceHash) throw unreachable();
        return this.connected(checked);
      }
      if ((await bootstrapReadiness(this.files)).repairable) throw new Error('The unused worker startup failed. Inspect and repair its retained startup before another preparation.');
      await pause(100);
    }
    throw unreachable();
  }
  private ensure(): Promise<WorkerDescriptor> { return this.preparing ??= this.launch().finally(() => { this.preparing = undefined; }); }
  private async dataset(ref: DurableBuildRef): Promise<WorkerFiles> {
    this.validateDirectory(); const checked = durableBuildRefCheck(ref);
    try {
      await this.files.attach();
      const launch = generationLaunchCheck(await this.files.read('launch.json'));
      if (launch.workerId === checked.workerId && launch.epoch === checked.epoch) return this.files;
    } catch {
      // Offline evidence is authorized by its complete original ref/input hash, never by a corrupt endpoint.
      try { await retainedJob(this.files, checked); return this.files; } catch { /* Try the immutable archived generation. */ }
    }
    const archived = await archivedFiles(this.files, checked.workerId);
    if (!archived) throw unreachable(); return archived;
  }
  private async original(ref: DurableBuildRef): Promise<WorkerDescriptor> {
    const checked = durableBuildRefCheck(ref); const files = await this.dataset(checked); const descriptor = workerDescriptorCheck(await files.read('descriptor.json'));
    if (!descriptor || descriptor.workerId !== checked.workerId || descriptor.epoch !== checked.epoch) throw unreachable();
    const launch = generationLaunchCheck(await files.read('launch.json')); if (!sameGeneration(launch, descriptor)) throw unreachable();
    return this.connected(descriptor);
  }
  async prepare(request: DurableBuildRequest): Promise<DurableBuildRef> {
    this.validateDirectory();
    if (!this.options.vaultDirectory || !this.options.protectedVaultFolders) throw new Error('The managed vault-folder authority is unavailable. No background provider was started.');
    const protection = await captureProjectProtection(this.options.vaultDirectory, request.input.integration.projectPath,
      [...this.options.protectedVaultFolders(), request.input.integration.ideasFolder, request.input.integration.publicFolder]);
    const checked = workerRequestCheck({ ...request, protectedProjectPaths: protection.protectedProjectPaths,
      input: { ...request.input, integration: { ...request.input.integration, projectPath: protection.projectRoot } } });
    const retained = await retainedAuthorization(this.files, checked); if (retained) return retained;
    const descriptor = await this.ensure();
    const raced = await retainedAuthorization(this.files, checked); if (raced) return raced;
    await rpc(descriptor, { op: 'configureConcurrency', builds: this.maxBuilds });
    for (const jobId of this.unstarted) { await rpc(descriptor, { op: 'cancelUnstarted', jobId }); this.unstarted.delete(jobId); }
    const ref = durableBuildRefCheck(await rpc(descriptor, { op: 'prepare', request: checked }));
    if (ref.workerId !== descriptor.workerId || ref.epoch !== descriptor.epoch || ref.inputHash !== inputHash(checked)) throw unreachable();
    return ref;
  }
  private async snapshot(op: 'start' | 'inspect' | 'cancel', ref: DurableBuildRef): Promise<DurableBuildSnapshot> {
    const descriptor = await this.original(ref); const previous = this.snapshots.get(ref.executionId);
    const snapshot = durableBuildSnapshotCheck(await rpc(descriptor, { op, ref, ...(op === 'inspect' && previous ? { sequence: previous.sequence } : {}) }));
    if (!sameDurableBuildRef(snapshot.ref, ref)) throw unreachable();
    const merged = previous?.sequence === snapshot.sequence ? { ...previous, ...snapshot,
      conversation: snapshot.conversation ?? previous.conversation, increment: snapshot.workspaceCaptured ? snapshot.increment : snapshot.increment ?? previous.increment, result: snapshot.result ?? previous.result } : snapshot;
    this.snapshots.set(ref.executionId, merged); return merged;
  }
  start(ref: DurableBuildRef) { return this.snapshot('start', ref); }
  async inspect(ref: DurableBuildRef) {
    try { return await this.snapshot('inspect', ref); }
    catch (error) {
      const job = await retainedJob(await this.dataset(ref), ref);
      if (job.record.recovery?.quiescent && ['completed', 'failed', 'cancelled'].includes(job.record.snapshot.phase)) return workerSnapshot(job.record);
      throw error;
    }
  }
  async inspectRetained(ref: DurableBuildRef) {
    let inspection;
    try { inspection = durableBuildInspectionCheck(await rpc(await this.original(ref), { op: 'inspectRetained', ref }, 60000)); }
    catch { inspection = await new WorkerRecovery(await this.dataset(ref)).inspect(ref); }
    if (!sameDurableBuildRef(inspection.ref, ref) || !sameDurableBuildRef(inspection.snapshot.ref, ref)) throw unreachable();
    return inspection;
  }
  async recover(ref: DurableBuildRef, inspected: true, minimumSequence: number, evidenceHash: string): Promise<DurableBuildSnapshot> {
    let snapshot;
    try { snapshot = durableBuildSnapshotCheck(await rpc(await this.original(ref), { op: 'recover', ref, inspected, minimumSequence, evidenceHash }, 90000)); }
    catch { snapshot = await new WorkerRecovery(await this.dataset(ref)).recover(ref, inspected, minimumSequence, evidenceHash); }
    if (!sameDurableBuildRef(snapshot.ref, ref)) throw unreachable(); this.snapshots.delete(ref.executionId); return snapshot;
  }
  cancel(ref: DurableBuildRef) { return this.snapshot('cancel', ref); }
  async acknowledge(ref: DurableBuildRef, sequence: number): Promise<void> {
    try { await rpc(await this.original(ref), { op: 'acknowledge', ref, sequence }); }
    catch { await new WorkerRecovery(await this.dataset(ref)).acknowledge(ref, sequence); }
    this.snapshots.delete(ref.executionId);
  }
  async repairBootstrap(inspected: true) { this.validateDirectory(); await repairUnusedBootstrap(this.files, inspected); return this.readiness(); }
  async detach(): Promise<void> { this.snapshots.clear(); /* A host detaches; it never cancels admitted execution. */ }
  async configureConcurrency(maxBuilds: number): Promise<void> {
    if (!Number.isInteger(maxBuilds) || maxBuilds < 1 || maxBuilds > 16) throw new Error('Choose between 1 and 16 concurrent background Builds.');
    let descriptor;
    try { descriptor = await this.existing(); }
    catch (error) { if (!await this.settledGeneration()) throw error; }
    if (descriptor) {
      try { await this.connected(descriptor); await rpc(descriptor, { op: 'configureConcurrency', builds: maxBuilds }); }
      catch (error) { if (!await this.settledGeneration()) throw error; }
    } else {
      try { if (await this.files.read('launch.json') && !await this.settledGeneration()) throw unreachable(); }
      catch (error) { if (!missing(error)) throw error; }
    }
    this.maxBuilds = maxBuilds;
  }
  async cancelUnstarted(jobId: string): Promise<void> {
    text({ min: 1, max: 160 })(jobId); this.unstarted.add(jobId);
    const descriptor = await this.existing(); if (!descriptor) return;
    try { await this.connected(descriptor); await rpc(descriptor, { op: 'cancelUnstarted', jobId }); this.unstarted.delete(jobId); }
    catch { await new WorkerRecovery(this.files).releaseUnstarted(jobId); this.unstarted.delete(jobId); }
  }
  ownsWorkspace(id: string): boolean { return id.startsWith('bg-'); }
  async readWorkspace(request: WorkflowWorkspaceRequest) {
    if (!request.workspaceId || !this.ownsWorkspace(request.workspaceId)) throw new Error('The original background workspace identity is required.');
    return durableReadWorkspace(await this.workspaceDataset(request.workspaceId), request, (id, expected) => this.assertReviewable(id, expected));
  }
  private async workspaceDataset(workspaceId: string): Promise<WorkerFiles> {
    this.validateDirectory();
    text({ pattern: /^bg-[a-zA-Z0-9_-]+$/u })(workspaceId);
    const candidates: WorkerFiles[] = [];
    try { await this.files.attach(); candidates.push(this.files); } catch (error) { if (!missing(error)) throw error; }
    const archiveRoot = new WorkerFiles(join(dirname(this.files.directory), basename(this.files.directory) + '-archive'));
    try {
      await archiveRoot.attach(); const entries = await readdir(archiveRoot.directory);
      if (entries.length > 1000) throw new Error('Review retained worker generations before inspecting older workspaces.');
      for (const workerId of entries) { const files = await archivedFiles(this.files, workerId); if (files) candidates.push(files); }
    } catch (error) { if (!missing(error)) throw error; }
    for (const files of candidates) {
      if (workflowWorkspaceRecordsCheck(await files.read('workspaces.json') ?? []).some(row => row.id === workspaceId)) return files;
    }
    throw new Error('The original background workspace generation is unavailable.');
  }
  private async offlineWorkspace(files: WorkerFiles, workspaceId: string) {
    const rows = workflowWorkspaceRecordsCheck(await files.read('workspaces.json') ?? []); const workspace = rows.find(row => row.id === workspaceId);
    if (!workspace) throw unreachable();
    let matched: DurableBuildRef | undefined;
    const ids = await files.read('index.json'); if (!Array.isArray(ids)) throw unreachable();
    for (const id of ids) {
      if (typeof id !== 'string') throw unreachable(); const child = new WorkerFiles(files.path(id)); await child.attach();
      const row = workerRecordCheck(await child.read('record.json'));
      if (row.snapshot.workspaceId !== workspaceId) continue;
      if (!['completed', 'failed', 'cancelled'].includes(row.snapshot.phase) || row.terminationUnknown) throw new Error('The original workspace still has unverified execution ownership.');
      const job = await retainedJob(files, row.snapshot.ref);
      if (job.request.runId !== workspace.runId || job.request.projectId !== workspace.projectId) throw unreachable();
      matched = row.snapshot.ref;
    }
    if (!matched || !await supervisorGone(files, matched)) throw new Error('Restore the original worker connection before reviewing its workspace.');
    await verifyRetainedWorkspace(workspace); return workspace;
  }
  async assertReviewable(workspaceId: string, increment?: Increment): Promise<void> {
    const files = await this.workspaceDataset(workspaceId);
    try { const descriptor = workerDescriptorCheck(await files.read('descriptor.json')); await this.connected(descriptor); await rpc(descriptor, { op: 'workspaceReview', workspaceId, increment }, 60000); return; }
    catch {
      const workspace = await this.offlineWorkspace(files, workspaceId);
      if (workspace.activeAttemptId || workspace.phase !== 'ready') throw new Error('Recover the original workspace lease before code review.');
      if (increment) { const actual = await captureIncrement(workspace.cwd, workspace.branch, increment.summary, undefined, { allowEmpty: true, baseCommit: workspace.baseCommit });
        if (actual.diff !== increment.diff || inputHash(actual.files) !== inputHash(increment.files) || actual.branch !== increment.branch || actual.worktree !== increment.worktree) throw new Error('The background workspace changed after its review snapshot. Inspect the current changes.'); }
    }
  }
  async acknowledgeWorkspace(workspaceId: string, attemptId: string, reusable = false): Promise<void> {
    const files = await this.workspaceDataset(workspaceId);
    try { const descriptor = workerDescriptorCheck(await files.read('descriptor.json')); await this.connected(descriptor); await rpc(descriptor, { op: 'workspaceAcknowledge', workspaceId, attemptId, reusable }, 60000); return; }
    catch { const workspace = await this.offlineWorkspace(files, workspaceId); if (workspace.activeAttemptId !== attemptId && workspace.lastAttemptId !== attemptId) throw unreachable(); const authority = workerWorkspaces(files); await authority.start(); await authority.acknowledge(workspaceId, attemptId, reusable); }
  }
}
export const createDurableBuildClient = (options: DurableBuildClientOptions) => new DurableBuildClient(options);
export function durableBuildWorkspaces(client: DurableBuildClient, fallback: WorkflowWorkspaces): WorkflowWorkspaces {
  return { start: () => fallback.start(), acquire: async input => {
      if (input.workspaceId && client.ownsWorkspace(input.workspaceId)) {
        if (input.access === 'none') return fallback.acquire({ ...input, workspaceId: undefined });
        if (input.access === 'readproject') return client.readWorkspace(input);
        throw new Error('This workspace belongs to its background worker. Editing requires a background Build.');
      }
      return fallback.acquire(input);
    },
    assertReviewable: (id, expected) => client.ownsWorkspace(id) ? client.assertReviewable(id, expected) : fallback.assertReviewable(id, expected),
    acknowledge: (id, attemptId, reusable) => client.ownsWorkspace(id) ? client.acknowledgeWorkspace(id, attemptId, reusable) : fallback.acknowledge(id, attemptId, reusable) };
}

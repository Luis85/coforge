import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { list, text } from '../../../features/coforge/domain/check';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import type { DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { WorkerFiles } from './files';
import { archivedFiles, generationLaunchCheck } from './generation';
import { inputHash, workerRequestCheck } from './protocol';
import { retainedJob } from './recovery';
import { workerRecordCheck } from './store';

const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
/** Retained generations remain authorization records; rollover never makes an old intent new. */
export async function retainedDatasets(files: WorkerFiles): Promise<WorkerFiles[]> {
  const candidates: WorkerFiles[] = [];
  try { await files.attach(); candidates.push(files); } catch (error) { if (!missing(error)) throw error; }
  const archiveRoot = new WorkerFiles(join(dirname(files.directory), basename(files.directory) + '-archive'));
  try {
    await archiveRoot.attach(); const entries = await readdir(archiveRoot.directory);
    if (entries.length > 1000) throw new Error('Review retained worker generations before preparing more Builds.');
    for (const workerId of entries) { const archived = await archivedFiles(files, workerId); if (archived) candidates.push(archived); }
  } catch (error) { if (!missing(error)) throw error; }
  return candidates;
}
export async function retainedAuthorization(files: WorkerFiles, request: DurableBuildRequest): Promise<DurableBuildRef | undefined> {
  const executionId = 'build-' + inputHash([request.projectId, request.jobId, request.runId, request.attemptId]).slice(0, 40);
  let original: DurableBuildRef | undefined;
  for (const dataset of await retainedDatasets(files)) {
    const cancelled = list(text({ min: 1, max: 160 }), { max: 10000 })(await dataset.read('released-jobs.json') ?? []);
    if (cancelled.includes(request.jobId)) throw new Error('This original unpaid job was cancelled. A fresh explicit Restart requires a new attempt identity.');
    const ids = list(text({ pattern: /^build-[a-f0-9]{40}$/u }), { max: 1000 })(await dataset.read('index.json') ?? []);
    for (const id of ids) {
      const task = new WorkerFiles(dataset.path(id)); await task.attach();
      const captured = workerRequestCheck(await task.read('input.json'));
      if (captured.jobId !== request.jobId && id !== executionId) continue;
      const launch = generationLaunchCheck(await dataset.read('launch.json')); const record = workerRecordCheck(await task.read('record.json'));
      const ref = record.snapshot.ref;
      if (ref.executionId !== id || ref.workerId !== launch.workerId || ref.epoch !== launch.epoch) throw new Error('The retained Build authorization identity changed.');
      await retainedJob(dataset, ref);
      if (ref.executionId !== executionId || ref.inputHash !== inputHash(request)) throw new Error('This original Build identity already has different immutable captured input. It cannot authorize another provider run.');
      if (original && inputHash(original) !== inputHash(ref)) throw new Error('Multiple retained generations claim this Build identity. No provider was started.');
      original = structuredClone(ref);
    }
  }
  return original;
}

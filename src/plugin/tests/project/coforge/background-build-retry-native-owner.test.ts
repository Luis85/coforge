import { rm } from 'node:fs/promises';
import { afterEach, expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { RetrySeedStore, retrySeedDirectory } from '../../../infrastructure/coforge/background-build-seed/store';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it('stages and authorizes actual private lease A while keeping failed never-acquired executor B as consent provenance', async () => {
  const f = await retrySourceFixture(folders);
  const source = { ...f.source, sourceJobId: 'hinted-failed-job', sourceAttemptId: 'hinted-failed-attempt', executorJobId: 'hinted-failed-job', executorAttemptId: 'hinted-failed-attempt',
    executorCandidates: [{ jobId: f.source.sourceJobId, attemptId: f.source.sourceAttemptId }, { jobId: 'hinted-failed-job', attemptId: 'hinted-failed-attempt' }] };
  const inspection = await f.resources.inspect(source);
  expect(inspection.sourceOwner).toEqual({ kind: 'attempt', jobId: f.source.sourceJobId, attemptId: f.source.sourceAttemptId });
  const store = new RetrySeedStore(retrySeedDirectory(f.privateDirectory)); const staged = await store.read(inspection.snapshot);
  expect(staged.manifest.source).toMatchObject({ sourceJobId: f.source.sourceJobId, sourceAttemptId: f.source.sourceAttemptId, executorJobId: 'hinted-failed-job', executorAttemptId: 'hinted-failed-attempt' });
  const target = { kind: 'retry' as const, runId: f.source.runId, retryId: 'actual-owner-retry', jobId: 'new-job', attemptId: 'new-attempt' };
  await expect(f.resources.verify(source, inspection.snapshot, target)).rejects.toThrow();
  await f.resources.verify({ ...source, sourceJobId: f.source.sourceJobId, sourceAttemptId: f.source.sourceAttemptId }, inspection.snapshot, target);
  await expect(f.resources.inspect({ ...source, executorCandidates: [{ jobId: 'hinted-failed-job', attemptId: 'hinted-failed-attempt' }] })).rejects.toThrow('actual original workspace lease');
}, 90000);

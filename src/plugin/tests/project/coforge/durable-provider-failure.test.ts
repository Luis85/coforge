import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerOwnershipUnknown, WorkerService } from '../../../infrastructure/coforge/durable-worker/service';
import { ProviderFailureError, assignProviderFailure, providerFailureFor } from '../../../features/coforge/domain/provider-failure';
import { durableRequest } from './durable-worker-fixture';

it.each([false, true])('persists the safe cause and known spend without losing ownership uncertainty=%s', async unknown => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-failure-proof-'));
  const journal = new WorkerStore(new WorkerFiles(directory), 'worker-one', 1); await journal.initialize();
  const info = providerFailureFor('model_access', unknown);
  const service = new WorkerService(journal, async (_request, hooks) => {
    await hooks.cost(0.5);
    if (unknown) throw assignProviderFailure(new WorkerOwnershipUnknown('Internal uncertainty'), info);
    throw new ProviderFailureError(info);
  });
  try {
    const ref = await service.prepare(durableRequest()); await service.start(ref); await service.settle();
    const failed = service.inspect(ref);
    expect(failed).toMatchObject({ phase: unknown ? 'attention' : 'failed', failure: info, costUsd: 0.5 });
    expect(failed.error).toContain(info.summary); expect(failed.error).toContain(info.nextStep);
    expect(journal.get(ref).record.terminationUnknown).toBe(unknown || undefined);
    const receipt = await journal.get(ref).files.read('failure.json');
    if (unknown) expect(receipt).toBeUndefined(); else expect(receipt).toMatchObject({ failure: info });
    if (unknown) await expect(service.acknowledge(ref, failed.sequence)).rejects.toThrow();
  } finally { await service.close(); await rm(directory, { recursive: true, force: true }); }
});

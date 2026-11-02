import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { migrateWorkerData } from '../../../infrastructure/coforge/worker-data-migration';
import { durableBuildDirectory } from '../../../infrastructure/coforge/durable-build-environment';
import { DurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { durableRequest } from './durable-worker-fixture';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve('.nq') + sep)) throw new Error('Invalid fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'worker-data-'))); roots.push(root);
  const vault = join(root, 'vault'), legacy = join(root, 'old-worker');
  await mkdir(vault); await mkdir(legacy);
  return { vault, legacy };
}
const launch = { version: 1, workerId: 'worker-fixture', epoch: 1, nonce: 'fixture-nonce', token: 'a'.repeat(64), sourceHash: 'b'.repeat(64) };
it('places new machine-specific worker data inside the vault and preserves quiescent legacy generations exactly', async () => {
  const f = await fixture();
  const source = JSON.stringify(launch, null, 2) + '\n';
  await writeFile(join(f.legacy, 'launch.json'), source);
  await writeFile(join(f.legacy, 'launch-spawn-failure.json'), JSON.stringify({ ...launch, token: undefined, epoch: undefined,
    confirmedNotStarted: true, code: 'ENOENT', observedAt: '2026-11-02T10:00:00Z' }));
  const result = await migrateWorkerData(f.vault, f.legacy);
  expect(result.migrationPending).toBe(false);
  expect(result.directory).toBe(durableBuildDirectory(f.vault));
  expect(result.directory.startsWith(join(f.vault, '.coforge-data', 'runtime', 'workers') + sep)).toBe(true);
  expect(await readFile(join(result.directory, 'launch.json'), 'utf8')).toBe(source);
  await expect(readFile(join(f.legacy, 'launch.json'))).rejects.toThrow();
  expect(await migrateWorkerData(f.vault, f.legacy)).toEqual(result);
});
it('keeps an unproven original worker attached for recovery and holds new admission', async () => {
  const f = await fixture();
  await writeFile(join(f.legacy, 'launch.json'), JSON.stringify(launch));
  const result = await migrateWorkerData(f.vault, f.legacy);
  expect(result).toEqual({ directory: f.legacy, migrationPending: true });
  expect(await readFile(join(f.legacy, 'launch.json'), 'utf8')).toBe(JSON.stringify(launch));
  const client = new DurableBuildClient({ privateDirectory: result.directory, migrationPending: result.migrationPending, workerSource: '' });
  expect(await client.readiness()).toMatchObject({ ready: false });
  await expect(client.prepare(durableRequest())).rejects.toThrow('migrate its data');
});
it('relocates an empty legacy directory without holding a nonexistent worker', async () => {
  const f = await fixture();
  const result = await migrateWorkerData(f.vault, f.legacy);
  expect(result).toEqual({ directory: durableBuildDirectory(f.vault), migrationPending: false });
});
it('preserves conflicting vault and legacy workers instead of selecting one generation', async () => {
  const f = await fixture();
  await mkdir(durableBuildDirectory(f.vault), { recursive: true });
  await writeFile(join(f.legacy, 'keep.json'), 'retained');
  await expect(migrateWorkerData(f.vault, f.legacy)).rejects.toThrow('both legacy and vault');
  expect(await readFile(join(f.legacy, 'keep.json'), 'utf8')).toBe('retained');
});

import { createServer } from 'node:http';
import { access, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { createDurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { retrySeedDirectory } from '../../../infrastructure/coforge/background-build-seed/store';
import { inputHash } from '../../../infrastructure/coforge/durable-worker/protocol';
import { durableRequest } from './durable-worker-fixture';
import type { DurableBuildRef } from '../../../features/coforge/domain/durable-build';
it('blocks reviewed imports on a healthy PR59-shaped worker while preserving original reference inspection', async () => {
  await mkdir(resolve('.nq'), { recursive: true }); const root = await realpath(await mkdtemp(join(resolve('.nq'), 'old-worker-capability-')));
  if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe capability fixture');
  const operations: string[] = []; const identity = { version: 1, workerId: 'old-worker', epoch: 1, nonce: 'old-nonce', token: 'a'.repeat(64), sourceHash: inputHash('old-worker-source') };
  let endpoint = ''; const ref: DurableBuildRef = { version: 1, executionId: 'build-' + 'b'.repeat(40), workerId: identity.workerId, epoch: 1, inputHash: 'c'.repeat(64) };
  const descriptor = () => ({ ...identity, endpoint, pid: process.pid, startedAt: '2026-10-31T00:00:00.000Z' });
  const server = createServer((request, response) => { let body = ''; request.on('data', chunk => { body += String(chunk); }); request.on('end', () => {
    const value: unknown = JSON.parse(body); if (!value || typeof value !== 'object' || !('op' in value) || typeof value.op !== 'string') { response.end('{}'); return; }
    operations.push(value.op); const result = value.op === 'health' ? descriptor() : value.op === 'workerStatus' ? { ready: true, message: 'Original PR59 worker is healthy.' } :
      { version: 1, ref, sequence: 1, phase: 'running', createdAt: '2026-10-31T00:00:00.000Z', startedAt: '2026-10-31T00:00:00.000Z', lastContactAt: new Date().toISOString(), elapsedSeconds: 1, logs: [] };
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ ok: true, value: result }));
  }); });
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing fixture endpoint'); endpoint = 'http://127.0.0.1:' + address.port + '/v1';
    const privateDirectory = join(root, 'private'); const files = new WorkerFiles(privateDirectory); await files.initialize(); await files.create('launch.json', identity); await files.create('descriptor.json', descriptor());
    const vaultDirectory = join(root, 'vault'); await mkdir(vaultDirectory);
    const client = createDurableBuildClient({ privateDirectory, workerSource: 'current bundle', nodeExecutable: process.execPath, vaultDirectory, protectedVaultFolders: () => ['CoForge'] });
    expect(await client.readiness()).toMatchObject({ ready: true, reviewedSnapshots: false, message: expect.stringContaining('earlier worker') });
    expect((await client.inspect(ref)).phase).toBe('running');
    const request = durableRequest(); request.reviewedSnapshot = { version: 1, id: 'not-authority', contentHash: 'd'.repeat(64) };
    await expect(client.prepare(request)).rejects.toThrow('earlier worker');
    const resources = client.retryResources({ load: async () => [], save: async () => { throw new Error('No journal writes'); } });
    await expect(resources.inspect({ projectId: 'p', ideaId: 'CF-1', runId: 'r', runRevision: 0, proposalRevision: 'q', stepId: 'build', sourceKind: 'repository', projectPath: '/not-read' })).rejects.toThrow('earlier worker');
    expect(operations).not.toContain('prepare'); expect(operations).not.toContain('start'); await expect(access(retrySeedDirectory(privateDirectory))).rejects.toThrow();
  } finally { await new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
}, 15000);

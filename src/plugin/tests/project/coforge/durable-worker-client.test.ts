import { mkdir, mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { afterEach, expect, it } from 'vitest';
import { createDurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { workerDescriptorCheck } from '../../../infrastructure/coforge/durable-worker/protocol';
import { durableRequest } from './durable-worker-fixture';
import { captureProcess } from '../../../infrastructure/coforge/process';
import { nativeIdentityCheck } from '../../../infrastructure/coforge/durable-worker/store';
import { stopOwnedProcessTree } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { record } from '../../../features/coforge/domain/check';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';

const folders: string[] = []; const workerDirectories: string[] = [];
afterEach(async () => {
  for (const directory of workerDirectories.splice(0)) {
    try { const data = record(JSON.parse(await readFile(join(directory, 'daemon.json'), 'utf8'))); await stopOwnedProcessTree(nativeIdentityCheck(data.identity)); }
    catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
  }
  for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
async function source() {
  const entry = resolve('src/plugin/infrastructure/coforge/durable-worker/runtime.ts').replaceAll('\\', '/');
  const result = await build({ stdin: { contents: `import {main} from ${JSON.stringify(entry)}; import {appendFile} from 'node:fs/promises'; import {join} from 'node:path';
    void main(process.argv[3], async (request,hooks)=>{ await appendFile(join(process.argv[3],'provider-count.txt'),request.jobId+'\\n');
    await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,600); hooks.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('cancelled'));},{once:true});});return {summary:'Fake provider completed'};});`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false, logLevel: 'silent' });
  return result.outputFiles[0]!.text;
}
it('checks readiness without creating private files, then reconnects to one detached worker without relaunching its provider', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'coforge-worker-client-')); folders.push(parent);
  const directory = join(parent, 'private'); const workerSource = await source();
  workerDirectories.push(directory);
  const vaultDirectory = join(parent, 'vault'); const project = join(parent, 'game'); await mkdir(vaultDirectory); await mkdir(project);
  await captureProcess('git', ['init', '-q'], { cwd: project });
  const client = createDurableBuildClient({ privateDirectory: directory, workerSource, nodeExecutable: process.execPath, vaultDirectory, protectedVaultFolders: () => ['CoForge'] });
  expect((await client.readiness()).ready).toBe(true); await expect(access(directory)).rejects.toThrow();
  const request = durableRequest(); request.input.integration.projectPath = project;
  const ref = await client.prepare(request);
  const descriptor = workerDescriptorCheck(JSON.parse(await readFile(join(directory, 'descriptor.json'), 'utf8')));
  await client.start(ref); await client.start(ref); await client.detach();
  const reopened = createDurableBuildClient({ privateDirectory: directory, workerSource, nodeExecutable: 'missing-node-for-this-test' });
  await expect(reopened.readiness()).resolves.toMatchObject({ ready: false });
  await expect.poll(async () => (await reopened.inspect(ref)).phase, { timeout: 10000 }).toBe('completed');
  const completed = await reopened.inspect(ref); await reopened.acknowledge(ref, completed.sequence); await reopened.acknowledge(ref, completed.sequence);
  expect((await readFile(join(directory, 'provider-count.txt'), 'utf8')).trim().split('\n')).toEqual(['job-one']);
  const response = await fetch(descriptor.endpoint, { method: 'POST', body: JSON.stringify({ op: 'health' }) });
  expect(response.status).toBe(403);
  const daemon = record(JSON.parse(await readFile(join(directory, 'daemon.json'), 'utf8')));
  expect((await stopOwnedProcessTree(nativeIdentityCheck(daemon.identity))).treeConfirmed).toBe(true);
  const reattached = createDurableBuildClient({ privateDirectory: directory, workerSource, nodeExecutable: process.execPath, vaultDirectory, protectedVaultFolders: () => ['CoForge'] });
  await expect(reattached.configureConcurrency(2)).resolves.toBeUndefined();
  expect(workerDescriptorCheck(JSON.parse(await readFile(join(directory, 'descriptor.json'), 'utf8'))).workerId).toBe(ref.workerId);
  const next = structuredClone(request); next.jobId = next.input.jobId = 'another-admission'; next.runId = next.input.workflow.runId = 'another-run'; next.attemptId = next.input.workflow.attemptId = 'another-attempt';
  const replacement = await reattached.prepare(next); expect(replacement.workerId).not.toBe(ref.workerId);
  expect(JSON.parse(await readFile(join(directory, 'capacity.json'), 'utf8'))).toEqual({ builds: 2 });
  expect(await client.prepare(request)).toEqual(ref);
  await expect(client.start(ref)).rejects.toThrow();
  const edited = structuredClone(request); edited.input.settings.maxTurns++;
  await expect(client.prepare(edited)).rejects.toThrow('different immutable captured input');
  for (const field of ['project', 'run', 'attempt']) {
    const reused = structuredClone(request);
    if (field === 'project') reused.projectId = reused.input.idea.projectId = request.projectId + '-other';
    if (field === 'run') reused.runId = reused.input.workflow.runId = 'reused-job-other-run';
    if (field === 'attempt') reused.attemptId = reused.input.workflow.attemptId = 'reused-job-other-attempt';
    await expect(client.prepare(reused)).rejects.toThrow('different immutable captured input');
  }
  expect((await readFile(join(directory + '-archive', ref.workerId, 'provider-count.txt'), 'utf8')).trim()).toBe('job-one');
  await expect(access(join(directory, 'provider-count.txt'))).rejects.toThrow();
}, 30000);
it('refuses capacity synchronization to an unreachable generation with an unsettled original reservation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-unsettled-')); folders.push(directory);
  const files = new WorkerFiles(directory); const store = new WorkerStore(files, 'worker-one'); await store.initialize(); const ref = await store.prepare(durableRequest());
  const identity = { version: 1, workerId: ref.workerId, epoch: ref.epoch, nonce: 'nonce-one', token: 'a'.repeat(64), sourceHash: 'b'.repeat(64) };
  await files.create('launch.json', identity);
  await files.create('daemon.json', { workerId: ref.workerId, identity: { pid: process.pid, platform: process.platform, birth: 'not-this-supervisor', image: 'c'.repeat(64) } });
  await files.create('descriptor.json', { ...identity, endpoint: 'http://127.0.0.1:1/v1', pid: process.pid, startedAt: new Date().toISOString() });
  const client = createDurableBuildClient({ privateDirectory: directory, workerSource: '' });
  await expect(client.configureConcurrency(2)).rejects.toThrow('unreachable');
  await rm(files.path('descriptor.json'));
  await expect(client.configureConcurrency(2)).rejects.toThrow('unreachable');
  expect(store.get(ref).record.snapshot.phase).toBe('prepared'); expect(await files.read('capacity.json')).toBeUndefined();
});
it('inspects retained evidence with a missing descriptor and rolls a verified unused generation without retargeting old starts', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'coforge-worker-rollover-')); folders.push(parent);
  const directory = join(parent, 'private'); const workerSource = await source();
  const vaultDirectory = join(parent, 'vault'); const project = join(parent, 'game'); await mkdir(vaultDirectory); await mkdir(project);
  await captureProcess('git', ['init', '-q'], { cwd: project });
  const options = { privateDirectory: directory, workerSource, nodeExecutable: process.execPath, vaultDirectory, protectedVaultFolders: () => ['CoForge'] };
  const client = createDurableBuildClient(options); const request = durableRequest(); request.input.integration.projectPath = project;
  const ref = await client.prepare(request);
  await client.cancelUnstarted(request.jobId);
  const daemon = record(JSON.parse(await readFile(join(directory, 'daemon.json'), 'utf8')));
  expect((await stopOwnedProcessTree(nativeIdentityCheck(daemon.identity))).treeConfirmed).toBe(true);
  await rm(join(directory, 'descriptor.json'));
  const inspection = await client.inspectRetained(ref); expect(inspection.snapshot.phase).toBe('cancelled');
  expect((await client.readiness()).ready).toBe(true);
  const next = structuredClone(request); next.jobId = next.input.jobId = 'new-unpaid-job'; next.attemptId = next.input.workflow.attemptId = 'new-attempt';
  const replacement = await client.prepare(next); workerDirectories.push(directory);
  expect(replacement.workerId).not.toBe(ref.workerId);
  expect((await client.inspectRetained(ref)).ref).toEqual(ref);
  await expect(client.start(ref)).rejects.toThrow();
  await expect(client.prepare(request)).rejects.toThrow('original unpaid job was cancelled');
  await expect(access(join(directory, 'provider-count.txt'))).rejects.toThrow();
}, 30000);
it('repairs an actually exited unused bootstrap without launching a provider and preserves the failed generation', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'coforge-worker-bootstrap-')); folders.push(parent);
  const directory = join(parent, 'private'); const vaultDirectory = join(parent, 'vault'); const project = join(parent, 'game');
  await mkdir(vaultDirectory); await mkdir(project); await captureProcess('git', ['init', '-q'], { cwd: project });
  const options = { privateDirectory: directory, workerSource: 'throw new Error("Contained startup fixture");', nodeExecutable: process.execPath, vaultDirectory, protectedVaultFolders: () => [] };
  const failed = createDurableBuildClient(options); const request = durableRequest(); request.input.integration.projectPath = project;
  await expect(failed.prepare(request)).rejects.toThrow(/unused worker startup/i);
  expect(await failed.readiness()).toMatchObject({ ready: false, repairable: true });
  expect(await failed.repairBootstrap(true)).toMatchObject({ ready: true });
  await expect(access(directory)).rejects.toThrow();
  const client = createDurableBuildClient({ ...options, workerSource: await source() }); const ref = await client.prepare(request); workerDirectories.push(directory);
  expect(ref.executionId).toMatch(/^build-/u); await expect(access(join(directory, 'provider-count.txt'))).rejects.toThrow();
}, 30000);

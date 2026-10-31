import { mkdtemp, mkdir, realpath, readdir, rm, access, symlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { archivedFiles, archiveGeneration, generationRetirable } from '../../../infrastructure/coforge/durable-worker/generation';
import { bootstrapReadiness, recordBootstrapExit, recordBootstrapSpawnFailure, repairBootstrap } from '../../../infrastructure/coforge/durable-worker/bootstrap-repair';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { readNativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { durableRequest } from './durable-worker-fixture';

const roots: string[]=[];
afterEach(async()=>{ for(const root of roots.splice(0)){ if(!resolve(root).startsWith(resolve('.nq')+sep)) throw new Error('Unsafe bootstrap fixture cleanup'); await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}); } });
async function fixture(){
  await mkdir(resolve('.nq'),{recursive:true}); const root=await realpath(await mkdtemp(join(resolve('.nq'),'bootstrap-'))); roots.push(root);
  const files=new WorkerFiles(join(root,'private')); await files.initialize();
  const identity={workerId:'worker-original',nonce:'launch-nonce',sourceHash:'b'.repeat(64)};
  const launch={version:1,epoch:1,token:'a'.repeat(64),...identity}; await files.create('launch.json',launch); await files.create('index.json',[]);
  return {root,files,identity,launch};
}
it('requires a matching actual child-exit receipt, then archives an unpaid failed bootstrap without deleting its bytes',async()=>{
  const f=await fixture(); const before=await readdir(f.files.directory);
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false); expect(await readdir(f.files.directory)).toEqual(before);
  await expect(recordBootstrapExit(f.files,{...f.identity,nonce:'other-launch'},1,null)).rejects.toThrow();
  await recordBootstrapExit(f.files,f.identity,1,null);
  expect((await bootstrapReadiness(f.files)).repairable).toBe(true);
  await repairBootstrap(f.files,true);
  await expect(access(f.files.directory)).rejects.toThrow();
  const archived=await archivedFiles(f.files,f.identity.workerId); expect(archived).toBeDefined();
  expect(await archived!.read('launch.json')).toEqual(f.launch);
  expect(await archived!.read('launch-exit.json')).toMatchObject({confirmedChildExit:true,code:1});
  await f.files.initialize(); expect(await f.files.read('launch.json')).toBeUndefined();
  expect(await (await archivedFiles(f.files,f.identity.workerId))!.read('launch.json')).toEqual(f.launch);
});
it('does not repair a still-unconfirmed or modified startup and rejects traversal in archive identity',async()=>{
  const f=await fixture();
  await expect(repairBootstrap(f.files,true)).rejects.toThrow();
  expect(await f.files.read('launch.json')).toEqual(f.launch);
  await recordBootstrapExit(f.files,f.identity,null,'SIGTERM');
  await f.files.write('launch.json',{...f.launch,nonce:'changed'});
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false);
  await expect(repairBootstrap(f.files,true)).rejects.toThrow();
  await expect(archivedFiles(f.files,'../worker-original')).rejects.toThrow();
});
it('cancels only a proven unused preparation and preserves its captured request in the archive', async () => {
  const f = await fixture(); const store = new WorkerStore(f.files, f.identity.workerId); await store.initialize();
  const request = durableRequest(); const ref = await store.prepare(request);
  await recordBootstrapExit(f.files, f.identity, 1, null);
  expect((await bootstrapReadiness(f.files)).repairable).toBe(true);
  await repairBootstrap(f.files, true);
  const archived = (await archivedFiles(f.files, ref.workerId))!;
  const task = new WorkerFiles(archived.path(ref.executionId)); await task.attach();
  expect(await task.read('input.json')).toEqual(request);
  expect(await task.read('record.json')).toMatchObject({ reservationReleased: true, snapshot: { ref, phase: 'cancelled', sequence: 1, cancellationRequested: true } });
});
it('keeps a paid terminal result until its exact acknowledgement and retains both immutable generations', async () => {
  const f = await fixture(); await recordBootstrapExit(f.files, f.identity, 1, null); await repairBootstrap(f.files, true);
  await f.files.initialize(); const launch = { ...f.launch, workerId: 'worker-second', nonce: 'second-nonce' };
  await f.files.create('launch.json', launch);
  const store = new WorkerStore(f.files, launch.workerId); await store.initialize(); const ref = await store.prepare(durableRequest());
  const terminal = await store.update(ref, record => { record.startIntent = true; record.snapshot.phase = 'completed'; record.snapshot.result = { summary: 'Original completed output' }; });
  await recordBootstrapExit(f.files, launch, 0, null);
  const before = await store.get(ref).files.read('record.json');
  expect(await generationRetirable(f.files, launch.workerId)).toBe(false);
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false);
  await expect(archiveGeneration(f.files, launch.workerId)).rejects.toThrow();
  expect(await store.get(ref).files.read('record.json')).toEqual(before);
  await store.acknowledge(ref, terminal.sequence);
  const acknowledged = await store.get(ref).files.read('record.json');
  expect(await generationRetirable(f.files, launch.workerId)).toBe(true);
  expect(await store.get(ref).files.read('record.json')).toEqual(acknowledged);
  await archiveGeneration(f.files, launch.workerId);
  const second = (await archivedFiles(f.files, launch.workerId))!; const retained = new WorkerFiles(second.path(ref.executionId)); await retained.attach();
  expect(await retained.read('record.json')).toEqual(acknowledged);
  expect(await (await archivedFiles(f.files, f.identity.workerId))!.read('launch.json')).toEqual(f.launch);
  await f.files.initialize(); await f.files.create('launch.json', { ...launch, workerId: 'worker-third' });
  await archiveGeneration(f.files, launch.workerId); // Idempotent old archival cannot move the new active generation.
  expect(await f.files.read('launch.json')).toMatchObject({workerId: 'worker-third'});
});
it('refuses to archive a live original supervisor even with a matching test exit receipt', async () => {
  const f = await fixture(); const identity = await readNativeProcessIdentity(process.pid); expect(identity).toBeDefined();
  await f.files.create('daemon.json', { pid: process.pid, workerId: f.identity.workerId, nonce: f.identity.nonce, instance: 'test-instance', identity });
  await recordBootstrapExit(f.files, f.identity, 0, null);
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false);
  expect(await generationRetirable(f.files, f.identity.workerId)).toBe(false);
  await expect(archiveGeneration(f.files, f.identity.workerId)).rejects.toThrow();
  expect(await f.files.read('launch.json')).toEqual(f.launch);
}, 20000);
it('refuses a linked archive parent and preserves unindexed task evidence', async () => {
  const f = await fixture(); await recordBootstrapExit(f.files, f.identity, 0, null);
  const destination = join(f.root, 'other'); await mkdir(destination);
  await symlink(destination, f.files.directory + '-archive', process.platform === 'win32' ? 'junction' : 'dir');
  await expect(archiveGeneration(f.files, f.identity.workerId)).rejects.toThrow(); expect(await readdir(destination)).toEqual([]);
  await mkdir(f.files.path('build-' + 'f'.repeat(40)));
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false);
  expect(await f.files.read('launch.json')).toEqual(f.launch);
});
it('retains a proven no-child spawn failure without accepting an arbitrary error or another launch', async () => {
  const f = await fixture();
  await expect(recordBootstrapSpawnFailure(f.files, f.identity, 'UNKNOWN')).rejects.toThrow();
  await expect(recordBootstrapSpawnFailure(f.files, { ...f.identity, nonce: 'another-launch' }, 'ENOENT')).rejects.toThrow();
  expect((await bootstrapReadiness(f.files)).repairable).toBe(false);
  await recordBootstrapSpawnFailure(f.files, f.identity, 'ENOENT');
  expect((await bootstrapReadiness(f.files)).repairable).toBe(true);
  await repairBootstrap(f.files, true);
  expect(await (await archivedFiles(f.files, f.identity.workerId))!.read('launch-spawn-failure.json')).toMatchObject({ confirmedNotStarted: true, code: 'ENOENT' });
});
it('never moves a nested worktree with its private journal or retires an unindexed workspace authority', async () => {
  const f = await fixture(); await recordBootstrapExit(f.files, f.identity, 0, null);
  const nested = f.files.path('nested-worktree'); await mkdir(nested);
  const record = { id: 'bg-retained', runId: 'run-one', projectId: 'project-one', projectPath: f.root, cwd: nested,
    branch: 'coforge/retained', baseCommit: 'a'.repeat(40), phase: 'retired' };
  await f.files.create('workspaces.json', [record]);
  expect(await generationRetirable(f.files, f.identity.workerId)).toBe(false);
  await expect(archiveGeneration(f.files, f.identity.workerId)).rejects.toThrow();
  await access(nested);
  await f.files.write('workspaces.json', [{ ...record, cwd: join(f.root, 'outside-worktree') }]);
  expect(await generationRetirable(f.files, f.identity.workerId)).toBe(false);
  expect(await f.files.read('launch.json')).toEqual(f.launch);
});

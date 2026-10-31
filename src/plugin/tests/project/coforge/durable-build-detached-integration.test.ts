import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { expect, it } from 'vitest';
import { createDurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { workerDescriptorCheck } from '../../../infrastructure/coforge/durable-worker/protocol';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { readNativeProcessIdentity, stopOwnedProcessTree, type NativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { durableFixture } from './durable-build-fixture';

it('finishes in a real detached worker while the host is absent, then commits and acknowledges once after reopening', async () => {
  await mkdir(resolve('.nq'), { recursive: true });
  const directory = await realpath(await mkdtemp(join(resolve('.nq'), 'detached-host-')));
  if (!resolve(directory).startsWith(resolve('.nq') + sep)) throw new Error('Unsafe detached fixture location');
  const game = join(directory, 'game'); const vault = join(directory, 'vault'); await mkdir(game); await mkdir(vault);
  await agentGit(game, ['init', '--initial-branch=main']); await writeFile(join(game, 'README.md'), 'Contained game fixture\n');
  await agentGit(game, ['add', 'README.md']);
  await agentGit(game, ['-c', 'user.name=CoForge fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Contained fixture']);
  let identity: NativeProcessIdentity | undefined;
  const entry = resolve('src/plugin/infrastructure/coforge/durable-worker/runtime.ts').replaceAll('\\', '/');
  const workspaceModule = resolve('src/plugin/infrastructure/coforge/durable-worker/workspaces.ts').replaceAll('\\', '/');
  const filesModule = resolve('src/plugin/infrastructure/coforge/durable-worker/files.ts').replaceAll('\\', '/');
  const seedModule = resolve('src/plugin/features/coforge/domain/seed.ts').replaceAll('\\', '/');
  const bundled = await build({ stdin: { contents: `import {main} from ${JSON.stringify(entry)}; import {appendFile,access} from 'node:fs/promises'; import {join} from 'node:path';
    import {workerWorkspaces} from ${JSON.stringify(workspaceModule)};import {WorkerFiles} from ${JSON.stringify(filesModule)};import {defaultIntegration} from ${JSON.stringify(seedModule)};
    setTimeout(()=>process.exit(0),30000).unref();
    void main(process.argv[3],async(request,hooks)=>{
      const files=new WorkerFiles(process.argv[3]);await files.attach();const workspaces=workerWorkspaces(files);await workspaces.start();
      const lease=await workspaces.acquire({runId:request.runId,projectId:request.projectId,attemptId:request.attemptId,access:'editworktree',integration:{...defaultIntegration(),...request.input.integration}});
      try{
      await appendFile(join(process.argv[3],'admissions.txt'),request.jobId+'\\n');
      await hooks.workspace(lease.id);
      await hooks.conversation({kind:'request',instructions:'Fixture instructions',prompt:'Captured fixture task'});
      for(;;){try{await access(join(process.argv[3],'finish-fixture'));break}catch{}await new Promise(done=>setTimeout(done,30));}
      await hooks.conversation({kind:'response',text:'Verified fixture completion'});
      await hooks.changes((await lease.capture('Verified empty fixture worktree'))??null);
      return {summary:'Detached fixture completed without changes',costUsd:0.2};
      }finally{await lease.release()}
    });`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false, logLevel: 'silent' });
  const workerSource = bundled.outputFiles[0]!.text;
  const clientOptions = { privateDirectory: join(directory, 'private'), workerSource, nodeExecutable: process.execPath, vaultDirectory: vault, protectedVaultFolders: () => ['CoForge', '.obsidian'] };
  const client = createDurableBuildClient(clientOptions);
  const f = await durableFixture();
  await f.store.transaction(state => { state.integration.projectPath = game; });
  const options = { ...f.options, durableBuilds: client };
  const host = new WorkflowEngine(f.store, options);
  try {
    await host.startWorkflow(f.id); await host.waitUntilIdle();
    const job = f.store.snapshot().jobs[0]!; const ref = job.durable?.ref;
    if (!ref) throw new Error('The host did not persist the original worker reference');
    const descriptor = workerDescriptorCheck(JSON.parse(await readFile(join(directory, 'private', 'descriptor.json'), 'utf8')));
    identity = await readNativeProcessIdentity(descriptor.pid);
    await expect.poll(() => readFile(join(directory, 'private', 'admissions.txt'), 'utf8').catch(() => ''), { timeout: 15000 }).toBe(job.id + '\n');
    await host.stop();
    expect((await client.inspect(ref)).phase).toBe('running');
    await writeFile(join(directory, 'private', 'finish-fixture'), 'complete');
    await expect.poll(async () => (await client.inspect(ref)).phase, { timeout: 15000 }).toBe('completed');
    expect(f.store.snapshot().jobs[0]?.status).toBe('running');
    const reopened = new StudioStore(f.storage); await reopened.init();
    const nextClient = createDurableBuildClient(clientOptions);
    const nextHost = new WorkflowEngine(reopened, { ...options, durableBuilds: nextClient });
    try {
      await nextHost.reconcileDurableBuild(f.id); await nextHost.reconcileDurableBuild(f.id);
      const completed = reopened.snapshot().jobs[0]!;
      expect(completed.status).toBe('succeeded'); expect(completed.durable?.acknowledged).toBe(true);
      expect(completed.conversation?.response?.text).toBe('Verified fixture completion');
      expect(reopened.snapshot().ideas[0]?.workflowRun?.cursor).toBe(1);
      expect(reopened.snapshot().ideas[0]?.workflowRun?.attempts).toHaveLength(1);
      expect(await readFile(join(directory, 'private', 'admissions.txt'), 'utf8')).toBe(job.id + '\n');
      expect(f.foreground).not.toHaveBeenCalled();
    } finally { await nextHost.stop(); }
  } finally {
    await host.stop(); await f.engine.stop();
    if (identity) await stopOwnedProcessTree(identity);
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 45000);
